import { supabase } from "@/integrations/supabase/client";
import type { MyPitchScore, PublicPitchScore } from "./pitch-scores";

export type MyTeamMember = { twin_id: string; name: string | null; handle: string | null; role: string | null };
export type MyTeamProject = {
  id: string;
  title: string;
  description: string | null;
  artifact_url: string | null;
  writeup_url: string | null;
  pitch_deck_url: string | null;
  pitch_video_url: string | null;
};
export type MyTeam = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  avatar_url: string | null;
  is_creator: boolean;
  plan_tier: "basic" | "guided" | "builder" | null;
  plan_package: "duo" | "studio" | "launch" | null;
  plan_status: "unpaid" | "paid";
  plan_paid_until: string | null;
  members: MyTeamMember[];
  projects: MyTeamProject[];
  pitch_scores: MyPitchScore[];
};

export async function fetchMyTeams(): Promise<MyTeam[]> {
  const { data, error } = await supabase.rpc("get_my_teams");
  if (error) throw new Error(error.message);
  return (data as unknown as MyTeam[] | null) ?? [];
}

export async function createTeam(name: string, description: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_team", { p_name: name, p_description: description || undefined });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function updateTeam(args: { teamId: string; name: string; description: string; slug: string; visibility: "public" | "private" }): Promise<void> {
  const { error } = await supabase.rpc("update_team", {
    p_team_id: args.teamId,
    p_name: args.name,
    p_description: args.description,
    p_slug: args.slug,
    p_visibility: args.visibility,
  });
  if (error) throw new Error(error.message);
}

export async function addTeamMember(teamId: string, handle: string, role: string): Promise<void> {
  const { error } = await supabase.rpc("add_team_member", { p_team_id: teamId, p_handle: handle, p_role: role || undefined });
  if (error) throw new Error(error.message);
}

export async function leaveTeam(teamId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_team", { p_team_id: teamId });
  if (error) throw new Error(error.message);
}

export async function removeTeamMember(teamId: string, twinId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_team_member", { p_team_id: teamId, p_twin_id: twinId });
  if (error) throw new Error(error.message);
}

export type PublicTeamMember = { handle: string; name: string | null; headline: string | null; photo_url: string | null; role: string | null };
export type PublicTeamProject = { id: string; title: string; description: string | null };
export type PublicTeamProfile = {
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  members: PublicTeamMember[];
  projects: PublicTeamProject[];
  pitch_scores: PublicPitchScore[];
};

export async function fetchTeamPublicProfile(slug: string): Promise<PublicTeamProfile | null> {
  const { data, error } = await supabase.rpc("get_team_public_profile", { p_slug: slug });
  if (error) throw new Error(error.message);
  return (data as unknown as PublicTeamProfile | null) ?? null;
}
