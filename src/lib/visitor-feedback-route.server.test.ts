import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const sendResendEmail = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("./resend-send.server", () => ({ sendResendEmail: (...args: unknown[]) => sendResendEmail(...args) }));

const { handleFeedbackSubmit, handleFeedbackConfirm, sha256Hex, confirmEmailHtml } = await import("./visitor-feedback-route.server");

let ipCounter = 0;
function req(path: string, body: unknown): Request {
  ipCounter += 1; // fresh IP per request so the per-isolate limiter doesn't interfere
  return new Request(`https://metatwin.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": `10.0.0.${ipCounter}` },
    body: JSON.stringify(body),
  });
}

const valid = {
  handle: "amina",
  projectId: "bbbbbbbb-0000-4000-8000-000000000001",
  rating: 5,
  comment: "Strong problem statement.",
  name: "Wanjiru <b>K</b>",
  role: "mentor",
  org: "",
  email: "w@example.com",
  whatsapp: "0712345678",
  consent: true,
};

describe("POST /api/feedback/submit", () => {
  beforeEach(() => {
    rpc.mockReset();
    sendResendEmail.mockReset();
    rpc.mockImplementation((fn: string) =>
      fn === "submit_project_feedback"
        ? Promise.resolve({ data: { student_name: "Amina", project_title: "Duka <Bot>", is_update: false }, error: null })
        : Promise.resolve({ data: {}, error: null }),
    );
  });
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  it("rejects invalid input with per-field messages, without touching the database", async () => {
    const res = await handleFeedbackSubmit(req("/api/feedback/submit", { ...valid, whatsapp: "123", rating: 9 }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("whatsapp");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("stores only the token hash, normalises contacts, and emails the raw token link", async () => {
    const res = await handleFeedbackSubmit(req("/api/feedback/submit", valid));
    expect(res.status).toBe(200);
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe("submit_project_feedback");
    expect(args).toMatchObject({ p_whatsapp: "+254712345678", p_email: "w@example.com", p_consent: true, p_rating: 5 });
    expect(args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);

    const [to, subject, html] = sendResendEmail.mock.calls[0]!;
    expect(to).toBe("w@example.com");
    expect(subject).toContain("Amina");
    const token = (html as string).match(/\/feedback\/confirm\/([A-Za-z0-9_-]{43})/)?.[1];
    expect(token).toBeDefined();
    expect(html).toContain("https://metatwin.example/feedback/confirm/");
    expect(await sha256Hex(token!)).toBe(args.p_token_hash);
    expect(html).not.toContain("<b>K</b>");
    expect(html).toContain("Duka &lt;Bot&gt;");
  });

  it.each([
    ["project_not_found", 404],
    ["own_project", 400],
    ["rate_limited", 429],
  ])("maps database error %s to HTTP %i with no email sent", async (code, status) => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: code, code: "P0001" } });
    const res = await handleFeedbackSubmit(req("/api/feedback/submit", valid));
    expect(res.status).toBe(status);
    expect(sendResendEmail).not.toHaveBeenCalled();
  });

  it("enforces Turnstile when a secret is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false })));
    vi.stubGlobal("fetch", fetchMock);
    const noToken = await handleFeedbackSubmit(req("/api/feedback/submit", valid));
    expect(noToken.status).toBe(400);
    const badToken = await handleFeedbackSubmit(req("/api/feedback/submit", { ...valid, turnstileToken: "t" }));
    expect(badToken.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/feedback/confirm", () => {
  beforeEach(() => rpc.mockReset());

  it("rejects malformed tokens without a database call", async () => {
    const res = await handleFeedbackConfirm(req("/api/feedback/confirm", { token: "short" }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes only the hash of a well-formed token", async () => {
    rpc.mockResolvedValueOnce({ data: { status: "confirmed", handle: "amina", project_title: "Duka" }, error: null });
    const token = "A".repeat(43);
    const res = await handleFeedbackConfirm(req("/api/feedback/confirm", { token }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("confirm_project_feedback", { p_token_hash: await sha256Hex(token) });
  });

  it("returns 400 for expired or used tokens", async () => {
    rpc.mockResolvedValueOnce({ data: { status: "expired" }, error: null });
    const res = await handleFeedbackConfirm(req("/api/feedback/confirm", { token: "B".repeat(43) }));
    expect(res.status).toBe(400);
    expect((await res.json()).status).toBe("expired");
  });
});

describe("confirmEmailHtml", () => {
  it("escapes every interpolated value", () => {
    const html = confirmEmailHtml({ reviewerName: "<x>", studentName: "\"s\"", projectTitle: "a&b", link: "https://e/x?a=1&b=2", isUpdate: true });
    expect(html).not.toMatch(/<x>/);
    expect(html).toContain("&lt;x&gt;");
    expect(html).toContain("a&amp;b");
    expect(html).toContain("updating your");
  });
});
