import { describe, expect, it } from "vitest";
import { handleGitHubSync } from "./github-sync-route.server";

function req(body: unknown): Request {
  return new Request("https://example.test/api/github/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("github sync auth gate", () => {
  it("rejects a request with no bearer token before touching GitHub or the database", async () => {
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", project_id: "11111111-1111-1111-1111-111111111111" }));
    expect(res.status).toBe(401);
  });

  it("rejects an ai_employee_id sync request the same way, with no token", async () => {
    const res = await handleGitHubSync(req({ repo: "octocat/hello-world", ai_employee_id: "11111111-1111-1111-1111-111111111111" }));
    expect(res.status).toBe(401);
  });
});
