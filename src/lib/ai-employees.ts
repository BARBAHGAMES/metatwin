import { supabase } from "@/integrations/supabase/client";
import { GITHUB_SYNC_PATH, type GitHubRepoStats } from "./api-paths";

export type AiEmployee = {
  id: string;
  name: string;
  role: string | null;
  platform: string | null;
  description: string | null;
  link_url: string | null;
  github_full_name: string | null;
  github_stars: number | null;
  github_forks: number | null;
  github_open_issues: number | null;
  github_synced_at: string | null;
};

export async function fetchMyAiEmployees(userId: string): Promise<AiEmployee[]> {
  const { data, error } = await supabase
    .from("ai_employees")
    .select("id, name, role, platform, description, link_url, github_full_name, github_stars, github_forks, github_open_issues, github_synced_at")
    .eq("twin_id", userId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addAiEmployee(
  userId: string,
  fields: { name: string; role: string; platform: string; description: string; link_url: string },
): Promise<void> {
  const { error } = await supabase.from("ai_employees").insert({
    twin_id: userId,
    name: fields.name.trim(),
    role: fields.role.trim() || null,
    platform: fields.platform.trim() || null,
    description: fields.description.trim() || null,
    link_url: fields.link_url.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function updateAiEmployee(
  id: string,
  fields: { name: string; role: string; platform: string; description: string; link_url: string },
): Promise<void> {
  const { error } = await supabase
    .from("ai_employees")
    .update({
      name: fields.name.trim(),
      role: fields.role.trim() || null,
      platform: fields.platform.trim() || null,
      description: fields.description.trim() || null,
      link_url: fields.link_url.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeAiEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("ai_employees").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// The link can be a GitHub repo OR a Claude Skill reference OR anything
// else — only the GitHub case has public stats to show. Matches the owner/repo
// extraction github-sync-route.server.ts itself does for a raw "owner/name" input.
export function parseGithubRepo(url: string): string | null {
  const match = url.trim().match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/?$/i);
  return match ? match[1]!.replace(/\.git$/i, "") : null;
}

// Reuses the existing /api/github/sync route (github-sync-route.server.ts) —
// authenticated and ownership-checked there, which also does the write
// server-side now (Build Plan 0.5), so this is just the authenticated call.
export async function syncAiEmployeeGithubStats(id: string, repo: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to sync GitHub stats.");
  const res = await fetch(GITHUB_SYNC_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ repo, ai_employee_id: id }),
  });
  const body = (await res.json()) as GitHubRepoStats & { error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? "Couldn't fetch GitHub stats.");
}
