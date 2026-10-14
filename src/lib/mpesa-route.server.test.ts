import { describe, expect, it } from "vitest";
import { handleMpesaInitiate, handleMpesaStatus, normalizeKenyanMsisdn } from "./mpesa-route.server";

describe("normalizeKenyanMsisdn", () => {
  it("normalizes every common input format to 2547XXXXXXXX", () => {
    expect(normalizeKenyanMsisdn("0712345678")).toBe("254712345678");
    expect(normalizeKenyanMsisdn("+254712345678")).toBe("254712345678");
    expect(normalizeKenyanMsisdn("254712345678")).toBe("254712345678");
    expect(normalizeKenyanMsisdn("0112345678")).toBe("254112345678");
    expect(normalizeKenyanMsisdn("712345678")).toBe("254712345678");
  });

  it("strips spaces and dashes", () => {
    expect(normalizeKenyanMsisdn("0712 345 678")).toBe("254712345678");
    expect(normalizeKenyanMsisdn("0712-345-678")).toBe("254712345678");
  });

  it("rejects non-Kenyan or malformed numbers", () => {
    expect(normalizeKenyanMsisdn("12345")).toBeNull();
    expect(normalizeKenyanMsisdn("+15551234567")).toBeNull();
    expect(normalizeKenyanMsisdn("0212345678")).toBeNull();
    expect(normalizeKenyanMsisdn("")).toBeNull();
  });
});

function req(url: string, auth?: string): Request {
  return new Request(url, { headers: auth ? { authorization: auth } : {} });
}

describe("mpesa initiate/status auth gate", () => {
  it("rejects a request with no bearer token before touching anything else", async () => {
    const res = await handleMpesaInitiate(req("https://example.test/api/payments/mpesa/initiate"));
    expect(res.status).toBe(401);
  });

  it("status route also rejects a request with no bearer token", async () => {
    const res = await handleMpesaStatus(req("https://example.test/api/payments/mpesa/status?checkout_request_id=abc"));
    expect(res.status).toBe(401);
  });
});
