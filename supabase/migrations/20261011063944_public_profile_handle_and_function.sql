-- P1-5 (part A): shareable public profile.
-- A student picks a unique handle; /t/<handle> renders get_public_profile(handle).
-- Going public requires an adult declaration (twins_public_requires_adult,
-- P0-2) AND a handle. get_public_profile is the ONLY public read path: it
-- returns a fixed set of fields for exactly one handle, so anonymous visitors
-- can no longer list other students' rows through the API (part B removes the
-- old anon access to competencies/projects/evidence).
-- Never returned: email, birth year, is_adult, consent, study year, user id.
-- Evidence link/note and project artifact_url are returned only when the
-- student ticked public_show_evidence_details.

alter table public.twins
  add column handle text,
  add column public_show_evidence_details boolean not null default false;

alter table public.twins
  add constraint twins_handle_format check (
    handle is null or (
      handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
      and handle not in ('admin','api','www','metatwin','support','help','login','signup',
                         'dashboard','profile','about','pricing','null','undefined')
    )
  ),
  add constraint twins_public_requires_handle check (visibility = 'private' or handle is not null);

create unique index twins_handle_key on public.twins (handle);

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
begin
  select * into t
  from public.twins
  where handle = lower(btrim(p_handle)) and visibility = 'public' and is_adult;
  if not found then
    return null;
  end if;
  details := t.public_show_evidence_details;

  return jsonb_build_object(
    'handle', t.handle,
    'name', t.name,
    'headline', t.headline,
    'institution', t.institution,
    'programme', t.programme,
    'show_evidence_details', details,
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
              jsonb_build_object('id', e.id, 'title', e.title)
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
        || case when details then jsonb_build_object('artifact_url', p.artifact_url) else '{}'::jsonb end
        order by p.created_at desc)
      from public.projects p where p.twin_id = t.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
