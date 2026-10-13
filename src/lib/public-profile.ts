import { supabase } from "@/integrations/supabase/client";
import type { PublicPitchScore } from "./pitch-scores";

// Mirrors twins_handle_format in the public_profile_handle_and_function
// migration (P1-5): 3-30 chars, lowercase letters/digits/hyphens, starting and
// ending with a letter or digit, minus a small reserved list. The database is
// the enforcement; this gives instant feedback.
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED_HANDLES = new Set([
  "admin", "api", "www", "metatwin", "support", "help", "login", "signup",
  "dashboard", "profile", "about", "pricing", "null", "undefined",
]);

export const HANDLE_HELP =
  "3–30 characters: lowercase letters, numbers and hyphens, starting and ending with a letter or number.";

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateHandle(raw: string): string | null {
  const handle = normalizeHandle(raw);
  if (!HANDLE_RE.test(handle)) return HANDLE_HELP;
  if (RESERVED_HANDLES.has(handle)) return "That handle is reserved. Please choose another.";
  return null;
}

export function publicProfilePath(handle: string): string {
  return `/t/${handle}`;
}

export type PublicEvidence = { id: string; title: string; reviewed: boolean; link?: string | null; note?: string | null };
export type PublicCapability = {
  id: string;
  skill: string;
  category: string | null;
  level: number;
  evidence_count: number;
  evidence: PublicEvidence[];
};
export type PublicGithubStats = {
  full_name: string;
  url: string | null;
  stars: number;
  forks: number;
  language: string | null;
  last_commit_at: string | null;
  weekly_commits: number[];
};
export type PublicPitchStats = { total_pitches: number; positive: number; customers: number; conversion_pct: number | null };
export type PublicProjectTeam = { slug: string; name: string };
export type PublicPitchFeedback = { responses: number; questions: { label: string; average: number; max: number }[]; overall: number | null };
export type PublicProjectGrade = { rating_label: string; rating_score: number };
export type PublicProject = {
  id: string;
  title: string;
  description: string | null;
  artifact_url?: string | null;
  writeup_url?: string | null;
  pitch_deck_url?: string | null;
  pitch_video_url?: string | null;
  github?: PublicGithubStats | null;
  pitch_stats?: PublicPitchStats | null;
  pitch_feedback?: PublicPitchFeedback | null;
  grade?: PublicProjectGrade | null;
  team?: PublicProjectTeam | null;
};
export type PublicProfileTeam = { slug: string; name: string };
export type PublicAiEmployee = { id: string; name: string; role: string | null; platform: string | null; description: string | null; link_url: string | null };
// Aggregate signals only, deliberately — no repo listing, no token. Shown to
// anyone viewing a public profile (including recruiters), so it mirrors
// exactly what GitHub's own public contribution graph exposes: activity
// counts, not repo contents.
export type PublicGithubActivity = {
  username: string;
  avatar_url: string | null;
  total_contributions_year: number;
  current_streak_days: number;
  top_languages: { language: string; pct: number }[];
  public_repo_count: number;
};
export type PublicProfile = {
  handle: string;
  name: string | null;
  headline: string | null;
  institution: string | null;
  programme: string | null;
  photo_url: string | null;
  show_evidence_details: boolean;
  github_activity: PublicGithubActivity | null;
  teams: PublicProfileTeam[];
  pitch_scores: PublicPitchScore[];
  ai_employees: PublicAiEmployee[];
  capabilities: PublicCapability[];
  projects: PublicProject[];
};

// The only anonymous read path: one handle in, a fixed set of fields out.
// Returns null for unknown, private, or non-adult profiles alike, so a visitor
// can't tell which handles exist.
export async function fetchPublicProfile(handle: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { p_handle: handle });
  if (error) throw new Error(error.message);
  return (data as PublicProfile | null) ?? null;
}

export type PublicTwinListItem = {
  handle: string;
  name: string | null;
  headline: string | null;
  institution: string | null;
  photo_url: string | null;
  github_username: string | null;
  github_total_contributions_year: number | null;
};

// For the Find Talent directory — the same least-privilege pattern as
// get_public_profile: a dedicated RPC returning only a fixed, non-sensitive
// field set for public+handled twins, never a raw anon SELECT on twins.
export async function fetchPublicTwins(): Promise<PublicTwinListItem[]> {
  const { data, error } = await supabase.rpc("list_public_twins");
  if (error) throw new Error(error.message);
  return (data as PublicTwinListItem[] | null) ?? [];
}
