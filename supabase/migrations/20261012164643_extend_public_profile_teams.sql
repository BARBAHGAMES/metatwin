-- Adds the twin's current public-team memberships, and tags each project
-- with its team (when that team is public) — this is how teams show up on
-- an individual's own page: a badge pointing at the team, not a full
-- duplicate of team data.
create or replace function public.get_public_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t public.twins;
  details boolean;
  gh public.github_connections;
begin
  select * into t
  from public.twins
  where handle = lower(btrim(p_handle)) and visibility = 'public' and is_adult;
  if not found then
    return null;
  end if;
  details := t.public_show_evidence_details;
  select * into gh from public.github_connections where twin_id = t.id;

  return jsonb_build_object(
    'handle', t.handle,
    'name', t.name,
    'headline', t.headline,
    'institution', t.institution,
    'programme', t.programme,
    'photo_url', t.photo_url,
    'show_evidence_details', details,
    'github_activity', case when gh.twin_id is null then null else jsonb_build_object(
      'username', gh.github_username,
      'avatar_url', gh.avatar_url,
      'total_contributions_year', gh.total_contributions_year,
      'current_streak_days', gh.current_streak_days,
      'top_languages', gh.top_languages,
      'public_repo_count', gh.public_repo_count
    ) end,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('slug', tm_t.slug, 'name', tm_t.name) order by tm_t.name)
      from public.team_members tm
      join public.teams tm_t on tm_t.id = tm.team_id
      where tm.twin_id = t.id and tm.left_at is null and tm_t.visibility = 'public'
    ), '[]'::jsonb),
    'capabilities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'skill', s.name,
          'category', s.category,
          'level', c.level,
          'evidence_count', c.evidence_count,
          'evidence', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', e.id, 'title', e.title,
                'reviewed', exists (
                  select 1 from public.evidence_reviews r
                  where r.evidence_id = e.id and r.submitted_at is not null
                )
              )
              || case when details then jsonb_build_object('link', e.link, 'note', e.note) else '{}'::jsonb end
              order by e.created_at desc)
            from public.evidence e where e.competency_id = c.id
          ), '[]'::jsonb)
        ) order by c.updated_at desc)
      from public.competencies c
      join public.skills s on s.id = c.skill_id
      where c.twin_id = t.id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description)
        || case when details then jsonb_build_object(
             'artifact_url', p.artifact_url, 'writeup_url', p.writeup_url, 'pitch_deck_url', p.pitch_deck_url
           ) else '{}'::jsonb end
        || coalesce((
             select jsonb_build_object('github', jsonb_build_object(
               'full_name', g.full_name, 'url', g.url, 'stars', g.stars, 'forks', g.forks,
               'language', g.language, 'last_commit_at', g.last_commit_at, 'weekly_commits', g.weekly_commits
             ))
             from public.github_repos g where g.project_id = p.id
           ), '{}'::jsonb)
        || coalesce((
             select jsonb_build_object('pitch_stats', jsonb_build_object(
               'total_pitches', ps.total_pitches, 'positive', ps.positive,
               'customers', ps.customers, 'conversion_pct', ps.conversion_pct
             ))
             from public.pitch_stats ps where ps.project_id = p.id
           ), '{}'::jsonb)
        || coalesce((
             select jsonb_build_object('team', jsonb_build_object('slug', pt.slug, 'name', pt.name))
             from public.teams pt where pt.id = p.team_id and pt.visibility = 'public'
           ), '{}'::jsonb)
        order by p.created_at desc)
      from public.projects p where p.twin_id = t.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
