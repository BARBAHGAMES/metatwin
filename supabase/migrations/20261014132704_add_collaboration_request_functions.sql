create or replace function public.list_open_collaboration_projects()
returns table (
  project_id uuid,
  title text,
  problem_statement text,
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
  select p.id, p.title, p.problem_statement, t.handle, t.name, t.headline, t.institution
  from public.projects p
  join public.twins t on t.id = p.twin_id
  where p.open_to_collaborators = true
    and p.stage = 'idea'
    and p.twin_id <> (select auth.uid())
  order by p.created_at desc;
$$;

revoke all on function public.list_open_collaboration_projects() from public, anon;
grant execute on function public.list_open_collaboration_projects() to authenticated;

create or replace function public.accept_collaboration_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_twin_id uuid;
  v_requester_twin_id uuid;
  v_status text;
  v_project_id uuid;
  v_team_id uuid;
  v_package text;
  v_cap int;
  v_current_count int;
begin
  select owner_twin_id, requester_twin_id, status, project_id
    into v_owner_twin_id, v_requester_twin_id, v_status, v_project_id
  from public.collaboration_requests where id = p_request_id;

  if v_owner_twin_id is null then
    raise exception 'request not found';
  end if;
  if v_owner_twin_id <> (select auth.uid()) then
    raise exception 'not your request to accept';
  end if;
  if v_status <> 'pending' then
    raise exception 'request already resolved';
  end if;

  select team_id into v_team_id from public.projects where id = v_project_id;

  if v_team_id is null then
    insert into public.teams (name, created_by)
    select title, v_owner_twin_id from public.projects where id = v_project_id
    returning id into v_team_id;

    insert into public.team_members (team_id, twin_id, role)
    values (v_team_id, v_owner_twin_id, 'Lead');

    update public.projects set team_id = v_team_id where id = v_project_id;
  end if;

  select count(*) into v_current_count from public.team_members where team_id = v_team_id and left_at is null;

  if v_current_count < 2 then
    -- the first co-founder gained through pairing is always free, regardless of plan.
    insert into public.team_members (team_id, twin_id, role)
    values (v_team_id, v_requester_twin_id, null)
    on conflict (team_id, twin_id) do update set left_at = null, joined_at = now();
  else
    select plan_package into v_package from public.teams where id = v_team_id;
    v_cap := case v_package
      when 'duo' then 2
      when 'studio' then 3
      when 'launch' then 5
      else 1
    end;
    if v_current_count >= v_cap then
      raise exception 'Upgrade your team to pair with more students.' using errcode = 'P0001';
    end if;
    insert into public.team_members (team_id, twin_id, role)
    values (v_team_id, v_requester_twin_id, null)
    on conflict (team_id, twin_id) do update set left_at = null, joined_at = now();
  end if;

  update public.collaboration_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.accept_collaboration_request(uuid) from public, anon;
grant execute on function public.accept_collaboration_request(uuid) to authenticated;
