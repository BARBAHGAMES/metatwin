-- Plain client selects on collaboration_requests can't see the OTHER party's
-- twin info (name/handle/headline) since twins' own SELECT RLS is owner-only.
-- These two SECURITY DEFINER functions return each side's own view, joined,
-- same shape as get_my_teams()/get_my_pitch_scores().
create or replace function public.list_my_incoming_collaboration_requests()
returns table (
  id uuid,
  project_id uuid,
  project_title text,
  status text,
  message text,
  created_at timestamptz,
  requester_handle text,
  requester_name text,
  requester_headline text
)
language sql
stable
security definer
set search_path = public
as $$
  select cr.id, cr.project_id, p.title, cr.status, cr.message, cr.created_at,
         t.handle, t.name, t.headline
  from public.collaboration_requests cr
  join public.projects p on p.id = cr.project_id
  join public.twins t on t.id = cr.requester_twin_id
  where cr.owner_twin_id = (select auth.uid()) and cr.status = 'pending'
  order by cr.created_at desc;
$$;

create or replace function public.list_my_sent_collaboration_requests()
returns table (
  id uuid,
  project_id uuid,
  project_title text,
  status text,
  message text,
  created_at timestamptz,
  owner_handle text,
  owner_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select cr.id, cr.project_id, p.title, cr.status, cr.message, cr.created_at,
         t.handle, t.name
  from public.collaboration_requests cr
  join public.projects p on p.id = cr.project_id
  join public.twins t on t.id = cr.owner_twin_id
  where cr.requester_twin_id = (select auth.uid())
  order by cr.created_at desc;
$$;

revoke all on function public.list_my_incoming_collaboration_requests() from public, anon;
revoke all on function public.list_my_sent_collaboration_requests() from public, anon;
grant execute on function public.list_my_incoming_collaboration_requests() to authenticated;
grant execute on function public.list_my_sent_collaboration_requests() to authenticated;
