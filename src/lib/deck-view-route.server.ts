// Deck view recording (pitch flow Release A).
//   POST /api/projects/deck-view { handle, project_id }
// Called when a visitor opens a pitch deck on a public MetaTwin. Stores only a
// daily-rotating salted hash of (IP + user agent) for de-duplication and the
// country code Cloudflare supplies; nothing reversible, nothing that links a
// visitor across days. The student sees counts, never visitors.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse/i;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Daily visitor hash. The salt is a Worker secret, so hashes can't be recomputed from a guessed IP. */
export async function visitorHash(ip: string, userAgent: string, day: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}|${day}|${ip}|${userAgent}`);
}

// Best-effort per-isolate limit: 30 deck opens per IP per 10 minutes.
const hits = new Map<string, number[]>();
function limited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 30;
}

/** True when a signed-in caller owns the project (the student's own opens aren't views). */
async function isOwnerView(request: Request, projectId: string): Promise<boolean> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return false;
  const { data } = await supabaseAdmin.from("projects").select("twin_id").eq("id", projectId).maybeSingle();
  return data?.twin_id === userId;
}

export async function handleDeckView(request: Request): Promise<Response> {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOTS.test(ua)) return json(200, { counted: false });

  let body: { handle?: unknown; project_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!handle || handle.length > 30 || !UUID.test(projectId)) return json(400, { error: "Bad request" });

  const salt = process.env.DECK_VIEW_SALT ?? process.env.SUPABASE_WEBHOOK_SECRET;
  if (!salt) {
    console.error("[deck-view] no DECK_VIEW_SALT configured, skipping");
    return json(200, { counted: false });
  }
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`deck-view:${ip}`)) return json(200, { counted: false });
  if (await isOwnerView(request, projectId)) return json(200, { counted: false, owner: true });
  const day = new Date().toISOString().slice(0, 10);
  const country = (request.headers.get("cf-ipcountry") ?? "").toUpperCase();

  const { data, error } = await supabaseAdmin.rpc("record_deck_view", {
    p_handle: handle,
    p_project_id: projectId,
    p_visitor_hash: await visitorHash(ip, ua, day, salt),
    p_country: /^[A-Z]{2}$/.test(country) && country !== "XX" && country !== "T1" ? country : "",
  });
  if (error) {
    console.error("[deck-view]", error.message);
    return json(200, { counted: false });
  }
  return json(200, { counted: data === true });
}
