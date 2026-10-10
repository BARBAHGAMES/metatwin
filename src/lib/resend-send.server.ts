// Never-throw transactional send via Resend's direct Send API. A failed
// welcome email must never fail the signup it's confirming.
export async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  label: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[${label}] RESEND_API_KEY not set — skipping send`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: "MetaTwin <hello@metatwin.metaglobe.co.ke>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[${label}] send failed:`, res.status, await res.text());
    }
  } catch (err) {
    console.error(`[${label}] send threw:`, err);
  }
}
