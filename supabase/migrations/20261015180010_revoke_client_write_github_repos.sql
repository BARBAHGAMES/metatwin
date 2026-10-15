-- Build Plan 0.5: github_repos was client-insert/update-able (the student's
-- browser wrote stars/forks/etc. straight from the GitHub API response),
-- so a student could forge those numbers through the API. Only the new
-- server-side sync route (github-sync-route.server.ts, via supabaseAdmin)
-- upserts this table now. Select and delete stay with the owner — a student
-- can still read their own row and unlink it.
--
-- The owner insert/update RLS policies (20261012021815) are left in place
-- and become inert, same convention as guard_twin_plan_and_activation_columns.
revoke insert, update on public.github_repos from authenticated;
