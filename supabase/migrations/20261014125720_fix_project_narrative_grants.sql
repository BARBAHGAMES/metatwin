-- projects has no anon grants at all (public reads go through get_public_profile,
-- a SECURITY DEFINER function, not a direct anon select) and authenticated already
-- has table-wide grants that auto-cover new columns. The column-level grants added
-- in add_project_narrative_fields were unnecessary; undo them to match the existing pattern.
revoke select (problem_statement, proposed_solution) on public.projects from anon, authenticated;
revoke insert (problem_statement, proposed_solution), update (problem_statement, proposed_solution) on public.projects from authenticated;
