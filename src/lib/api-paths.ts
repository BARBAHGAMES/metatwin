// Plain constants + types shared between client components and the
// *.server.ts route handlers that back them. This file must NEVER import
// anything from a *.server.ts module (which can pull in supabaseAdmin / the
// service-role key) — client components import from here, never directly
// from a .server.ts file, so nothing server-only ever reaches the client bundle.
export const NEW_USER_WEBHOOK_PATH = "/api/webhooks/new-user";
export const GITHUB_SYNC_PATH = "/api/github/sync";
export const TWIN_CHAT_PATH = "/api/ai/chat";
export const OPPORTUNITIES_SCOUT_PATH = "/api/ai/opportunities";
export const PARTNERSHIP_INQUIRY_WEBHOOK_PATH = "/api/webhooks/partnership-inquiry";

export type GitHubRepoStats = {
  full_name: string;
  url: string | null;
  description: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  language: string | null;
  last_commit_at: string | null;
  weekly_commits: number[];
};
