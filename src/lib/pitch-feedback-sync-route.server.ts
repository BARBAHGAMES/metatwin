// Fetches a student's own published-to-web Google Sheet (from a Form's
// response sheet) and summarizes it — same "public, read-only proxy" shape
// as github-sync-route.server.ts: no user auth needed here (the write to
// projects.pitch_scores happens client-side under the caller's own RLS
// session), but the target host IS restricted to docs.google.com, since
// this Worker is making the outbound request on the caller's behalf and an
// arbitrary URL would make it an open SSRF proxy.
import { summarizeScores, type PitchScores } from "./scores";

const ALLOWED_HOST = "docs.google.com";
const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;

export async function handlePitchFeedbackSync(request: Request): Promise<Response> {
  let body: { csv_url?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
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
    const summary: PitchScores = summarizeScores(text);
    return new Response(JSON.stringify(summary), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return new Response(JSON.stringify({ error: timedOut ? "Timed out fetching the sheet." : "Could not reach Google Sheets. Try again." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  } finally {
    clearTimeout(timeout);
  }
}
