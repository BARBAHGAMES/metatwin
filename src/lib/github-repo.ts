// Pure GitHub "owner/repo" parsing, shared by client code (AiEmployeesCard,
// the project GitHub card) and server routes (github-sync-route.server.ts).
// No imports: safe to bundle on either side.
//
// Validation follows GitHub's own naming rules, which also blocks path
// traversal: the sync route builds `https://api.github.com/repos/<owner>/<repo>`,
// and a loose pattern accepted owner ".." — `../user` normalised to
// `https://api.github.com/user`, i.e. a request (with the server's GITHUB_TOKEN,
// if one is set) to an endpoint other than the repo endpoint.

// GitHub usernames/orgs: 1-39 chars, alphanumeric or single hyphens, no leading hyphen.
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
// Repo names: 1-100 chars of letters, digits, '-', '_', '.'; GitHub forbids "." and "..".
const REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

export type RepoSlug = { owner: string; repo: string; slug: string };

/**
 * Accepts "owner/repo", "https://github.com/owner/repo", with an optional trailing
 * slash or ".git". Returns null for anything else (other hosts, deeper paths such
 * as /issues/1, invalid names, "." / ".." segments).
 */
export function normalizeRepoSlug(input: string): RepoSlug | null {
  let value = input.trim();
  const urlMatch = value.match(/^https?:\/\/(?:www\.)?github\.com\/(.+)$/i);
  if (urlMatch) value = urlMatch[1]!;
  else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // some other scheme/host
  value = value.replace(/\/$/, "").replace(/\.git$/i, "");

  const parts = value.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts as [string, string];
  if (!OWNER_PATTERN.test(owner)) return null;
  if (!REPO_PATTERN.test(repo) || repo === "." || repo === "..") return null;
  return { owner, repo, slug: `${owner}/${repo}` };
}

/** Repo slug from a GitHub repo URL (an AI employee's link), or null if the link isn't one. */
export function parseGithubRepo(url: string): string | null {
  if (!/^https?:\/\//i.test(url.trim())) return null;
  return normalizeRepoSlug(url)?.slug ?? null;
}

/** GitHub REST URL for a validated repo, each segment encoded. `suffix` e.g. "/stats/commit_activity". */
export function githubRepoApiUrl(repo: RepoSlug, suffix = ""): string {
  return `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}${suffix}`;
}
