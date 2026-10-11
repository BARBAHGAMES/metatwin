-- Bug: "public select when twin visible" policies on competencies, projects,
-- and evidence each ran `exists (select 1 from twins where ... visibility = 'public')`
-- directly. That subquery is itself subject to twins' own RLS (owner-select
-- only, no public policy by design), so for any role other than the twin's
-- owner the subquery always saw zero rows -- these "public when visible"
-- policies have been dead since the first migration. Fix: a SECURITY
-- DEFINER helper (same bypass-RLS pattern as handle_new_user()) that checks
-- visibility without going through twins' RLS, exposing only a single
-- boolean -- nothing else about the twin.
create or replace function public.twin_is_public(p_twin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.twins where id = p_twin_id and visibility = 'public');
$$;

grant execute on function public.twin_is_public(uuid) to anon, authenticated;

drop policy "competencies: public select when twin visible" on public.competencies;
create policy "competencies: public select when twin visible" on public.competencies for select
  using (public.twin_is_public(twin_id));

drop policy "projects: public select when twin visible" on public.projects;
create policy "projects: public select when twin visible" on public.projects for select
  using (public.twin_is_public(twin_id));

drop policy "evidence: public select when twin visible" on public.evidence;
create policy "evidence: public select when twin visible" on public.evidence for select
  using (public.twin_is_public(twin_id));
