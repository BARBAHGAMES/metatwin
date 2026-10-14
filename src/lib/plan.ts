import { supabase } from "@/integrations/supabase/client";

// Client-side mirror of the same check the database makes in
// get_public_profile/list_public_twins (supabase/migrations/..._exclude_unpaid_twins_from_public_reads.sql).
// 'grandfathered' never expires (the pilot cohort); 'paid' expires at
// plan_paid_until; 'unpaid' is never active.
export function hasActivePlan(twin: { plan_status: string; plan_paid_until: string | null }): boolean {
  if (twin.plan_status === "grandfathered") return true;
  if (twin.plan_status === "paid" && twin.plan_paid_until) {
    return new Date(twin.plan_paid_until).getTime() > Date.now();
  }
  return false;
}

// Access inherited from a team's plan is never copied onto the twin's own
// row (see has_team_plan_access() in supabase/migrations/..._team_plan_access_extensions.sql
// for why) — this is the other half of "does this student have active
// access," checked live, separately from hasActivePlan() above.
export async function fetchHasTeamPlanAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_team_plan_access");
  if (error) {
    console.error("[plan] has_team_plan_access failed:", error.message);
    return false;
  }
  return !!data;
}

// Same shape as hasActivePlan() above, applied to a team's own plan fields
// (no 'grandfathered' status for teams — none existed before paywalls did).
export function hasActiveTeamPlan(team: { plan_status: string; plan_paid_until: string | null }): boolean {
  return team.plan_status === "paid" && !!team.plan_paid_until && new Date(team.plan_paid_until).getTime() > Date.now();
}

// Mirrors the cap baked into add_team_member() in
// supabase/migrations/..._add_teams_plan_and_seat_cap.sql — keep in sync.
export function teamSeatCap(plan_package: string | null): number {
  if (plan_package === "duo") return 2;
  if (plan_package === "studio") return 3;
  if (plan_package === "launch") return 5;
  return 1;
}
