import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}));

const { handlePitchFeedbackSync } = await import("./pitch-feedback-sync-route.server");

function req(body: unknown, token: string | null = "valid-token"): Request {
  return new Request("https://example.test/api/projects/sync-pitch-feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

describe("pitch feedback sync auth gate", () => {
  it("rejects a pitch_scores sync request with no bearer token", async () => {
    const res = await handlePitchFeedbackSync(
      req({ csv_url: "https://docs.google.com/x", project_id: "11111111-1111-1111-1111-111111111111", kind: "pitch_scores" }, null),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an interviews sync request with no bearer token", async () => {
    const res = await handlePitchFeedbackSync(
      req({ csv_url: "https://docs.google.com/x", project_id: "11111111-1111-1111-1111-111111111111", kind: "interviews" }, null),
    );
    expect(res.status).toBe(401);
  });
});

describe("pitch feedback sync ownership check", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "caller-1" } }, error: null });
  });

  it("rejects syncing a project owned by a different twin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "p1", twin_id: "someone-else" }, error: null });
    const res = await handlePitchFeedbackSync(req({ csv_url: "https://docs.google.com/x", project_id: "p1", kind: "interviews" }));
    expect(res.status).toBe(403);
  });

  it("404s when the project does not exist", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await handlePitchFeedbackSync(req({ csv_url: "https://docs.google.com/x", project_id: "missing", kind: "interviews" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/project not found/i);
  });

  it("returns 500 (not a false-negative 404) when the ownership lookup itself fails", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const res = await handlePitchFeedbackSync(req({ csv_url: "https://docs.google.com/x", project_id: "p1", kind: "interviews" }));
    expect(res.status).toBe(500);
  });

  it("proceeds past the ownership check once the caller owns the project", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "p1", twin_id: "caller-1" }, error: null });
    // A non-Google host is rejected by the next validation step, not the ownership
    // check -- proves the ownership gate let this request through.
    const res = await handlePitchFeedbackSync(req({ csv_url: "https://evil.example/x", project_id: "p1", kind: "interviews" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/docs\.google\.com/i);
  });
});
