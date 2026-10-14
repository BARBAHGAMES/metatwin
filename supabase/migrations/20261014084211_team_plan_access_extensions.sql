-- A student's access is active if their OWN plan is active, OR they are a
-- CURRENT member of a team whose own plan is active — checked live here,
-- never copied into the twin's own row (see has_team_plan_access() below
-- for the client-gate equivalent of this same OR).

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
  where handle = lower(btrim(p_handle))
    and visibility = 'public'
    and is_adult
    and is_active
    and (
      (plan_status = 'grandfathered' or (plan_status = 'paid' and plan_paid_until > now()))
      or exists (
        select 1 from public.team_members tm
        join public.teams tm_t on tm_t.id = tm.team_id
        where tm.twin_id = twins.id and tm.left_at is null
          and tm_t.plan_status = 'paid' and tm_t.plan_paid_until > now()
      )
    );
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
    'pitch_scores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'competition_name', ps.competition_name, 'round_name', ps.round_name, 'event_date', ps.event_date,
        'problem_score', ps.problem_score, 'solution_score', ps.solution_score,
        'team_score', ps.team_score, 'ask_score', ps.ask_score, 'total_score', ps.total_score
      ) order by ps.event_date desc)
      from public.pitch_scores ps where ps.twin_id = t.id
    ), '[]'::jsonb),
    'ai_employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ae.id, 'name', ae.name, 'role', ae.role, 'platform', ae.platform,
        'description', ae.description, 'link_url', ae.link_url
      ) order by ae.created_at)
      from public.ai_employees ae where ae.twin_id = t.id
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
             'artifact_url', p.artifact_url, 'writeup_url', p.writeup_url, 'pitch_deck_url', p.pitch_deck_url,
             'pitch_video_url', p.pitch_video_url
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
        || case when p.pitch_scores is not null and p.pitch_scores <> '{}'::jsonb
             then jsonb_build_object('pitch_feedback', p.pitch_scores) else '{}'::jsonb end
        || coalesce((
             select jsonb_build_object('grade', jsonb_build_object(
               'rating_label', pg.rating_label, 'rating_score', pg.rating_score
             ))
             from public.project_grades pg where pg.project_id = p.id
             order by pg.graded_at desc limit 1
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

create or replace function public.list_public_twins()
returns table (
  handle text,
  name text,
  headline text,
  institution text,
  photo_url text,
  github_username text,
  github_total_contributions_year integer
)
language sql
stable
security definer
set search_path = public
as $$
  select t.handle, t.name, t.headline, t.institution, t.photo_url,
         gh.github_username, gh.total_contributions_year
  from public.twins t
  left join public.github_connections gh on gh.twin_id = t.id
  where t.visibility = 'public'
    and t.is_adult
    and t.is_active
    and t.handle is not null
    and (
      (t.plan_status = 'grandfathered' or (t.plan_status = 'paid' and t.plan_paid_until > now()))
      or exists (
        select 1 from public.team_members tm
        join public.teams tm_t on tm_t.id = tm.team_id
        where tm.twin_id = t.id and tm.left_at is null
          and tm_t.plan_status = 'paid' and tm_t.plan_paid_until > now()
      )
    )
  order by t.updated_at desc;
$$;

revoke all on function public.list_public_twins() from public;
grant execute on function public.list_public_twins() to anon, authenticated;

-- An unpaid team's public page 404s, symmetric with an unpaid individual's.
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
  select * into t
  from public.teams
  where slug = lower(btrim(p_slug))
    and visibility = 'public'
    and plan_status = 'paid' and plan_paid_until > now();
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

-- Client-gate equivalent of the same OR used above: does the CALLER have
-- active access via a team they currently belong to (not their own plan —
-- callers combine this with their own twins.plan_status/plan_paid_until).
create or replace function public.has_team_plan_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams tm_t on tm_t.id = tm.team_id
    where tm.twin_id = (select auth.uid()) and tm.left_at is null
      and tm_t.plan_status = 'paid' and tm_t.plan_paid_until > now()
  );
$$;

revoke all on function public.has_team_plan_access() from public, anon;
grant execute on function public.has_team_plan_access() to authenticated;
