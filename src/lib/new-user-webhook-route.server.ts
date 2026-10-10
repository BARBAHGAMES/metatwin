// Invoked by a Supabase Database Webhook on `auth.users` INSERT (configure
// in Supabase dashboard -> Database -> Webhooks, pointing at
// https://metatwin.metaglobe.co.ke/api/webhooks/new-user, header
// "Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>"). Verification email
// itself is Supabase Auth's own "Confirm signup" template, sent through
// Custom SMTP (Resend) configured in the dashboard — this route only sends
// the separate welcome email via Resend's direct API.
import { sendResendEmail } from "./resend-send.server";

export const NEW_USER_WEBHOOK_PATH = "/api/webhooks/new-user";

function welcomeEmailHtml(email: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1>Welcome to MetaTwin</h1>
      <p>Hi,</p>
      <p>Your MetaTwin account (${email}) is ready. Confirm your email using the link we just
      sent separately, then sign in to start building your twin: courses, projects,
      competencies, and the evidence that backs them up.</p>
      <p>— The MetaTwin team</p>
    </div>
  `;
}

export async function handleNewUserWebhook(request: Request): Promise<Response> {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { record?: { email?: string } };
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const email = payload.record?.email;
  if (!email) return new Response("Bad request: no email in payload", { status: 400 });

  await sendResendEmail(email, "Welcome to MetaTwin", welcomeEmailHtml(email), "welcome-email");
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
