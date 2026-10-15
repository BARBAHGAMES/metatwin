import { describe, expect, it } from "vitest";
import { githubRepoApiUrl, normalizeRepoSlug, parseGithubRepo } from "./github-repo";

describe("normalizeRepoSlug", () => {
  it("accepts owner/repo and GitHub URLs, with an optional trailing slash or .git", () => {
    expect(normalizeRepoSlug("octocat/hello-world")?.slug).toBe("octocat/hello-world");
    expect(normalizeRepoSlug("  https://github.com/octocat/hello-world/  ")?.slug).toBe("octocat/hello-world");
    expect(normalizeRepoSlug("https://www.github.com/octocat/Hello.World.git")?.slug).toBe("octocat/Hello.World");
    expect(normalizeRepoSlug("my-org/my_repo.v2")).toEqual({ owner: "my-org", repo: "my_repo.v2", slug: "my-org/my_repo.v2" });
  });

  it("rejects path traversal and dot segments (they would escape /repos/ on api.github.com)", () => {
    for (const bad of ["../user", "../users", "./x", "octocat/..", "octocat/.", "../../orgs", "..%2Fuser/x"]) {
      expect(normalizeRepoSlug(bad), bad).toBeNull();
    }
  });

  it("rejects other hosts, deeper paths and invalid names", () => {
    for (const bad of [
      "https://gitlab.com/owner/repo",
      "javascript:alert(1)",
      "https://github.com/owner/repo/issues/1",
      "owner",
      "owner/repo/extra",
      "-owner/repo",
      "owner_name/repo", // underscores aren't valid in GitHub usernames
      `${"a".repeat(40)}/repo`,
      `owner/${"r".repeat(101)}`,
      "owner/re po",
      "",
    ]) {
      expect(normalizeRepoSlug(bad), bad).toBeNull();
    }
  });
});

describe("parseGithubRepo", () => {
  it("only accepts full GitHub repo URLs (AI employee links)", () => {
    expect(parseGithubRepo("https://github.com/anthropics/claude-code")).toBe("anthropics/claude-code");
    expect(parseGithubRepo("anthropics/claude-code")).toBeNull();
    expect(parseGithubRepo("https://github.com/../user")).toBeNull();
  });
});

describe("githubRepoApiUrl", () => {
  it("always targets /repos/<owner>/<repo> on api.github.com", () => {
    const repo = normalizeRepoSlug("octocat/hello-world")!;
    expect(githubRepoApiUrl(repo)).toBe("https://api.github.com/repos/octocat/hello-world");
    expect(githubRepoApiUrl(repo, "/stats/commit_activity")).toBe("https://api.github.com/repos/octocat/hello-world/stats/commit_activity");
  });
});
