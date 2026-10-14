import { describe, expect, it } from "vitest";
import { parseGithubRepo } from "./ai-employees";

describe("parseGithubRepo", () => {
  it("extracts owner/repo from a plain github.com URL", () => {
    expect(parseGithubRepo("https://github.com/anthropics/claude-code")).toBe("anthropics/claude-code");
  });

  it("accepts http, www, and a trailing slash", () => {
    expect(parseGithubRepo("http://github.com/owner/repo")).toBe("owner/repo");
    expect(parseGithubRepo("https://www.github.com/owner/repo")).toBe("owner/repo");
    expect(parseGithubRepo("https://github.com/owner/repo/")).toBe("owner/repo");
  });

  it("strips a trailing .git", () => {
    expect(parseGithubRepo("https://github.com/owner/repo.git")).toBe("owner/repo");
  });

  it("rejects a non-GitHub link (e.g. a Claude Skill reference elsewhere)", () => {
    expect(parseGithubRepo("https://example.com/skills/my-skill")).toBeNull();
  });

  it("rejects a github.com URL with extra path segments past owner/repo", () => {
    expect(parseGithubRepo("https://github.com/owner/repo/issues/1")).toBeNull();
  });
});
