create or replace function public.create_team(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 120 then
    raise exception 'team name is required';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'description is too long';
  end if;

  insert into public.teams (name, description, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), auth.uid())
  returning id into v_team_id;

  insert into public.team_members (team_id, twin_id, role)
  values (v_team_id, auth.uid(), 'Lead');

  return v_team_id;
end;
$$;

revoke all on function public.create_team(text, text) from public;
grant execute on function public.create_team(text, text) to authenticated;

-- Only the team's creator can change its settings — a member added by
-- someone else shouldn't be able to flip the team public or rename it.
-- Any current member can still add/remove-self (see below).
create or replace function public.update_team(
  p_team_id uuid,
  p_name text,
  p_description text,
  p_slug text,
  p_visibility text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.teams where id = p_team_id and created_by = (select auth.uid())) then
    raise exception 'only the team creator can edit team details';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 120 then
    raise exception 'team name is required';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'description is too long';
  end if;
  if p_visibility not in ('public', 'private') then
    raise exception 'invalid visibility';
  end if;
  if p_visibility = 'public' and (p_slug is null or char_length(trim(p_slug)) = 0) then
    raise exception 'a public team needs a URL handle';
  end if;

  update public.teams
  set name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      slug = nullif(lower(trim(coalesce(p_slug, ''))), ''),
      visibility = p_visibility,
      updated_at = now()
  where id = p_team_id;
end;
$$;

revoke all on function public.update_team(uuid, text, text, text, text) from public;
grant execute on function public.update_team(uuid, text, text, text, text) to authenticated;

-- Looks people up by handle (the same identifier already used for public
-- sharing, /t/$handle) rather than email, to avoid turning this into an
-- account-enumeration-by-email oracle. A student without a handle set yet
-- can't be added this way until they set one on their own profile.
create or replace function public.add_team_member(p_team_id uuid, p_handle text, p_role text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_twin_id uuid;
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

create or replace function public.leave_team(p_team_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.team_members set left_at = now()
  where team_id = p_team_id and twin_id = (select auth.uid()) and left_at is null;
$$;

revoke all on function public.leave_team(uuid) from public;
grant execute on function public.leave_team(uuid) to authenticated;

create or replace function public.remove_team_member(p_team_id uuid, p_twin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.teams where id = p_team_id and created_by = (select auth.uid())) then
    raise exception 'only the team creator can remove members';
  end if;
  update public.team_members set left_at = now()
  where team_id = p_team_id and twin_id = p_twin_id and left_at is null;
end;
$$;

revoke all on function public.remove_team_member(uuid, uuid) from public;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;

create or replace function public.get_my_teams()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'slug', t.slug,
      'name', t.name,
      'description', t.description,
      'visibility', t.visibility,
      'is_creator', t.created_by = (select auth.uid()),
      'members', (
        select jsonb_agg(jsonb_build_object(
          'twin_id', tm2.twin_id, 'name', tw.name, 'handle', tw.handle, 'role', tm2.role
        ) order by tm2.joined_at)
        from public.team_members tm2
        join public.twins tw on tw.id = tm2.twin_id
        where tm2.team_id = t.id and tm2.left_at is null
      )
    ) order by t.created_at desc
  ), '[]'::jsonb)
  from public.teams t
  join public.team_members tm on tm.team_id = t.id
  where tm.twin_id = (select auth.uid()) and tm.left_at is null;
$$;

revoke all on function public.get_my_teams() from public;
grant execute on function public.get_my_teams() to authenticated;

-- Member roster here only ever includes members whose OWN profile is
-- public+adult+handled — same gate as get_public_profile. A private member
-- is simply omitted, never named without a link, even though they're on a
-- public team. Projects attributed to this team show regardless of the
-- owning twin's own visibility, since the team itself opted in to public.
create or replace function public.get_team_public_profile(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t public.teams;
begin
  select * into t from public.teams where slug = lower(btrim(p_slug)) and visibility = 'public';
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'slug', t.slug,
    'name', t.name,
    'description', t.description,
    'avatar_url', t.avatar_url,
    'member_count', (select count(*) from public.team_members where team_id = t.id and left_at is null),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'handle', tw.handle, 'name', tw.name, 'headline', tw.headline, 'photo_url', tw.photo_url, 'role', tm.role
      ) order by tm.joined_at)
      from public.team_members tm
      join public.twins tw on tw.id = tm.twin_id
      where tm.team_id = t.id and tm.left_at is null and tw.visibility = 'public' and tw.is_adult and tw.handle is not null
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description) order by p.created_at desc)
      from public.projects p where p.team_id = t.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_team_public_profile(text) from public;
grant execute on function public.get_team_public_profile(text) to anon, authenticated;
