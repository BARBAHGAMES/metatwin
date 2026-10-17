// Deck viewability check (pitch flow Release A).
//   POST /api/projects/check-deck { project_id }
// Authenticated + ownership-checked. Opens the project's *saved* pitch deck link
// as an anonymous visitor would and records the result in the server-only
// projects.pitch_deck_status / pitch_deck_checked_at columns.
//
// SSRF-safe by construction: the Worker never fetches the URL the student typed.
// It only requests fixed Google/YouTube endpoints built from a validated file id.
// Every other link (PDF on some host, Canva, ...) is recorded as 'unknown'.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateTwin } from "./authenticate-twin.server";
import { checkOwnsRow } from "./check-owns-row.server";
import { googleFileRef, youTubeVideoId } from "./embed";

export type DeckStatus = "public" | "restricted" | "not_found" | "unknown";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const TIMEOUT_MS = 8000;

/** Pure: which fixed endpoint to probe for a deck link, if any. */
export function probeTarget(deckUrl: string): { kind: "google" | "youtube"; url: string } | null {
  const yt = youTubeVideoId(deckUrl);
  if (yt) return { kind: "youtube", url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}` };
  const ref = googleFileRef(deckUrl);
  if (!ref) return null;
  if (ref.published) {
    // "Publish to the web" links are public by definition once they resolve.
    return {
      kind: "google",
      url: ref.app === "slides" ? `https://docs.google.com/presentation/d/e/${ref.id}/pub` : `https://docs.google.com/document/d/e/${ref.id}/pub`,
    };
  }
  if (ref.app === "slides") return { kind: "google", url: `https://docs.google.com/presentation/d/${ref.id}/preview` };
  if (ref.app === "docs") return { kind: "google", url: `https://docs.google.com/document/d/${ref.id}/preview` };
  return { kind: "google", url: `https://drive.google.com/file/d/${ref.id}/view` };
}

/**
 * Pure: interpret Google's answer to an anonymous request (redirects NOT followed).
 * - 200 → candidate "public" (checkDeck then confirms from the page itself).
 * - 3xx to accounts.google.com / ServiceLogin → sign-in required (restricted).
 * - 401/403 → restricted. 404/410 → not found. Anything else → unknown.
 * Calibrate against one real public and one real restricted deck before relying
 * on it (see the runbook); the unit tests pin the mapping.
 */
export function classifyGoogleResponse(status: number, location: string | null): DeckStatus {
  if (status === 200) return "public";
  if (status >= 300 && status < 400) {
    if (location && /accounts\.google\.com|ServiceLogin|\/signin/i.test(location)) return "restricted";
    return "unknown";
  }
  if (status === 401 || status === 403) return "restricted";
  if (status === 404 || status === 410) return "not_found";
  return "unknown";
}

/** Pure: YouTube oEmbed answers 200 for public/unlisted videos, 401/403 for private, 404/400 for missing. */
export function classifyYouTubeResponse(status: number): DeckStatus {
  if (status === 200) return "public";
  if (status === 401 || status === 403) return "restricted";
  if (status === 404 || status === 400) return "not_found";
  return "unknown";
}

/** Pure: markers of Google's sign-in / request-access pages (never present on a shared deck). */
export function looksLikeSignInPage(html: string): boolean {
  return /accounts\.google\.com\/(ServiceLogin|v3\/signin|signin)|<title>[^<]*(Sign[- ]in|Request access|You need access)/i.test(html);
}

/** Pure: a Google Slides/Docs/Drive viewer page for an actual file ("<name> - Google Slides" etc.). */
export function looksLikeSharedGoogleFile(html: string): boolean {
  return /<title>[^<]*\S[^<]*\s-\s(Google (Slides|Docs|Drive|Sheets))\s*<\/title>/i.test(html);
}

async function readStart(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, merged.length - offset);
    merged.set(c.subarray(0, take), offset);
    offset += take;
    if (offset >= merged.length) break;
  }
  return new TextDecoder().decode(merged);
}

export async function checkDeck(deckUrl: string): Promise<DeckStatus> {
  const target = probeTarget(deckUrl);
  if (!target) return "unknown";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MetaTwinDeckCheck/1.0; +https://metatwin.metaglobetechnologies.co.ke)" },
    });
    if (target.kind === "youtube") {
      res.body?.cancel().catch(() => {});
      return classifyYouTubeResponse(res.status);
    }
    const status = classifyGoogleResponse(res.status, res.headers.get("location"));
    if (status !== "public") {
      res.body?.cancel().catch(() => {});
      return status;
    }
    // A 200 can still be a sign-in / "request access" page: look at the start of it only.
    // Fail safe: say "public" only when the page positively looks like a shared Google
    // file; anything ambiguous is "unknown" (the student is asked to check it themselves),
    // never a false "anyone can view".
    const head = await readStart(res, 64 * 1024);
    if (looksLikeSignInPage(head)) return "restricted";
    return looksLikeSharedGoogleFile(head) ? "public" : "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

// Best-effort per-isolate limit: 20 checks per student per 10 minutes.
const hits = new Map<string, number[]>();
function limited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 20;
}

export async function handleCheckDeck(request: Request): Promise<Response> {
  const auth = await authenticateTwin(request, "Sign in to check your deck.");
  if (auth instanceof Response) return auth;
  if (limited(auth)) return json(429, { error: "Too many checks. Try again in a few minutes." });

  let body: { project_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  const ownership = await checkOwnsRow("projects", projectId, auth, "Project not found.", "You can only check your own project.");
  if (ownership) return ownership;

  const { data: project, error } = await supabaseAdmin.from("projects").select("pitch_deck_url").eq("id", projectId).maybeSingle();
  if (error) return json(500, { error: error.message });
  const deckUrl = project?.pitch_deck_url ?? null;
  if (!deckUrl) return json(400, { error: "Add a pitch deck link first." });

  const status = await checkDeck(deckUrl);
  const checkedAt = new Date().toISOString();
  // Only record it if the link wasn't changed while we were checking.
  const { error: writeError } = await supabaseAdmin
    .from("projects")
    .update({ pitch_deck_status: status, pitch_deck_checked_at: checkedAt })
    .eq("id", projectId)
    .eq("pitch_deck_url", deckUrl);
  if (writeError) return json(500, { error: writeError.message });
  return json(200, { status, checked_at: checkedAt });
}
