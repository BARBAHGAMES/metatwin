// AI chat + opportunity scout, via Cloudflare Workers AI (env.AI binding —
// first-party, no API key). Both endpoints build a short text "dossier" from
// already-visible data and ask the model to answer only from it — never
// invent facts, never fabricate company names or deadlines.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PublicProfile } from "./public-profile";

const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

// Workers AI's `env.AI` binding isn't a plain string, so it can't flow
// through process.env the way secrets do — it has to come from the
// Cloudflare fetch handler's own `env` argument.
type AiBinding = { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string } | string> };
export type CloudflareEnv = { AI?: AiBinding };

// Per-isolate, best-effort only (Workers don't share memory across
// instances) — enough to blunt casual abuse of a feature that costs real
// inference time per call, not a hard guarantee.
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 12;
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}
function clientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
}

async function runModel(ai: AiBinding, system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const result = await ai.run(CHAT_MODEL, { messages: [{ role: "system", content: system }, ...messages] });
  if (typeof result === "string") return result;
  return result.response ?? "";
}

function dossierFromPublicProfile(p: PublicProfile): { first: string; text: string } {
  const first = p.name?.split(" ")[0] ?? "this person";
  const lines = [
    `Name: ${p.name ?? "unknown"}`,
    `Headline: ${p.headline ?? ""}`,
    `Institution / programme: ${[p.institution, p.programme].filter(Boolean).join(", ")}`,
    `Capabilities: ${p.capabilities.map((c) => `${c.skill} (evidence items: ${c.evidence.length})`).join("; ") || "none listed yet"}`,
    `Projects: ${p.projects.map((proj) => `${proj.title}${proj.description ? ` — ${proj.description}` : ""}`).join("; ") || "none listed yet"}`,
  ];
  return { first, text: lines.join("\n") };
}

export async function handleTwinChat(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!env.AI) {
    return new Response(JSON.stringify({ error: "AI is not configured on this deployment." }), { status: 503, headers: { "content-type": "application/json" } });
  }
  if (rateLimited(`chat:${clientKey(request)}`)) {
    return new Response(JSON.stringify({ error: "Too many questions right now — try again in a few minutes." }), { status: 429, headers: { "content-type": "application/json" } });
  }

  let body: { handle?: unknown; messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  const messages = Array.isArray(body.messages) ? (body.messages as { role: string; content: string }[]) : [];
  const lastUserMessages = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 1500)
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  if (!handle || lastUserMessages.length === 0) {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const { data, error } = await supabaseAdmin.rpc("get_public_profile", { p_handle: handle });
  if (error || !data) {
    return new Response(JSON.stringify({ error: "This MetaTwin isn't available." }), { status: 404, headers: { "content-type": "application/json" } });
  }
  const { first, text } = dossierFromPublicProfile(data as PublicProfile);
  const system = `You are the MetaTwin of ${first}: a first-person AI representative answering questions from visitors (recruiters, clients, mentors). Speak as "I" ("${first}" if a third person is more natural). Be warm, confident and concise — under 120 words. Only use the facts below; never invent skills, employers, grades, scores or numbers that aren't listed. If something isn't covered, say so plainly rather than guessing.\n\nFACTS:\n${text}`;

  try {
    const reply = await runModel(env.AI, system, lastUserMessages);
    return new Response(JSON.stringify({ reply }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("[twin-chat]", err);
    return new Response(JSON.stringify({ error: "The AI couldn't answer just now." }), { status: 502, headers: { "content-type": "application/json" } });
  }
}

type OpportunityIdea = { title: string; type: string; why: string; next_step: string; gap: string };

export async function handleOpportunitiesScout(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!env.AI) {
    return new Response(JSON.stringify({ error: "AI is not configured on this deployment." }), { status: 503, headers: { "content-type": "application/json" } });
  }

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Sign in to use the opportunities scout." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Sign in to use the opportunities scout." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const twinId = userData.user.id;

  if (rateLimited(`scout:${twinId}`)) {
    return new Response(JSON.stringify({ error: "Too many requests — try again in a few minutes." }), { status: 429, headers: { "content-type": "application/json" } });
  }

  const [twinRes, compRes, evRes, reviewRes, projRes] = await Promise.all([
    supabaseAdmin.from("twins").select("name, first_name, headline, institution, programme, development_goal, fields_of_interest").eq("id", twinId).maybeSingle(),
    supabaseAdmin.from("competencies").select("id, evidence_count, skills(name)").eq("twin_id", twinId),
    supabaseAdmin.from("evidence").select("id, competency_id, title").eq("twin_id", twinId),
    supabaseAdmin.from("evidence_reviews").select("evidence_id").eq("twin_id", twinId).not("submitted_at", "is", null),
    supabaseAdmin.from("projects").select("title, description").eq("twin_id", twinId),
  ]);
  if (twinRes.error || compRes.error || evRes.error || reviewRes.error || projRes.error || !twinRes.data) {
    return new Response(JSON.stringify({ error: "Finish your profile first." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const reviewedEvidenceIds = new Set((reviewRes.data ?? []).map((r) => r.evidence_id));
  const evidenceByCompetency = new Map<string, { id: string }[]>();
  for (const e of evRes.data ?? []) {
    const list = evidenceByCompetency.get(e.competency_id) ?? [];
    list.push({ id: e.id });
    evidenceByCompetency.set(e.competency_id, list);
  }
  const skillLines = (compRes.data ?? []).map((c) => {
    const items = evidenceByCompetency.get(c.id) ?? [];
    const status = items.some((i) => reviewedEvidenceIds.has(i.id)) ? "Reviewed" : c.evidence_count > 0 ? "Evidence Added" : "Self-Reported";
    const name = (c.skills as { name: string } | null)?.name ?? "skill";
    return `${name} (${status})`;
  });
  const twin = twinRes.data;
  const text = [
    `Name: ${twin.name ?? twin.first_name ?? "this student"}`,
    `Headline: ${twin.headline ?? ""}`,
    `Institution / programme: ${[twin.institution, twin.programme].filter(Boolean).join(", ")}`,
    `Skills: ${skillLines.join("; ") || "none listed yet"}`,
    `Projects: ${(projRes.data ?? []).map((p) => `${p.title}${p.description ? ` — ${p.description}` : ""}`).join("; ") || "none listed yet"}`,
    `Looking for: ${(twin.fields_of_interest ?? []).join(", ") || "not specified"}`,
    `Goal: ${twin.development_goal ?? "not specified"}`,
  ].join("\n");

  const system = `You are a career scout for young Kenyan talent on MetaTwin. Based only on the profile below, suggest up to 5 concrete opportunity types to pursue now (internships, freelance gigs, competitions, grants, roles, accelerators) — realistic for Kenya/remote work. Never name specific real companies or invent deadlines. Respond with ONLY a JSON object, no other text: {"items":[{"title":"","type":"Internship|Freelance|Competition|Grant|Role|Accelerator","why":"one sentence tying to their skills/projects","next_step":"one concrete action","gap":"one skill or proof worth adding, or empty string"}]}\n\nPROFILE:\n${text}`;

  try {
    const raw = await runModel(env.AI, system, [{ role: "user", content: "Suggest opportunities." }]);
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? "{}") as { items?: OpportunityIdea[] };
    return new Response(JSON.stringify({ items: (parsed.items ?? []).slice(0, 5) }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("[opportunities-scout]", err);
    return new Response(JSON.stringify({ error: "Couldn't generate suggestions. Try again." }), { status: 502, headers: { "content-type": "application/json" } });
  }
}
