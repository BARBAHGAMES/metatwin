alter table public.projects
  add column problem_statement text,
  add column proposed_solution text;

alter table public.projects
  add constraint projects_narrative_lengths check (
    (problem_statement is null or char_length(problem_statement) <= 1000)
    and (proposed_solution is null or char_length(proposed_solution) <= 1000)
  );

grant select (problem_statement, proposed_solution) on public.projects to anon, authenticated;
grant insert (problem_statement, proposed_solution), update (problem_statement, proposed_solution) on public.projects to authenticated;
