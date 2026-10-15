// GitHub repo-stats sync for a project OR an AI employee. Authenticated and
// ownership-checked, then written server-side via supabaseAdmin — the client
// no longer writes github_repos / ai_employees.github_* directly (Build Plan
// 0.5: those columns are server-fetched but used to be browser-written, so a
// student could forge stars/forks/etc. through the API). The actual GitHub
// REST calls stay unauthenticated-or-app-token (public repo metadata).
import type { GitHubRepoStats } from "./api-paths";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateTwin } from "./authenticate-twin.server";
import { checkOwnsRow } from "./check-owns-row.server";

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "metatwin-app" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function handleGitHubSync(request: Request): Promise<Response> {
  const authResult = await authenticateTwin(request, "Sign in to sync GitHub stats.");
  if (authResult instanceof Response) return authResult;
  const callerId = authResult;

  let body: { repo?: unknown; project_id?: unknown; ai_employee_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const repo = typeof body.repo === "string" ? body.repo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "") : "";
  if (!REPO_PATTERN.test(repo)) {
    return new Response(JSON.stringify({ error: "Enter a repo as owner/name." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const aiEmployeeId = typeof body.ai_employee_id === "string" ? body.ai_employee_id : null;
  if ((!projectId && !aiEmployeeId) || (projectId && aiEmployeeId)) {
    return new Response(JSON.stringify({ error: "Bad request: pass exactly one of project_id or ai_employee_id." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const ownershipError = projectId
    ? await checkOwnsRow("projects", projectId, callerId, "Project not found.", "You can only sync your own project.")
    : await checkOwnsRow("ai_employees", aiEmployeeId as string, callerId, "AI employee not found.", "You can only sync your own AI employee.");
  if (ownershipError) return ownershipError;

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

  if (projectId) {
    const { error: dbError } = await supabaseAdmin.from("github_repos").upsert(
      {
        twin_id: callerId,
        project_id: projectId,
        full_name: stats.full_name,
        url: stats.url,
        description: stats.description,
        stars: stats.stars,
        forks: stats.forks,
        open_issues: stats.open_issues,
        language: stats.language,
        last_commit_at: stats.last_commit_at,
        weekly_commits: stats.weekly_commits,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );
    if (dbError) return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { "content-type": "application/json" } });
  } else {
    const { error: dbError } = await supabaseAdmin
      .from("ai_employees")
      .update({
        github_full_name: stats.full_name,
        github_stars: stats.stars,
        github_forks: stats.forks,
        github_open_issues: stats.open_issues,
        github_synced_at: new Date().toISOString(),
      })
      .eq("id", aiEmployeeId as string);
    if (dbError) return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify(stats), { status: 200, headers: { "content-type": "application/json" } });
}
