create or replace function public.recompute_project_stage(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_twin_id uuid;
  v_stage text;
  v_interviews int;
  v_video_url text;
  v_new_stage text;
begin
  select twin_id, stage, interviews_count, pitch_video_url
    into v_twin_id, v_stage, v_interviews, v_video_url
  from public.projects where id = p_project_id;

  if v_twin_id is null then
    raise exception 'project not found';
  end if;
  if v_twin_id <> (select auth.uid()) then
    raise exception 'not your project';
  end if;
  if v_stage = 'completed' then
    return;
  end if;

  if v_interviews >= 40 and v_video_url is not null then
    v_new_stage := 'prototype';
  elsif v_interviews >= 10 then
    v_new_stage := 'in_progress';
  else
    v_new_stage := 'idea';
  end if;

  if v_new_stage <> v_stage then
    update public.projects set stage = v_new_stage where id = p_project_id;
  end if;
end;
$$;

create or replace function public.mark_project_complete(p_project_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_twin_id uuid;
begin
  if p_reason not in ('abandoned','graduated','business_adopted') then
    raise exception 'invalid completion reason';
  end if;

  select twin_id into v_twin_id from public.projects where id = p_project_id;
  if v_twin_id is null then
    raise exception 'project not found';
  end if;
  if v_twin_id <> (select auth.uid()) then
    raise exception 'not your project';
  end if;

  update public.projects
  set stage = 'completed', completion_reason = p_reason, completed_at = now()
  where id = p_project_id;
end;
$$;

revoke all on function public.recompute_project_stage(uuid) from public, anon;
revoke all on function public.mark_project_complete(uuid, text) from public, anon;
grant execute on function public.recompute_project_stage(uuid) to authenticated;
grant execute on function public.mark_project_complete(uuid, text) to authenticated;
