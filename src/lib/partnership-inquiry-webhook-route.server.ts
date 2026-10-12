// Invoked by the `notify_partnership_inquiry_webhook` trigger on
// `partnership_inquiries` (pg_net POST with "Authorization: Bearer
// <SUPABASE_WEBHOOK_SECRET>", same secret and pattern as
// new-user-webhook-route.server.ts). Fires once per inquiry, right after the
// `submit_partnership_inquiry` RPC inserts it — this route only sends the
// internal notification email via Resend; the inquiry itself is already
// safely in the database regardless of whether this email succeeds.
import { sendResendEmail } from "./resend-send.server";
import { escapeHtml, safeEqual } from "./new-user-webhook-route.server";

export const PARTNERSHIP_INQUIRY_NOTIFY_ADDRESS = "andrew@metaglobetechnologies.co.ke";

type PartnershipInquiryRecord = {
  institution_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string | null;
  message?: string | null;
  created_at?: string;
};

function inquiryEmailHtml(r: PartnershipInquiryRecord): string {
  const row = (label: string, value: string | null | undefined) =>
    value ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>` : "";
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h1>New institutional partnership inquiry</h1>
      ${row("Institution", r.institution_name)}
      ${row("Contact", r.contact_name)}
      ${row("Email", r.email)}
      ${row("Phone", r.phone)}
      ${r.message ? `<p><strong>Message:</strong></p><p>${escapeHtml(r.message).replace(/\n/g, "<br>")}</p>` : ""}
      <p style="color:#666;font-size:12px;">Logged in partnership_inquiries — reply directly to the contact's email above.</p>
    </div>
  `;
}

export async function handlePartnershipInquiryWebhook(request: Request): Promise<Response> {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || !(await safeEqual(authHeader, `Bearer ${secret}`))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { record?: PartnershipInquiryRecord };
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const record = payload.record;
  if (!record?.institution_name || !record.contact_name || !record.email) {
    return new Response("Bad request: incomplete record in payload", { status: 400 });
  }

  await sendResendEmail(
    PARTNERSHIP_INQUIRY_NOTIFY_ADDRESS,
    `Partnership inquiry: ${record.institution_name}`,
    inquiryEmailHtml(record),
    "partnership-inquiry",
    record.email,
  );
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
