-- Cached public GitHub repo stats for an AI employee whose link happens to
-- be a github.com repo (student's own choice — the link can also be a
-- Claude Skill reference or anything else, in which case these stay null).
-- Synced on demand via the EXISTING /api/github/sync route (a stateless,
-- unauthenticated-or-app-token public GitHub REST proxy already built for
-- project repos — github-sync-route.server.ts — reused as-is here, no new
-- server route needed; it never required the caller to own the repo).
alter table public.ai_employees
  add column github_full_name text,
  add column github_stars int,
  add column github_forks int,
  add column github_open_issues int,
  add column github_synced_at timestamptz;
