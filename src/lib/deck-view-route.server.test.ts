import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: (...a: unknown[]) => rpc(...a) } }));
const { handleDeckView, visitorHash } = await import("./deck-view-route.server");

const PID = "bbbbbbbb-0000-4000-8000-000000000001";
function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://x/api/projects/deck-view", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (Linux; Android 13) Chrome/129 Mobile", "cf-connecting-ip": "41.90.1.2", "cf-ipcountry": "KE", ...headers },
    body: JSON.stringify(body),
  });
}

describe("visitorHash", () => {
  it("changes every day and with the salt, so it can't link a visitor across days", async () => {
    const a = await visitorHash("41.90.1.2", "ua", "2026-10-15", "s1");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await visitorHash("41.90.1.2", "ua", "2026-10-16", "s1")).not.toBe(a);
    expect(await visitorHash("41.90.1.2", "ua", "2026-10-15", "s2")).not.toBe(a);
    expect(await visitorHash("41.90.1.2", "ua", "2026-10-15", "s1")).toBe(a);
  });
});

describe("POST /api/projects/deck-view", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: true, error: null });
    process.env.DECK_VIEW_SALT = "test-salt";
  });

  it("records a view with only a hash and the country (no IP, no user agent)", async () => {
    const res = await handleDeckView(req({ handle: "Amina", project_id: PID }));
    expect(await res.json()).toEqual({ counted: true });
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe("record_deck_view");
    expect(args).toMatchObject({ p_handle: "amina", p_project_id: PID, p_country: "KE" });
    expect(args.p_visitor_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain("41.90.1.2");
    expect(JSON.stringify(args)).not.toContain("Android");
  });

  it.each(["Googlebot/2.1", "WhatsApp/2.23", "facebookexternalhit/1.1", "HeadlessChrome", ""])("ignores bots and link previews (%j)", async (ua) => {
    const res = await handleDeckView(req({ handle: "amina", project_id: PID }, { "user-agent": ua }));
    expect(await res.json()).toEqual({ counted: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed input and drops unknown/Tor country codes", async () => {
    expect((await handleDeckView(req({ handle: "amina", project_id: "nope" }))).status).toBe(400);
    await handleDeckView(req({ handle: "amina", project_id: PID }, { "cf-ipcountry": "T1" }));
    expect(rpc.mock.calls[0]![1].p_country).toBe("");
  });

  it("never errors to the visitor, even if the database does", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await handleDeckView(req({ handle: "amina", project_id: PID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ counted: false });
  });
});
