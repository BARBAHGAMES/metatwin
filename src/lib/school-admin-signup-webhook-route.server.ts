// Invoked by the `notify_school_admin_signup_webhook` trigger on
// `school_admins` (pg_net POST with "Authorization: Bearer
// <SUPABASE_WEBHOOK_SECRET>", same secret and pattern as
// partnership-inquiry-webhook-route.server.ts). Every new school_admins row
// starts 'pending' — this just emails Andrew so he knows to go verify it
// manually (no in-app approval queue at this pilot scale).
import { sendResendEmail } from "./resend-send.server";
import { escapeHtml, safeEqual } from "./new-user-webhook-route.server";

export const SCHOOL_ADMIN_NOTIFY_ADDRESS = "andrew@metaglobetechnologies.co.ke";

type SchoolAdminSignupRecord = {
  full_name?: string;
  email?: string;
  phone?: string;
  university_name?: string | null;
  requested_at?: string;
};

function signupEmailHtml(r: SchoolAdminSignupRecord): string {
  const row = (label: string, value: string | null | undefined) =>
    value ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>` : "";
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h1>New school admin signup — pending verification</h1>
      ${row("Name", r.full_name)}
      ${row("Email", r.email)}
      ${row("Phone", r.phone)}
      ${row("Campus", r.university_name)}
      <p style="color:#666;font-size:12px;">Verify in Supabase: update school_admins set status = 'verified', verified_at = now() where id = '...'.</p>
    </div>
  `;
}

export async function handleSchoolAdminSignupWebhook(request: Request): Promise<Response> {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || !(await safeEqual(authHeader, `Bearer ${secret}`))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { record?: SchoolAdminSignupRecord };
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
    SCHOOL_ADMIN_NOTIFY_ADDRESS,
    `School admin signup: ${record.full_name}`,
    signupEmailHtml(record),
    "school-admin-signup",
  );
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
