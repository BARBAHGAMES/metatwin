// Invoked by the `notify_new_user_webhook` trigger on `auth.users` (pg_net POST
// with "Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>", secret held in
// Supabase Vault). The trigger fires only once an address is CONFIRMED (an
// UPDATE of email_confirmed_at from null, or an INSERT that is already
// confirmed) — never on a bare signup — so nobody can make us email a
// stranger's address just by typing it into the signup form. Verification
// itself is Supabase Auth's own "Confirm signup" email; this route only sends
// the separate welcome email via Resend's direct API.
import { sendResendEmail } from "./resend-send.server";

export const NEW_USER_WEBHOOK_PATH = "/api/webhooks/new-user";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Constant-time string comparison: hash both sides to equal-length digests,
// then XOR every byte, so timing leaks neither the secret nor its length.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const xa = new Uint8Array(da);
  const xb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ xb[i];
  return diff === 0;
}

function welcomeEmailHtml(email: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1>Welcome to MetaTwin</h1>
      <p>Hi,</p>
      <p>Your email (${escapeHtml(email)}) is confirmed and your MetaTwin account is ready.
      Sign in to start building your twin: capabilities, projects, and the evidence
      that backs them up.</p>
      <p>— The MetaTwin team</p>
    </div>
  `;
}

export async function handleNewUserWebhook(request: Request): Promise<Response> {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || !(await safeEqual(authHeader, `Bearer ${secret}`))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { record?: { email?: string } };
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const email = payload.record?.email;
  if (typeof email !== "string" || !email) {
    return new Response("Bad request: no email in payload", { status: 400 });
  }

  await sendResendEmail(email, "Welcome to MetaTwin", welcomeEmailHtml(email), "welcome-email");
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
