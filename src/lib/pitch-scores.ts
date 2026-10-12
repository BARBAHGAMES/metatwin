import { supabase } from "@/integrations/supabase/client";

export type PitchScoreRubric = {
  problem_score: number;
  solution_score: number;
  team_score: number;
  ask_score: number;
  total_score: number;
};

export type MyPitchScore = PitchScoreRubric & {
  id: string;
  competition_name: string;
  round_name: string | null;
  event_date: string;
  judge_name: string | null;
  judge_comment: string | null;
};

export async function fetchMyPitchScores(): Promise<MyPitchScore[]> {
  const { data, error } = await supabase.rpc("get_my_pitch_scores");
  if (error) throw new Error(error.message);
  return (data as unknown as MyPitchScore[] | null) ?? [];
}

// Public summaries carry the same rubric fields but never judge_comment —
// that's a private, owner/member-only view (see get_my_pitch_scores and the
// per-team scores inside get_my_teams).
export type PublicPitchScore = PitchScoreRubric & {
  competition_name: string;
  round_name: string | null;
  event_date: string;
};
