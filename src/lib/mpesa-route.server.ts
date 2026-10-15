// M-Pesa Daraja STK Push — initiate + status-poll routes. The actual
// payment result lands asynchronously via mpesa-callback-route.server.ts
// (Safaricom POSTs there, not here), so "initiate" only ever creates a
// 'pending' payments row; "status" just reads it back.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { individualPlans, teamPackages, teamTiers, teamTierPrice } from "./pricing";
import type { MpesaTier as Tier, MpesaPackage as Package, MpesaProduct as Product } from "./api-paths";
import { authenticateTwin } from "./authenticate-twin.server";

function individualPrice(tier: Tier): number | null {
  return individualPlans.find((p) => p.id === tier)?.price ?? null;
}

function teamPrice(pkg: Package, tier: Tier): number | null {
  const p = teamPackages.find((x) => x.id === pkg);
  const t = teamTiers.find((x) => x.id === tier);
  return p && t ? teamTierPrice(p, t) : null;
}

// Optional ops lever, not a pricing change: lets a real STK push be tested
// end-to-end (including against a real phone / a future real paybill)
// without actually moving the real listed price each time. Unset in normal
// operation — falls back to the real price for whatever was requested.
// Never shown to the client; the UI always quotes the real price regardless.
function chargeAmount(realPrice: number): number {
  const override = Number(process.env.MPESA_TEST_AMOUNT);
  return Number.isFinite(override) && override > 0 ? override : realPrice;
}

const DARAJA_BASE_URL = "https://sandbox.safaricom.co.ke";
const CALLBACK_URL = "https://metatwin.metaglobetechnologies.co.ke/api/webhooks/mpesa-callback";

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

const TIER_NAMES: Record<Tier, string> = { basic: "Basic", guided: "Guided", builder: "Builder" };
const PACKAGE_NAMES: Record<Package, string> = { duo: "Duo", studio: "Studio", launch: "Launch" };

export async function handleMpesaInitiate(request: Request): Promise<Response> {
  const authResult = await authenticateTwin(request, "Sign in to pay.");
  if (authResult instanceof Response) return authResult;
  const callerId = authResult;

  let body: { phone?: string; product?: Product };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const msisdn = body.phone ? normalizeKenyanMsisdn(body.phone) : null;
  if (!msisdn) {
    return new Response(JSON.stringify({ error: "Enter a valid Kenyan phone number (e.g. 07XXXXXXXX)." }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const product = body.product;
  if (!product || (product.kind !== "individual" && product.kind !== "team")) {
    return new Response(JSON.stringify({ error: "Bad request: missing product." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  let accountReference: string;
  let transactionDesc: string;
  let realPrice: number | null;
  let paymentRow: { twin_id: string | null; team_id: string | null; plan_tier: Tier; plan_package: Package | null };

  if (product.kind === "individual") {
    // A non-student account (platform_admins, school_admins) has no twins
    // row at all — fail here, before bothering Safaricom, rather than after
    // a real STK push has already gone to someone's phone for a payment
    // that was always going to fail the payments.twin_id foreign key.
    const { data: twinExists } = await supabaseAdmin.from("twins").select("id").eq("id", callerId).maybeSingle();
    if (!twinExists) {
      return new Response(JSON.stringify({ error: "This account doesn't have a MetaTwin student profile to pay for." }), { status: 400, headers: { "content-type": "application/json" } });
    }
    realPrice = individualPrice(product.tier);
    accountReference = callerId;
    transactionDesc = `MetaTwin ${TIER_NAMES[product.tier]} annual plan`;
    paymentRow = { twin_id: callerId, team_id: null, plan_tier: product.tier, plan_package: null };
  } else {
    // Only the team's own lead can buy for it — checked before calling
    // Daraja at all, same "fail fast" principle as the non-student check above.
    const { data: team } = await supabaseAdmin.from("teams").select("id, created_by").eq("id", product.teamId).maybeSingle();
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found." }), { status: 404, headers: { "content-type": "application/json" } });
    }
    if (team.created_by !== callerId) {
      return new Response(JSON.stringify({ error: "Only the team lead can pay for the team's plan." }), { status: 403, headers: { "content-type": "application/json" } });
    }
    realPrice = teamPrice(product.package, product.tier);
    accountReference = product.teamId;
    transactionDesc = `Team ${PACKAGE_NAMES[product.package]} (${TIER_NAMES[product.tier]}) annual plan`;
    paymentRow = { twin_id: null, team_id: product.teamId, plan_tier: product.tier, plan_package: product.package };
  }
  if (realPrice === null) {
    return new Response(JSON.stringify({ error: "Unknown plan." }), { status: 400, headers: { "content-type": "application/json" } });
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
  const amount = chargeAmount(realPrice);

  const stkRes = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: msisdn,
      PartyB: shortcode,
      PhoneNumber: msisdn,
      CallBackURL: CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
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
    twin_id: paymentRow.twin_id,
    team_id: paymentRow.team_id,
    plan_tier: paymentRow.plan_tier,
    plan_package: paymentRow.plan_package,
    phone: msisdn,
    amount,
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
  const authResult = await authenticateTwin(request, "Sign in to pay.");
  if (authResult instanceof Response) return authResult;
  const callerId = authResult;

  const url = new URL(request.url);
  const checkoutRequestId = url.searchParams.get("checkout_request_id");
  if (!checkoutRequestId) {
    return new Response(JSON.stringify({ error: "Missing checkout_request_id" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("twin_id, team_id, status")
    .eq("mpesa_checkout_request_id", checkoutRequestId)
    .maybeSingle();
  if (error || !data) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  }

  // Scoped to the caller: their own individual payment, or a team payment
  // for a team they lead. A service-role read bypasses RLS, so this check
  // has to live here in the route, not the database.
  let authorized = data.twin_id === callerId;
  if (!authorized && data.team_id) {
    const { data: team } = await supabaseAdmin.from("teams").select("created_by").eq("id", data.team_id).maybeSingle();
    authorized = team?.created_by === callerId;
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify({ status: data.status }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
