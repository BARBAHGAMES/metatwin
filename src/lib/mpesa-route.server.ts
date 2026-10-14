// M-Pesa Daraja STK Push — initiate + status-poll routes. The actual
// payment result lands asynchronously via mpesa-callback-route.server.ts
// (Safaricom POSTs there, not here), so "initiate" only ever creates a
// 'pending' payments row; "status" just reads it back.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { individualPlans } from "./pricing";

const BASIC_PLAN_PRICE = individualPlans.find((p) => p.id === "basic")!.price;

const DARAJA_BASE_URL = "https://sandbox.safaricom.co.ke";
const CALLBACK_URL = "https://metatwin.metaglobetechnologies.co.ke/api/webhooks/mpesa-callback";

async function authenticateTwin(request: Request): Promise<string | Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Sign in to pay." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Sign in to pay." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return userData.user.id;
}

// Accepts 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX (and the 01
// equivalents) and normalizes to the MSISDN format Daraja requires:
// 2547XXXXXXXX / 2541XXXXXXXX, no plus, no leading zero.
export function normalizeKenyanMsisdn(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  let msisdn: string;
  if (digits.startsWith("254")) msisdn = digits;
  else if (digits.startsWith("0")) msisdn = `254${digits.slice(1)}`;
  else if (digits.startsWith("7") || digits.startsWith("1")) msisdn = `254${digits}`;
  else return null;
  return /^254[71]\d{8}$/.test(msisdn) ? msisdn : null;
}

// Daraja timestamps are in Africa/Nairobi local time (UTC+3, no DST).
function darajaTimestamp(): string {
  const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${eat.getUTCFullYear()}${pad(eat.getUTCMonth() + 1)}${pad(eat.getUTCDate())}${pad(eat.getUTCHours())}${pad(eat.getUTCMinutes())}${pad(eat.getUTCSeconds())}`;
}

async function getDarajaAccessToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) throw new Error("M-Pesa isn't configured yet (missing MPESA_CONSUMER_KEY/MPESA_CONSUMER_SECRET).");
  const basic = btoa(`${consumerKey}:${consumerSecret}`);
  const res = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Daraja OAuth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function handleMpesaInitiate(request: Request): Promise<Response> {
  const authResult = await authenticateTwin(request);
  if (authResult instanceof Response) return authResult;
  const twinId = authResult;

  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const msisdn = body.phone ? normalizeKenyanMsisdn(body.phone) : null;
  if (!msisdn) {
    return new Response(JSON.stringify({ error: "Enter a valid Kenyan phone number (e.g. 07XXXXXXXX)." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  if (!shortcode || !passkey) {
    return new Response(JSON.stringify({ error: "M-Pesa isn't configured yet." }), { status: 500, headers: { "content-type": "application/json" } });
  }

  let accessToken: string;
  try {
    accessToken = await getDarajaAccessToken();
  } catch (err) {
    console.error("[mpesa initiate] OAuth failed:", err);
    return new Response(JSON.stringify({ error: "Couldn't reach M-Pesa. Try again shortly." }), { status: 502, headers: { "content-type": "application/json" } });
  }

  const timestamp = darajaTimestamp();
  const password = btoa(`${shortcode}${passkey}${timestamp}`);

  const stkRes = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: BASIC_PLAN_PRICE,
      PartyA: msisdn,
      PartyB: shortcode,
      PhoneNumber: msisdn,
      CallBackURL: CALLBACK_URL,
      AccountReference: twinId,
      TransactionDesc: "MetaTwin Basic annual plan",
    }),
  });
  const stkData = (await stkRes.json()) as {
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    ResponseCode?: string;
    errorMessage?: string;
  };
  if (!stkRes.ok || !stkData.CheckoutRequestID || !stkData.MerchantRequestID) {
    console.error("[mpesa initiate] STK push failed:", stkData);
    return new Response(JSON.stringify({ error: stkData.errorMessage ?? "Couldn't start the M-Pesa prompt. Try again." }), { status: 502, headers: { "content-type": "application/json" } });
  }

  const { error: insertError } = await supabaseAdmin.from("payments").insert({
    twin_id: twinId,
    phone: msisdn,
    amount: BASIC_PLAN_PRICE,
    mpesa_merchant_request_id: stkData.MerchantRequestID,
    mpesa_checkout_request_id: stkData.CheckoutRequestID,
    status: "pending",
  });
  if (insertError) {
    console.error("[mpesa initiate] payments insert failed:", insertError.message);
    return new Response(JSON.stringify({ error: "Something went wrong recording the payment." }), { status: 500, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify({ checkout_request_id: stkData.CheckoutRequestID }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function handleMpesaStatus(request: Request): Promise<Response> {
  const authResult = await authenticateTwin(request);
  if (authResult instanceof Response) return authResult;
  const twinId = authResult;

  const url = new URL(request.url);
  const checkoutRequestId = url.searchParams.get("checkout_request_id");
  if (!checkoutRequestId) {
    return new Response(JSON.stringify({ error: "Missing checkout_request_id" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("twin_id, status")
    .eq("mpesa_checkout_request_id", checkoutRequestId)
    .maybeSingle();
  if (error || !data || data.twin_id !== twinId) {
    // Scoped to the caller's own payment — a service-role read bypasses RLS,
    // so this check has to live here in the route, not the database.
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify({ status: data.status }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
