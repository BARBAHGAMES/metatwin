-- get_advisors flagged these as anon-executable despite the earlier
-- "revoke all ... from public" — Supabase's default privileges grant anon
-- EXECUTE directly (not via the PUBLIC pseudo-role), so revoking from
-- "public" alone doesn't touch it. Harmless today (both key off auth.uid(),
-- which is null for anon, so they just return empty/raise), but explicit is
-- better than relying on that as the only guard.
revoke execute on function public.get_my_teams() from anon;
revoke execute on function public.get_my_pitch_scores() from anon;
