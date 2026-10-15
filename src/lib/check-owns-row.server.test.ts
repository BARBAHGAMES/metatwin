import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}));

const { checkOwnsRow } = await import("./check-owns-row.server");

describe("checkOwnsRow", () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
  });

  it("rejects a malformed id with a clean 400, never touching the database", async () => {
    const res = await checkOwnsRow("projects", "not-a-uuid", "caller-1", "Project not found.", "Not yours.");
    expect(res?.status).toBe(400);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("404s when the row does not exist", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await checkOwnsRow("projects", "11111111-1111-1111-1111-111111111111", "caller-1", "Project not found.", "Not yours.");
    expect(res?.status).toBe(404);
    expect((await res!.json()).error).toBe("Project not found.");
  });

  it("403s when the row belongs to a different twin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "p1", twin_id: "someone-else" }, error: null });
    const res = await checkOwnsRow("projects", "11111111-1111-1111-1111-111111111111", "caller-1", "Project not found.", "Not yours.");
    expect(res?.status).toBe(403);
  });

  it("500s (not a false-negative 404) when the lookup itself fails", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const res = await checkOwnsRow("projects", "11111111-1111-1111-1111-111111111111", "caller-1", "Project not found.", "Not yours.");
    expect(res?.status).toBe(500);
  });

  it("returns null (no error) when the caller owns the row", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "p1", twin_id: "caller-1" }, error: null });
    const res = await checkOwnsRow("projects", "11111111-1111-1111-1111-111111111111", "caller-1", "Project not found.", "Not yours.");
    expect(res).toBeNull();
  });
});
