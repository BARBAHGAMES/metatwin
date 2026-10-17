import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();
const updateEq2 = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
      update: (values: unknown) => ({ eq: () => ({ eq: (...a: unknown[]) => updateEq2(values, ...a) }) }),
    }),
  },
}));

const { probeTarget, classifyGoogleResponse, classifyYouTubeResponse, handleCheckDeck } = await import("./deck-check-route.server");

describe("probeTarget (never the user's URL, only fixed endpoints)", () => {
  it("maps share links to fixed Google endpoints built from the file id", () => {
    expect(probeTarget("https://docs.google.com/presentation/d/1AbC_d-9/edit?usp=sharing&x=https://evil.example")).toEqual({
      kind: "google",
      url: "https://docs.google.com/presentation/d/1AbC_d-9/preview",
    });
    expect(probeTarget("https://drive.google.com/open?id=1FiLe")).toEqual({ kind: "google", url: "https://drive.google.com/file/d/1FiLe/view" });
    expect(probeTarget("https://docs.google.com/presentation/d/e/2PACX-1vQ/pub?start=false")).toEqual({ kind: "google", url: "https://docs.google.com/presentation/d/e/2PACX-1vQ/pub" });
  });
  it("maps YouTube to oEmbed and returns null for anything else", () => {
    expect(probeTarget("https://youtu.be/dQw4w9WgXcQ")?.url).toBe("https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ");
    for (const u of ["https://example.com/deck.pdf", "https://www.canva.com/design/DAF/view", "http://169.254.169.254/latest", "https://docs.google.com.evil.example/presentation/d/abc/edit"]) {
      expect(probeTarget(u), u).toBeNull();
    }
  });
});

describe("classify", () => {
  it.each([
    [200, null, "public"],
    [302, "https://accounts.google.com/ServiceLogin?continue=...", "restricted"],
    [302, "https://docs.google.com/somewhere-else", "unknown"],
    [401, null, "restricted"],
    [403, null, "restricted"],
    [404, null, "not_found"],
    [500, null, "unknown"],
  ] as const)("Google %i %s -> %s", (status, location, expected) => expect(classifyGoogleResponse(status, location)).toBe(expected));

  it.each([[200, "public"], [401, "restricted"], [403, "restricted"], [404, "not_found"], [400, "not_found"], [503, "unknown"]] as const)(
    "YouTube %i -> %s",
    (status, expected) => expect(classifyYouTubeResponse(status)).toBe(expected),
  );
});

function req(body: unknown, token: string | null = "t") {
  return new Request("https://x/api/projects/check-deck", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
const PID = "bbbbbbbb-0000-4000-8000-000000000001";

describe("POST /api/projects/check-deck", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    maybeSingle.mockReset();
    updateEq2.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("requires sign-in", async () => {
    expect((await handleCheckDeck(req({ project_id: PID }, null))).status).toBe(401);
  });

  it("refuses someone else's project", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: PID, twin_id: "someone-else" }, error: null });
    expect((await handleCheckDeck(req({ project_id: PID }))).status).toBe(403);
  });

  it("probes the fixed endpoint without following redirects and records the result only if the link is unchanged", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: PID, twin_id: "me" }, error: null })
      .mockResolvedValueOnce({ data: { pitch_deck_url: "https://docs.google.com/presentation/d/1AbC/edit" }, error: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://accounts.google.com/ServiceLogin" } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await handleCheckDeck(req({ project_id: PID }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("restricted");
    expect(fetchMock).toHaveBeenCalledWith("https://docs.google.com/presentation/d/1AbC/preview", expect.objectContaining({ redirect: "manual" }));
    expect(updateEq2).toHaveBeenCalledWith(expect.objectContaining({ pitch_deck_status: "restricted" }), "pitch_deck_url", "https://docs.google.com/presentation/d/1AbC/edit");
  });

  it("records 'unknown' for links it can't check, without any outbound request", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: PID, twin_id: "me" }, error: null })
      .mockResolvedValueOnce({ data: { pitch_deck_url: "https://www.canva.com/design/DAF/view" }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await handleCheckDeck(req({ project_id: PID }));
    expect((await res.json()).status).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
