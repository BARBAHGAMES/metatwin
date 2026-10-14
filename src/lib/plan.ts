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
