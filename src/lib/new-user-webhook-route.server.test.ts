import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, handleNewUserWebhook, safeEqual } from "./new-user-webhook-route.server";

function req(body: unknown, auth?: string): Request {
  return new Request("https://example.test/api/webhooks/new-user", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("new-user webhook", () => {
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

  beforeEach(() => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "s3cret");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects a missing or wrong bearer token and sends nothing", async () => {
    expect((await handleNewUserWebhook(req({ record: { email: "a@b.co" } }))).status).toBe(401);
    expect((await handleNewUserWebhook(req({ record: { email: "a@b.co" } }, "Bearer nope"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects everything when the secret is not configured", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "");
    expect((await handleNewUserWebhook(req({ record: { email: "a@b.co" } }, "Bearer "))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s on bad JSON or a missing / non-string email", async () => {
    expect((await handleNewUserWebhook(req("not json", "Bearer s3cret"))).status).toBe(400);
    expect((await handleNewUserWebhook(req({ record: {} }, "Bearer s3cret"))).status).toBe(400);
    expect((await handleNewUserWebhook(req({ record: { email: 42 } }, "Bearer s3cret"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one welcome email to the address, HTML-escaped", async () => {
    const evil = `"><script>alert(1)</script>@x.co`;
    const res = await handleNewUserWebhook(req({ record: { email: evil } }, "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.to).toEqual([evil]);
    expect(sent.html).not.toContain("<script>");
    expect(sent.html).toContain("&lt;script&gt;");
    expect(sent.html).toContain("confirmed");
  });
});

describe("helpers", () => {
  it("escapeHtml escapes the five dangerous characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
  it("safeEqual compares equal and unequal strings of any length", async () => {
    expect(await safeEqual("abc", "abc")).toBe(true);
    expect(await safeEqual("abc", "abd")).toBe(false);
    expect(await safeEqual("abc", "abcd")).toBe(false);
    expect(await safeEqual("", "x")).toBe(false);
  });
});
