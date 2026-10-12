// Public, read-only proxy to the GitHub REST API — no OAuth, no user auth
// needed here (the data returned is public repo metadata; the actual write
// to github_repos happens client-side under the caller's own Supabase RLS
// session, same as every other student-owned insert in this app).
import type { GitHubRepoStats } from "./api-paths";

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "metatwin-app" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function handleGitHubSync(request: Request): Promise<Response> {
  let body: { repo?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const repo = typeof body.repo === "string" ? body.repo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "") : "";
  if (!REPO_PATTERN.test(repo)) {
    return new Response(JSON.stringify({ error: "Enter a repo as owner/name." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers: authHeaders() });
  if (repoRes.status === 404) {
    return new Response(JSON.stringify({ error: "Repository not found or private." }), { status: 404, headers: { "content-type": "application/json" } });
  }
  if (!repoRes.ok) {
    return new Response(JSON.stringify({ error: `GitHub error ${repoRes.status}` }), { status: 502, headers: { "content-type": "application/json" } });
  }
  const repoData = (await repoRes.json()) as {
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string | null;
    pushed_at: string | null;
  };

  let weekly_commits: number[] = [];
  try {
    const statsRes = await fetch(`https://api.github.com/repos/${repo}/stats/commit_activity`, { headers: authHeaders() });
    if (statsRes.ok) {
      const weeks = (await statsRes.json()) as { total: number }[];
      if (Array.isArray(weeks)) weekly_commits = weeks.slice(-12).map((w) => w.total);
    }
    // GitHub computes these stats asynchronously and returns 202 while
    // pending — skip the histogram rather than fail the whole sync.
  } catch {
    // ignore — histogram is optional
  }

  const stats: GitHubRepoStats = {
    full_name: repoData.full_name,
    url: repoData.html_url ?? null,
    description: repoData.description,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    open_issues: repoData.open_issues_count,
    language: repoData.language,
    last_commit_at: repoData.pushed_at,
    weekly_commits,
  };

  return new Response(JSON.stringify(stats), { status: 200, headers: { "content-type": "application/json" } });
}
