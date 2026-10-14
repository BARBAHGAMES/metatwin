drop function public.list_open_collaboration_projects();

create function public.list_open_collaboration_projects()
returns table (
  project_id uuid,
  title text,
  problem_statement text,
  owner_twin_id uuid,
  owner_handle text,
  owner_name text,
  owner_headline text,
  owner_institution text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.problem_statement, t.id, t.handle, t.name, t.headline, t.institution
  from public.projects p
  join public.twins t on t.id = p.twin_id
  where p.open_to_collaborators = true
    and p.stage = 'idea'
    and p.twin_id <> (select auth.uid())
  order by p.created_at desc;
$$;

revoke all on function public.list_open_collaboration_projects() from public, anon;
grant execute on function public.list_open_collaboration_projects() to authenticated;
