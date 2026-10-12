// Invoked by a Google Apps Script "on form submit" trigger bound to the
// pitch-competition scoring Form (not a Postgres pg_net trigger like the
// other webhook routes — the source event happens on Google's side, so the
// Script itself calls this endpoint directly with
// "Authorization: Bearer <PITCH_SCORE_WEBHOOK_SECRET>"). That secret lives
// only as a Worker secret and in the Form's Apps Script "Script properties"
// — never in this repo.
//
// A pitch can be scored for an individual (identifier_type "handle") or a
// team (identifier_type "team_slug") — never both; see pitch_scores'
// pitch_scores_subject_exactly_one constraint. The score itself always lands
// via this service-role route, never a client RPC, since judges aren't
// MetaTwin users.
import { safeEqual } from "./new-user-webhook-route.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PitchScorePayload = {
  identifier_type?: unknown;
  identifier?: unknown;
  competition_name?: unknown;
  round_name?: unknown;
  event_date?: unknown;
  problem_score?: unknown;
  solution_score?: unknown;
  team_score?: unknown;
  ask_score?: unknown;
  judge_name?: unknown;
  judge_comment?: unknown;
  form_response_id?: unknown;
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

function isRubricScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 25;
}

function nonEmptyString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength ? value.trim() : null;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return nonEmptyString(value, maxLength);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function handlePitchScoreWebhook(request: Request): Promise<Response> {
  const secret = process.env.PITCH_SCORE_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || !(await safeEqual(authHeader, `Bearer ${secret}`))) {
    return jsonError("Unauthorized", 401);
  }

  let payload: PitchScorePayload;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Bad request: invalid JSON", 400);
  }

  const identifierType = payload.identifier_type === "handle" || payload.identifier_type === "team_slug" ? payload.identifier_type : null;
  const identifier = nonEmptyString(payload.identifier, 30);
  const competitionName = nonEmptyString(payload.competition_name, 160);
  const roundName = optionalString(payload.round_name, 60);
  const judgeName = optionalString(payload.judge_name, 120);
  const judgeComment = optionalString(payload.judge_comment, 2000);
  const formResponseId = nonEmptyString(payload.form_response_id, 200);
  const eventDate = typeof payload.event_date === "string" && DATE_RE.test(payload.event_date) ? payload.event_date : null;

  if (!identifierType || !identifier || !competitionName || !formResponseId) {
    return jsonError("Bad request: missing identifier_type/identifier/competition_name/form_response_id", 400);
  }
  if (![payload.problem_score, payload.solution_score, payload.team_score, payload.ask_score].every(isRubricScore)) {
    return jsonError("Bad request: problem_score/solution_score/team_score/ask_score must each be an integer 0-25", 400);
  }
  const problemScore = payload.problem_score as number;
  const solutionScore = payload.solution_score as number;
  const teamScore = payload.team_score as number;
  const askScore = payload.ask_score as number;

  let twinId: string | null = null;
  let teamId: string | null = null;
  if (identifierType === "handle") {
    const { data } = await supabaseAdmin.from("twins").select("id").eq("handle", identifier.toLowerCase()).maybeSingle();
    if (!data) return jsonError(`No MetaTwin found with handle "${identifier}"`, 404);
    twinId = data.id;
  } else {
    const { data } = await supabaseAdmin.from("teams").select("id").eq("slug", identifier.toLowerCase()).maybeSingle();
    if (!data) return jsonError(`No team found with slug "${identifier}"`, 404);
    teamId = data.id;
  }

  const { error } = await supabaseAdmin.from("pitch_scores").insert({
    twin_id: twinId,
    team_id: teamId,
    competition_name: competitionName,
    round_name: roundName,
    ...(eventDate ? { event_date: eventDate } : {}),
    problem_score: problemScore,
    solution_score: solutionScore,
    team_score: teamScore,
    ask_score: askScore,
    judge_name: judgeName,
    judge_comment: judgeComment,
    form_response_id: formResponseId,
  });

  if (error) {
    // Google Forms triggers can double-fire on edit/retry — the same
    // form_response_id arriving twice is an expected idempotent no-op, not
    // a real failure.
    if (error.code === "23505") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return jsonError(error.message, 500);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
}
