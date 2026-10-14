// Invoked by the `notify_platform_admin_signup_webhook` trigger on
// `platform_admins` (pg_net POST with "Authorization: Bearer
// <SUPABASE_WEBHOOK_SECRET>", same secret and pattern as
// school-admin-signup-webhook-route.server.ts). Every new platform_admins row
// starts 'pending' — this just emails Andrew so he knows to go verify it
// manually (no in-app approval queue at this scale, and this role is
// invite-only to begin with — the email allowlist in handle_new_user is the
// real gate, this is just the notification).
import { sendResendEmail } from "./resend-send.server";
import { escapeHtml, safeEqual } from "./new-user-webhook-route.server";

export const PLATFORM_ADMIN_NOTIFY_ADDRESS = "andrew@metaglobetechnologies.co.ke";

type PlatformAdminSignupRecord = {
  full_name?: string;
  email?: string;
  requested_at?: string;
};

function signupEmailHtml(r: PlatformAdminSignupRecord): string {
  const row = (label: string, value: string | null | undefined) =>
    value ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>` : "";
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h1>New platform admin signup — pending verification</h1>
      ${row("Name", r.full_name)}
      ${row("Email", r.email)}
      <p style="color:#666;font-size:12px;">Verify in Supabase: update platform_admins set status = 'verified', verified_at = now() where id = '...'.</p>
    </div>
  `;
}

export async function handlePlatformAdminSignupWebhook(request: Request): Promise<Response> {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || !(await safeEqual(authHeader, `Bearer ${secret}`))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { record?: PlatformAdminSignupRecord };
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const record = payload.record;
  if (!record?.full_name || !record.email) {
    return new Response("Bad request: incomplete record in payload", { status: 400 });
  }

  await sendResendEmail(
    PLATFORM_ADMIN_NOTIFY_ADDRESS,
    `Platform admin signup: ${record.full_name}`,
    signupEmailHtml(record),
    "platform-admin-signup",
  );
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
