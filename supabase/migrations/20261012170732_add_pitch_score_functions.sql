-- Own pitch score history, including the judge's comment — visible only to
-- the twin themselves, never surfaced publicly (see get_public_profile).
create or replace function public.get_my_pitch_scores()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id, 'competition_name', competition_name, 'round_name', round_name,
      'event_date', event_date, 'problem_score', problem_score, 'solution_score', solution_score,
      'team_score', team_score, 'ask_score', ask_score, 'total_score', total_score,
      'judge_name', judge_name, 'judge_comment', judge_comment
    ) order by event_date desc, created_at desc
  ), '[]'::jsonb)
  from public.pitch_scores
  where twin_id = (select auth.uid());
$$;

revoke all on function public.get_my_pitch_scores() from public;
grant execute on function public.get_my_pitch_scores() to authenticated;

-- Teams show up together: a team's pitch scores belong to the team, visible
-- to any current member here (including the judge's comment — this is a
-- private, members-only view, same boundary as the rest of get_my_teams()).
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
      ),
      'pitch_scores', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ps.id, 'competition_name', ps.competition_name, 'round_name', ps.round_name,
          'event_date', ps.event_date, 'problem_score', ps.problem_score, 'solution_score', ps.solution_score,
          'team_score', ps.team_score, 'ask_score', ps.ask_score, 'total_score', ps.total_score,
          'judge_name', ps.judge_name, 'judge_comment', ps.judge_comment
        ) order by ps.event_date desc, ps.created_at desc)
        from public.pitch_scores ps where ps.team_id = t.id
      ), '[]'::jsonb)
    ) order by t.created_at desc
  ), '[]'::jsonb)
  from public.teams t
  join public.team_members tm on tm.team_id = t.id
  where tm.twin_id = (select auth.uid()) and tm.left_at is null;
$$;

revoke all on function public.get_my_teams() from public;
grant execute on function public.get_my_teams() to authenticated;
