-- Team-level billing: the team lead (teams.created_by) pays for a package
-- (seat cap) at a tier. No 'grandfathered' status needed — 0 teams exist
-- yet, nothing to protect.
alter table public.teams
  add column plan_tier text check (plan_tier in ('basic', 'guided', 'builder')),
  add column plan_package text check (plan_package in ('duo', 'studio', 'launch')),
  add column plan_status text not null default 'unpaid' check (plan_status in ('unpaid', 'paid')),
  add column plan_paid_until timestamptz;

-- Seat cap enforcement, redefining add_team_member in full (same function,
-- same signature). An unpaid/no-package team's cap is 1 — just the creator
-- from create_team — matching "free to start a team, pay to add anyone."
-- Cap mirrors teamPackages in src/lib/pricing.ts (duo=2/studio=3/launch=5) —
-- keep these in sync if that file's member counts ever change.
create or replace function public.add_team_member(p_team_id uuid, p_handle text, p_role text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_twin_id uuid;
  v_package text;
  v_cap int;
  v_current_count int;
begin
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and twin_id = (select auth.uid()) and left_at is null
  ) then
    raise exception 'only current team members can add others';
  end if;
  if p_role is not null and char_length(p_role) > 60 then
    raise exception 'role is too long';
  end if;

  select plan_package into v_package from public.teams where id = p_team_id;
  v_cap := case v_package
    when 'duo' then 2
    when 'studio' then 3
    when 'launch' then 5
    else 1
  end;
  select count(*) into v_current_count from public.team_members where team_id = p_team_id and left_at is null;
  if v_current_count >= v_cap then
    raise exception 'Upgrade your team to add more members.' using errcode = 'P0001';
  end if;

  select id into v_twin_id from public.twins where handle = lower(btrim(p_handle));
  if v_twin_id is null then
    raise exception 'no MetaTwin found with that handle';
  end if;

  insert into public.team_members (team_id, twin_id, role)
  values (p_team_id, v_twin_id, nullif(trim(coalesce(p_role, '')), ''))
  on conflict (team_id, twin_id) do update set left_at = null, role = excluded.role, joined_at = now();
end;
$$;

revoke all on function public.add_team_member(uuid, text, text) from public;
grant execute on function public.add_team_member(uuid, text, text) to authenticated;
