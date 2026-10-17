// Visitor feedback routes (pitch flow Release A):
//   POST /api/feedback/submit   — public; validates, Turnstile-checks, stores the
//                                 feedback as pending and emails a one-time confirm link.
//   POST /api/feedback/confirm  — public; confirms via the token from that link.
// All writes go through service_role-only SECURITY DEFINER functions
// (submit_project_feedback / confirm_project_feedback); the raw token is never
// stored, only its SHA-256.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendResendEmail } from "./resend-send.server";
import { escapeHtml } from "./new-user-webhook-route.server";
import { CONFIRM_TOKEN_PATTERN, validateFeedback, type FeedbackInput } from "./visitor-feedback";
import { FEEDBACK_CONFIRM_PAGE } from "./api-paths";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Best-effort per-isolate limits (Workers don't share memory); the database
// function adds a per-email brake that holds across isolates.
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function newConfirmToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cloudflare Turnstile. Enforced only when TURNSTILE_SECRET_KEY is configured. */
async function turnstileOk(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function confirmEmailHtml(opts: { reviewerName: string; studentName: string; projectTitle: string; link: string; isUpdate: boolean }): string {
  const name = escapeHtml(opts.reviewerName);
  const student = escapeHtml(opts.studentName);
  const project = escapeHtml(opts.projectTitle);
  const link = escapeHtml(opts.link);
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${name},</p>
<p>Thanks for ${opts.isUpdate ? "updating your" : "giving"} feedback on <strong>${student}</strong>'s project <strong>${project}</strong> on MetaTwin.</p>
<p>Please confirm it's you so ${student} can see it:</p>
<p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Confirm my feedback</a></p>
<p style="font-size:13px;color:#475569">This link works once and expires in 48 hours. If you didn't do this, ignore this email and nothing will be shown.</p>
<p style="font-size:13px;color:#475569">MetaTwin keeps your email and WhatsApp number private: MetaTwin admins can see them to prevent abuse, and your email is shared with the student only if you agreed to that. They're deleted after 12 months.</p>
</body></html>`;
}

const ERROR_MESSAGES: Record<string, [number, string]> = {
  project_not_found: [404, "This project isn't taking feedback right now."],
  own_project: [400, "You can't leave feedback on your own project."],
  rate_limited: [429, "We've just sent a confirmation to this email. Please wait a minute (or check your inbox) before sending more."],
};

const PRODUCTION_ORIGIN = "https://metatwin.metaglobetechnologies.co.ke";

/**
 * Origin for links in emails. Never trust the incoming host blindly: the Worker
 * may also answer on a workers.dev or preview hostname. Local dev keeps its
 * own origin so the flow can be tested end to end.
 */
export function emailLinkOrigin(requestUrl: string): string {
  const { origin, hostname } = new URL(requestUrl);
  if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
  return process.env.PUBLIC_SITE_URL ?? PRODUCTION_ORIGIN;
}

export async function handleFeedbackSubmit(request: Request): Promise<Response> {
  const ip = clientIp(request);
  if (rateLimited(`fb-submit:${ip}`, 8)) return json(429, { error: "Too many submissions. Try again later." });

  let body: Partial<FeedbackInput> & { turnstileToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const parsed = validateFeedback({
    handle: String(body.handle ?? ""),
    projectId: String(body.projectId ?? ""),
    rating: Number(body.rating),
    comment: String(body.comment ?? ""),
    name: String(body.name ?? ""),
    role: String(body.role ?? ""),
    org: String(body.org ?? ""),
    email: String(body.email ?? ""),
    whatsapp: String(body.whatsapp ?? ""),
    consent: body.consent === true,
  });
  if (!parsed.ok) return json(400, { error: "Check the highlighted fields.", fields: parsed.errors });
  const v = parsed.value;

  if (!(await turnstileOk(body.turnstileToken, ip))) return json(400, { error: "Please complete the security check and try again." });
  if (rateLimited(`fb-project:${ip}:${v.projectId}`, 3)) return json(429, { error: "Too many submissions for this project. Try again later." });

  const token = newConfirmToken();
  const { data, error } = await supabaseAdmin.rpc("submit_project_feedback", {
    p_handle: v.handle,
    p_project_id: v.projectId,
    p_rating: v.rating,
    p_comment: v.comment,
    p_name: v.name,
    p_role: v.role,
    p_org: v.org,
    p_email: v.email,
    p_whatsapp: v.whatsapp,
    p_consent: v.consent,
    p_token_hash: await sha256Hex(token),
  });
  if (error) {
    const known = Object.entries(ERROR_MESSAGES).find(([code]) => error.message.includes(code));
    if (known) return json(known[1][0], { error: known[1][1] });
    if (error.code === "23514") return json(400, { error: "Check the highlighted fields." });
    // Two first submissions from the same email for the same project at the same moment.
    if (error.code === "23505") return json(409, { error: "We're already processing feedback from this email. Check your inbox." });
    console.error("[feedback submit]", error.message);
    return json(500, { error: "Couldn't save your feedback. Try again." });
  }

  const result = data as { student_name: string | null; project_title: string; is_update: boolean };
  const link = `${emailLinkOrigin(request.url)}${FEEDBACK_CONFIRM_PAGE}/${token}`;
  await sendResendEmail(
    v.email,
    `Confirm your feedback on ${result.student_name ?? "a student"}'s project`,
    confirmEmailHtml({ reviewerName: v.name, studentName: result.student_name ?? "the student", projectTitle: result.project_title, link, isUpdate: result.is_update }),
    "feedback-confirm",
  );

  // Retention runs lazily on activity (also schedule it; see the migration header / runbook).
  const { error: purgeError } = await supabaseAdmin.rpc("purge_expired_feedback_data");
  if (purgeError) console.error("[feedback purge]", purgeError.message);

  return json(200, { ok: true, isUpdate: result.is_update });
}

export async function handleFeedbackConfirm(request: Request): Promise<Response> {
  const ip = clientIp(request);
  if (rateLimited(`fb-confirm:${ip}`, 20)) return json(429, { status: "rate_limited" });
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { status: "invalid" });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!CONFIRM_TOKEN_PATTERN.test(token)) return json(400, { status: "invalid" });

  const { data, error } = await supabaseAdmin.rpc("confirm_project_feedback", { p_token_hash: await sha256Hex(token) });
  if (error) {
    console.error("[feedback confirm]", error.message);
    return json(500, { status: "error" });
  }
  const result = data as { status: string; handle?: string; project_title?: string };
  return json(result.status === "confirmed" ? 200 : 400, result);
}
