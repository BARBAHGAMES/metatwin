-- Adds the team's own plan fields so the dashboard can show current
-- plan/seat usage and the team-lead "upgrade team" UI without an extra round trip.
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
      'avatar_url', t.avatar_url,
      'is_creator', t.created_by = (select auth.uid()),
      'plan_tier', t.plan_tier,
      'plan_package', t.plan_package,
      'plan_status', t.plan_status,
      'plan_paid_until', t.plan_paid_until,
      'members', (
        select jsonb_agg(jsonb_build_object(
          'twin_id', tm2.twin_id, 'name', tw.name, 'handle', tw.handle, 'role', tm2.role
        ) order by tm2.joined_at)
        from public.team_members tm2
        join public.twins tw on tw.id = tm2.twin_id
        where tm2.team_id = t.id and tm2.left_at is null
      ),
      'projects', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'title', p.title, 'description', p.description,
          'artifact_url', p.artifact_url, 'writeup_url', p.writeup_url,
          'pitch_deck_url', p.pitch_deck_url, 'pitch_video_url', p.pitch_video_url
        ) order by p.created_at desc)
        from public.projects p where p.team_id = t.id
      ), '[]'::jsonb),
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

revoke all on function public.get_my_teams() from public, anon;
grant execute on function public.get_my_teams() to authenticated;
