import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}));

const { handleGitHubSync } = await import("./github-sync-route.server");

function req(body: unknown, token: string | null = "valid-token"): Request {
  return new Request("https://example.test/api/github/sync", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

describe("github sync auth gate", () => {
  it("rejects a request with no bearer token before touching GitHub or the database", async () => {
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", project_id: "11111111-1111-1111-1111-111111111111" }, null));
    expect(res.status).toBe(401);
  });

  it("rejects an ai_employee_id sync request the same way, with no token", async () => {
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", ai_employee_id: "11111111-1111-1111-1111-111111111111" }, null));
    expect(res.status).toBe(401);
  });
});

describe("github sync ownership check", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "caller-1" } }, error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a malformed project_id with a clean 400, never querying the database", async () => {
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", project_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("rejects syncing a project owned by a different twin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "p1", twin_id: "someone-else" }, error: null });
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", project_id: "11111111-1111-1111-1111-111111111111" }));
    expect(res.status).toBe(403);
  });

  it("404s when the project does not exist", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", project_id: "22222222-2222-2222-2222-222222222222" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/project not found/i);
  });

  it("rejects syncing an AI employee owned by a different twin", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "e1", twin_id: "someone-else" }, error: null });
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", ai_employee_id: "33333333-3333-3333-3333-333333333333" }));
    expect(res.status).toBe(403);
  });

  it("returns 500 (not a false-negative 404) when the ownership lookup itself fails", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", project_id: "11111111-1111-1111-1111-111111111111" }));
    expect(res.status).toBe(500);
  });

  it("proceeds past the ownership check once the caller owns the project", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "p1", twin_id: "caller-1" }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", project_id: "11111111-1111-1111-1111-111111111111" }));
    // GitHub's own 404 ("Repository not found"), not the ownership-check 404
    // ("Project not found") -- proves the ownership gate let this request through.
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/repository/i);
  });
});

describe("github sync: which repo is fetched", () => {
  const PROJECT = "11111111-1111-1111-1111-111111111111";
  const EMPLOYEE = "33333333-3333-3333-3333-333333333333";
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "caller-1" } }, error: null });
    mockMaybeSingle.mockReset();
    // GitHub 404 stops the handler right after the repo fetch, before any write.
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a path-traversal repo ('../user' would hit api.github.com/user) before any DB or GitHub call", async () => {
    for (const repo of ["../user", "../users", "octocat/.."]) {
      const res = await handleGitHubSync(req({ repo, project_id: PROJECT }));
      expect(res.status, repo).toBe(400);
    }
    expect(mockMaybeSingle).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only ever calls the /repos/<owner>/<repo> endpoint for a project", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: "p1", twin_id: "caller-1" }, error: null });
    await handleGitHubSync(req({ repo: "https://github.com/octocat/hello-world.git", project_id: PROJECT }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.github.com/repos/octocat/hello-world");
  });

  it("syncs the AI employee's saved GitHub link, ignoring a different repo named in the request", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "e1", twin_id: "caller-1" }, error: null }) // ownership
      .mockResolvedValueOnce({ data: { link_url: "https://github.com/me/my-agent" }, error: null }); // saved link
    await handleGitHubSync(req({ repo: "torvalds/linux", ai_employee_id: EMPLOYEE }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.github.com/repos/me/my-agent");
  });

  it("refuses to sync an AI employee whose saved link isn't a GitHub repo (no stats next to a Claude Skill link)", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "e1", twin_id: "caller-1" }, error: null })
      .mockResolvedValueOnce({ data: { link_url: "https://claude.ai/skills/my-skill" }, error: null });
    const res = await handleGitHubSync(req({ repo: "torvalds/linux", ai_employee_id: EMPLOYEE }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
