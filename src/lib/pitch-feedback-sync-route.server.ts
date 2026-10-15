// Syncs a student's own published-to-web Google Sheet (a Form's response
// sheet) for one of two things on the same project: judge/customer pitch
// feedback (`kind: "pitch_scores"`) or idea-validation interview responses
// (`kind: "interviews"`) — same parse, different target columns. Authenticated
// and ownership-checked, then written server-side via supabaseAdmin (Build
// Plan 0.5: interviews_count feeds recompute_project_stage, so letting the
// browser write it directly would let a student forge their own stage
// advancement). The target host is still restricted to docs.google.com,
// since this Worker fetches an externally-supplied URL on the student's
// behalf and an unrestricted host would make it an open SSRF proxy.
import { summarizeScores, type PitchScores } from "./scores";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_HOST = "docs.google.com";
const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;

async function authenticateTwin(request: Request): Promise<string | Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Sign in to sync." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Sign in to sync." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return userData.user.id;
}

export async function handlePitchFeedbackSync(request: Request): Promise<Response> {
  const authResult = await authenticateTwin(request);
  if (authResult instanceof Response) return authResult;
  const callerId = authResult;

  let body: { csv_url?: unknown; project_id?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!projectId) {
    return new Response(JSON.stringify({ error: "Bad request: missing project_id." }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const kind = body.kind === "pitch_scores" || body.kind === "interviews" ? body.kind : null;
  if (!kind) {
    return new Response(JSON.stringify({ error: "Bad request: kind must be pitch_scores or interviews." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const { data: project } = await supabaseAdmin.from("projects").select("id, twin_id").eq("id", projectId).maybeSingle();
  if (!project) return new Response(JSON.stringify({ error: "Project not found." }), { status: 404, headers: { "content-type": "application/json" } });
  if (project.twin_id !== callerId) {
    return new Response(JSON.stringify({ error: "You can only sync your own project." }), { status: 403, headers: { "content-type": "application/json" } });
  }

  const csvUrl = typeof body.csv_url === "string" ? body.csv_url.trim() : "";
  let parsed: URL;
  try {
    parsed = new URL(csvUrl);
  } catch {
    return new Response(JSON.stringify({ error: "Enter a valid URL." }), { status: 400, headers: { "content-type": "application/json" } });
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_HOST) {
    return new Response(
      JSON.stringify({ error: "Only a published Google Sheets link (docs.google.com) is supported." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let summary: PitchScores;
  try {
    const res = await fetch(parsed.toString(), { signal: controller.signal });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Could not fetch the sheet (${res.status}). Make sure it's published to the web.` }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "That sheet is too large to sync." }), { status: 413, headers: { "content-type": "application/json" } });
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "That sheet is too large to sync." }), { status: 413, headers: { "content-type": "application/json" } });
    }
    summary = summarizeScores(text);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return new Response(JSON.stringify({ error: timedOut ? "Timed out fetching the sheet." : "Could not reach Google Sheets. Try again." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  } finally {
    clearTimeout(timeout);
  }

  const now = new Date().toISOString();
  const update =
    kind === "pitch_scores"
      ? { scores_csv_url: csvUrl, pitch_scores: summary, scores_synced_at: now }
      : { interviews_csv_url: csvUrl, interviews_count: summary.responses, interviews_synced_at: now };
  const { error: dbError } = await supabaseAdmin.from("projects").update(update).eq("id", projectId);
  if (dbError) return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { "content-type": "application/json" } });

  return new Response(JSON.stringify(summary), { status: 200, headers: { "content-type": "application/json" } });
}
