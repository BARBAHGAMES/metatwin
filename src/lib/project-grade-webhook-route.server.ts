// Invoked by a Google Apps Script bound to the MKU grading Form (not a
// Postgres pg_net trigger — the source event happens on Google's side) with
// "Authorization: Bearer <PROJECT_GRADE_WEBHOOK_SECRET>" — a secret separate
// from PITCH_SCORE_WEBHOOK_SECRET and SUPABASE_WEBHOOK_SECRET, since this is
// a distinct external Apps Script surface with its own blast radius.
//
// The CBE rating is a fixed, hard-coded scale — the Form only collects the
// label (a dropdown); rating_score is always computed here, never trusted
// from the Form. university_id is copied from the student's own
// twins.university_id, not asked on the Form, so there's nothing to mistype.
import { safeEqual } from "./new-user-webhook-route.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RATING_SCORES: Record<string, number> = {
  "Exceeds Expectation": 4,
  "Meets Expectation": 3,
  "Approaches Expectation": 2,
  "Below Expectation": 1,
};

type ProjectGradePayload = {
  student_handle?: unknown;
  project_title?: unknown;
  rating_label?: unknown;
  grader_name?: unknown;
  comment?: unknown;
  form_response_id?: unknown;
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

function nonEmptyString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength ? value.trim() : null;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return nonEmptyString(value, maxLength);
}

export async function handleProjectGradeWebhook(request: Request): Promise<Response> {
  const secret = process.env.PROJECT_GRADE_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || !(await safeEqual(authHeader, `Bearer ${secret}`))) {
    return jsonError("Unauthorized", 401);
  }

  let payload: ProjectGradePayload;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Bad request: invalid JSON", 400);
  }

  const studentHandle = nonEmptyString(payload.student_handle, 30);
  const projectTitle = nonEmptyString(payload.project_title, 120);
  const ratingLabel = typeof payload.rating_label === "string" ? payload.rating_label.trim() : "";
  const graderName = optionalString(payload.grader_name, 120);
  const comment = optionalString(payload.comment, 2000);
  const formResponseId = nonEmptyString(payload.form_response_id, 200);

  if (!studentHandle || !projectTitle || !formResponseId) {
    return jsonError("Bad request: missing student_handle/project_title/form_response_id", 400);
  }
  const ratingScore = RATING_SCORES[ratingLabel];
  if (ratingScore === undefined) {
    return jsonError(`Bad request: rating_label must be one of ${Object.keys(RATING_SCORES).join(", ")}`, 400);
  }

  const { data: twin } = await supabaseAdmin.from("twins").select("id, university_id").eq("handle", studentHandle.toLowerCase()).maybeSingle();
  if (!twin) return jsonError(`No MetaTwin found with handle "${studentHandle}"`, 404);
  if (!twin.university_id) return jsonError(`"${studentHandle}" has no university set on their MetaTwin — can't attribute this grade.`, 422);

  const { data: projects, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("twin_id", twin.id)
    .ilike("title", projectTitle);
  if (projectError) return jsonError(projectError.message, 500);
  if (!projects || projects.length === 0) return jsonError(`No project titled "${projectTitle}" found for "${studentHandle}"`, 404);
  if (projects.length > 1) return jsonError(`"${studentHandle}" has more than one project titled "${projectTitle}" — use a unique title.`, 409);

  const { error } = await supabaseAdmin.from("project_grades").insert({
    project_id: projects[0]!.id,
    twin_id: twin.id,
    university_id: twin.university_id,
    rating_label: ratingLabel,
    rating_score: ratingScore,
    grader_name: graderName,
    comment,
    form_response_id: formResponseId,
  });

  if (error) {
    if (error.code === "23505") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return jsonError(error.message, 500);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
}
