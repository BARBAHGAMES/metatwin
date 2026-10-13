-- Own grade history — mirrors get_my_pitch_scores().
create or replace function public.get_my_project_grades()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pg.id, 'project_id', pg.project_id, 'rating_label', pg.rating_label,
      'rating_score', pg.rating_score, 'grader_name', pg.grader_name, 'comment', pg.comment,
      'graded_at', pg.graded_at
    ) order by pg.graded_at desc, pg.created_at desc
  ), '[]'::jsonb)
  from public.project_grades pg
  where pg.twin_id = (select auth.uid());
$$;

revoke all on function public.get_my_project_grades() from public, anon;
grant execute on function public.get_my_project_grades() to authenticated;

-- The ONLY way a school admin ever sees student/project data: requires a
-- VERIFIED school_admins row for that exact university_id. A pending or
-- rejected admin, or one asking about a university that isn't theirs, gets
-- an empty result, not an error (avoids leaking which universities exist).
create or replace function public.get_my_institution_grades()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  admin public.school_admins;
begin
  select * into admin from public.school_admins
  where id = (select auth.uid()) and status = 'verified';
  if not found then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pg.id,
      'student_name', tw.name,
      'student_handle', tw.handle,
      'project_id', pg.project_id,
      'project_title', p.title,
      'rating_label', pg.rating_label,
      'rating_score', pg.rating_score,
      'grader_name', pg.grader_name,
      'comment', pg.comment,
      'graded_at', pg.graded_at
    ) order by pg.graded_at desc, pg.created_at desc)
    from public.project_grades pg
    join public.projects p on p.id = pg.project_id
    join public.twins tw on tw.id = pg.twin_id
    where pg.university_id = admin.university_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_my_institution_grades() from public, anon;
grant execute on function public.get_my_institution_grades() to authenticated;
