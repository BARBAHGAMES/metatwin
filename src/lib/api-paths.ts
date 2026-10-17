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
export const GITHUB_CONNECT_PATH = "/api/github/connect";
export const GITHUB_REFRESH_PATH = "/api/github/refresh";
export const PITCH_SCORE_WEBHOOK_PATH = "/api/webhooks/pitch-score";
export const PITCH_FEEDBACK_SYNC_PATH = "/api/projects/sync-pitch-feedback";
export const PROJECT_GRADE_WEBHOOK_PATH = "/api/webhooks/project-grade";
export const SCHOOL_ADMIN_SIGNUP_WEBHOOK_PATH = "/api/webhooks/school-admin-signup";
export const PLATFORM_ADMIN_SIGNUP_WEBHOOK_PATH = "/api/webhooks/platform-admin-signup";
export const MPESA_INITIATE_PATH = "/api/payments/mpesa/initiate";
export const MPESA_STATUS_PATH = "/api/payments/mpesa/status";
export const MPESA_CALLBACK_WEBHOOK_PATH = "/api/webhooks/mpesa-callback";
export const FEEDBACK_SUBMIT_PATH = "/api/feedback/submit";
export const FEEDBACK_CONFIRM_PATH = "/api/feedback/confirm";
/** Page the confirmation email links to: `${FEEDBACK_CONFIRM_PAGE}/<token>`. */
export const FEEDBACK_CONFIRM_PAGE = "/feedback/confirm";

export type GithubConnection = {
  github_username: string;
  avatar_url: string | null;
  total_contributions_year: number;
  current_streak_days: number;
  top_languages: { language: string; pct: number }[];
  public_repo_count: number;
  connected_at: string;
  last_synced_at: string;
};

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

export type MpesaTier = "basic" | "guided" | "builder";
export type MpesaPackage = "duo" | "studio" | "launch";
export type MpesaProduct =
  | { kind: "individual"; tier: MpesaTier }
  | { kind: "team"; teamId: string; package: MpesaPackage; tier: MpesaTier };
