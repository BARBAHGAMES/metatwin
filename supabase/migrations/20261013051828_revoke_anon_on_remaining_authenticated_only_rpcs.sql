-- Same gap as 20261012171001 (get_my_teams/get_my_pitch_scores), found by
-- get_advisors(security): these were always meant to be authenticated-only,
-- but Supabase grants anon/authenticated EXECUTE directly at function
-- creation time (not through the PUBLIC pseudo-role), so the original
-- "revoke all ... from public" in each function's own migration never
-- touched anon's grant. Harmless today — every one of these keys off
-- auth.uid(), which is null for anon, so they just no-op/raise — but
-- explicit is safer than relying on that as the only guard.
revoke execute on function public.add_team_member(uuid, text, text) from anon;
revoke execute on function public.create_team(text, text) from anon;
revoke execute on function public.update_team(uuid, text, text, text, text) from anon;
revoke execute on function public.remove_team_member(uuid, uuid) from anon;
revoke execute on function public.leave_team(uuid) from anon;
revoke execute on function public.disconnect_github() from anon;
revoke execute on function public.get_my_github_connection() from anon;
