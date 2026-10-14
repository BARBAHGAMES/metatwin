-- Verified-admin-only, unspoofable the same way as deactivate_twin: gated
-- on the CALLER's own verified platform_admins row via auth.uid(), not a
-- passed-in parameter. Returns an empty set (not an error) for a non-admin
-- caller, matching list_public_twins' style. Joining auth.users for email
-- inside a SECURITY DEFINER function is an already-audited pattern in this
-- codebase (every webhook trigger does the same) and is never reachable by
-- anyone but a verified admin.
create or replace function public.get_admin_dashboard_data()
returns table (
  id uuid,
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  name text,
  headline text,
  institution text,
  programme text,
  is_adult boolean,
  is_active boolean,
  deactivated_at timestamptz,
  capability_count bigint,
  evidence_count bigint,
  project_count bigint,
  has_public_profile boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    t.id,
    u.email,
    u.email_confirmed_at,
    t.created_at,
    t.name,
    t.headline,
    t.institution,
    t.programme,
    t.is_adult,
    t.is_active,
    t.deactivated_at,
    (select count(*) from public.competencies c where c.twin_id = t.id),
    (select count(*) from public.evidence e where e.twin_id = t.id),
    (select count(*) from public.projects p where p.twin_id = t.id),
    (t.visibility = 'public' and t.handle is not null)
  from public.twins t
  join auth.users u on u.id = t.id
  where exists (
    select 1 from public.platform_admins pa where pa.id = (select auth.uid()) and pa.status = 'verified'
  )
  order by t.created_at desc;
$$;

revoke all on function public.get_admin_dashboard_data() from public, anon;
grant execute on function public.get_admin_dashboard_data() to authenticated;
