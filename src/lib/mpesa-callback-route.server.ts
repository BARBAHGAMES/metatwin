// Safaricom POSTs here with the real payment result, asynchronously, some
// time after /api/payments/mpesa/initiate (mpesa-route.server.ts) started
// the STK push. Safaricom can't send our bearer secret, so this route's
// authentication is implicit: the payload must reference a `payments` row
// that already exists in 'pending' state by its unique
// mpesa_checkout_request_id, which Safaricom itself generated during
// initiate and simply echoes back — not something a third party could guess
// without first going through our own authenticated initiate route. Always
// acks with ResultCode 0 regardless of the payment's own outcome; that's
// Daraja's own requirement for "I received your callback," unrelated to
// whether the payment succeeded.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type StkCallbackItem = { Name: string; Value?: string | number };
type StkCallbackBody = {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: { Item: StkCallbackItem[] };
    };
  };
};

const ACK = { ResultCode: 0, ResultDesc: "Success" };

function metadataValue(items: StkCallbackItem[] | undefined, name: string): string | number | undefined {
  return items?.find((i) => i.Name === name)?.Value;
}

export async function handleMpesaCallback(request: Request): Promise<Response> {
  let payload: StkCallbackBody;
  try {
    payload = await request.json();
  } catch {
    // Still ack — a malformed callback isn't something Safaricom should retry forever.
    return new Response(JSON.stringify(ACK), { status: 200, headers: { "content-type": "application/json" } });
  }

  const callback = payload.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) {
    return new Response(JSON.stringify(ACK), { status: 200, headers: { "content-type": "application/json" } });
  }

  const { data: payment, error: lookupError } = await supabaseAdmin
    .from("payments")
    .select("id, twin_id, team_id, plan_tier, plan_package, status")
    .eq("mpesa_checkout_request_id", callback.CheckoutRequestID)
    .maybeSingle();

  if (lookupError || !payment) {
    console.error("[mpesa callback] unknown CheckoutRequestID:", callback.CheckoutRequestID);
    return new Response(JSON.stringify(ACK), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (payment.status !== "pending") {
    // Idempotent: a duplicate/retried callback for an already-resolved
    // payment is a no-op, same spirit as the pitch-score webhook's
    // duplicate form_response_id handling.
    return new Response(JSON.stringify(ACK), { status: 200, headers: { "content-type": "application/json" } });
  }

  if (callback.ResultCode === 0) {
    const receiptNumber = metadataValue(callback.CallbackMetadata?.Item, "MpesaReceiptNumber");
    const { error: updatePaymentError } = await supabaseAdmin
      .from("payments")
      .update({ status: "success", mpesa_receipt_number: receiptNumber ? String(receiptNumber) : null, result_desc: callback.ResultDesc, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (updatePaymentError) console.error("[mpesa callback] payment update failed:", updatePaymentError.message);

    if (payment.twin_id) {
      const { data: twin } = await supabaseAdmin.from("twins").select("plan_status, plan_paid_until").eq("id", payment.twin_id).maybeSingle();
      const currentExpiry = twin?.plan_status === "paid" && twin.plan_paid_until ? new Date(twin.plan_paid_until) : null;
      const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
      const newExpiry = new Date(base);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);

      const { error: updateTwinError } = await supabaseAdmin
        .from("twins")
        .update({ plan_status: "paid", plan_tier: payment.plan_tier ?? "basic", plan_paid_until: newExpiry.toISOString() })
        .eq("id", payment.twin_id);
      if (updateTwinError) console.error("[mpesa callback] twin plan update failed:", updateTwinError.message);
    } else if (payment.team_id) {
      const { data: team } = await supabaseAdmin.from("teams").select("plan_status, plan_paid_until").eq("id", payment.team_id).maybeSingle();
      const currentExpiry = team?.plan_status === "paid" && team.plan_paid_until ? new Date(team.plan_paid_until) : null;
      const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
      const newExpiry = new Date(base);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);

      const { error: updateTeamError } = await supabaseAdmin
        .from("teams")
        .update({ plan_status: "paid", plan_tier: payment.plan_tier, plan_package: payment.plan_package, plan_paid_until: newExpiry.toISOString() })
        .eq("id", payment.team_id);
      if (updateTeamError) console.error("[mpesa callback] team plan update failed:", updateTeamError.message);
    }
  } else {
    const { error: updatePaymentError } = await supabaseAdmin
      .from("payments")
      .update({ status: "failed", result_desc: callback.ResultDesc, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (updatePaymentError) console.error("[mpesa callback] payment update failed:", updatePaymentError.message);
  }

  return new Response(JSON.stringify(ACK), { status: 200, headers: { "content-type": "application/json" } });
}
