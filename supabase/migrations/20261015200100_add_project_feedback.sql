-- Visitor feedback on projects (pitch flow v3, Release A, approved 2026-10-15).
--
-- Visitors to a public MetaTwin leave an overall 1-5 rating + comment on a project.
-- They must give an email (confirmed by a one-time link) and a WhatsApp number
-- (format-checked only). Contact details live in a separate locked table:
--   * the student never sees them in this release (email unlock is Release B,
--     and only for reviewers who ticked share_email_consent);
--   * school admins never see them;
--   * verified platform admins see them for moderation;
--   * they are deleted 12 months after confirmation (purge_expired_feedback_data()).
-- Feedback is never public (no get_public_profile change).
--
-- Access model (same lockdown as payments / pitch_scores): RLS on, zero policies,
-- no table grants to anon/authenticated. Writes happen only inside the
-- SECURITY DEFINER functions below; submit/confirm/purge are callable by
-- service_role only (the Worker's feedback routes), the read/owner functions by
-- signed-in users and scoped to the caller.

create table public.project_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  twin_id uuid not null references public.twins (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null,
  reviewer_name text not null,
  reviewer_role text not null check (reviewer_role in ('business_owner', 'investor', 'lecturer', 'mentor', 'student', 'other')),
  reviewer_org text,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  -- A re-submission by the same email on already-confirmed feedback waits here
  -- until that email confirms again; the confirmed version stays visible meanwhile.
  pending_update jsonb,
  -- What the project looked like when the feedback was given.
  snapshot jsonb not null default '{}'::jsonb,
  hidden_by_owner boolean not null default false,
  reported_at timestamptz,
  report_reason text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint project_feedback_project_owner_fkey
    foreign key (project_id, twin_id) references public.projects (id, twin_id) on delete cascade,
  constraint project_feedback_comment_length check (char_length(btrim(comment)) between 1 and 500),
  constraint project_feedback_comment_no_links check (comment !~* '(https?://|www\.)'),
  constraint project_feedback_name_length check (char_length(btrim(reviewer_name)) between 1 and 100),
  constraint project_feedback_org_length check (reviewer_org is null or char_length(reviewer_org) <= 120),
  constraint project_feedback_report_reason_length check (report_reason is null or char_length(report_reason) <= 300)
);
create index project_feedback_twin_status_idx on public.project_feedback (twin_id, status);
create index project_feedback_project_idx on public.project_feedback (project_id);

create table public.project_feedback_contacts (
  feedback_id uuid primary key references public.project_feedback (id) on delete cascade,
  project_id uuid not null,
  email text not null,
  whatsapp text not null,
  share_email_consent boolean not null default false,
  confirm_token_hash text,
  token_expires_at timestamptz,
  contacts_expire_at timestamptz not null default (now() + interval '12 months'),
  created_at timestamptz not null default now(),
  constraint project_feedback_contacts_one_per_email unique (project_id, email),
  constraint project_feedback_contacts_email_format check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint project_feedback_contacts_whatsapp_format check (whatsapp ~ '^\+[1-9][0-9]{7,14}$')
);
create index project_feedback_contacts_token_idx on public.project_feedback_contacts (confirm_token_hash) where confirm_token_hash is not null;
create index project_feedback_contacts_expiry_idx on public.project_feedback_contacts (contacts_expire_at);

alter table public.project_feedback enable row level security;
alter table public.project_feedback_contacts enable row level security;
revoke all on public.project_feedback, public.project_feedback_contacts from anon, authenticated;

-- ---------------------------------------------------------------- server-only writes

-- Called by the Worker's feedback route after it has validated input, verified
-- Turnstile and generated the confirmation token (only its SHA-256 is passed here).
create or replace function public.submit_project_feedback(
  p_handle text,
  p_project_id uuid,
  p_rating int,
  p_comment text,
  p_name text,
  p_role text,
  p_org text,
  p_email text,
  p_whatsapp text,
  p_consent boolean,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
  v_twin uuid;
  v_project public.projects;
  v_email text := lower(btrim(p_email));
  v_snapshot jsonb;
  v_existing record;
  v_feedback_id uuid;
  v_payload jsonb;
begin
  -- Same visibility rules as the public page: unknown, private, non-adult,
  -- deactivated and unpaid profiles all look identical (not found).
  v_profile := public.get_public_profile(p_handle);
  if v_profile is null or not exists (
    select 1 from jsonb_array_elements(v_profile -> 'projects') pr where pr ->> 'id' = p_project_id::text
  ) then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  select id into v_twin from public.twins where handle = lower(btrim(p_handle));
  select * into v_project from public.projects where id = p_project_id and twin_id = v_twin;

  if exists (select 1 from auth.users u where u.id = v_twin and lower(u.email) = v_email) then
    raise exception 'own_project' using errcode = 'P0001';
  end if;

  -- Abuse brake: at most 10 submissions per email per hour across all projects.
  if (select count(*) from public.project_feedback_contacts c
      join public.project_feedback f on f.id = c.feedback_id
      where c.email = v_email and f.updated_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_snapshot := jsonb_build_object(
    'title', v_project.title,
    'problem_statement', v_project.problem_statement,
    'proposed_solution', v_project.proposed_solution,
    'pitch_deck_url', v_project.pitch_deck_url,
    'stage', v_project.stage
  );
  v_payload := jsonb_build_object(
    'rating', p_rating, 'comment', btrim(p_comment), 'reviewer_name', btrim(p_name), 'reviewer_role', p_role,
    'reviewer_org', nullif(btrim(coalesce(p_org, '')), ''), 'snapshot', v_snapshot,
    'whatsapp', p_whatsapp, 'share_email_consent', coalesce(p_consent, false)
  );

  select f.id, f.status into v_existing
  from public.project_feedback_contacts c
  join public.project_feedback f on f.id = c.feedback_id
  where c.project_id = p_project_id and c.email = v_email;

  if v_existing.id is null then
    insert into public.project_feedback (project_id, twin_id, rating, comment, reviewer_name, reviewer_role, reviewer_org, snapshot)
    values (p_project_id, v_twin, p_rating, btrim(p_comment), btrim(p_name), p_role, nullif(btrim(coalesce(p_org, '')), ''), v_snapshot)
    returning id into v_feedback_id;
    insert into public.project_feedback_contacts (feedback_id, project_id, email, whatsapp, share_email_consent, confirm_token_hash, token_expires_at)
    values (v_feedback_id, p_project_id, v_email, p_whatsapp, coalesce(p_consent, false), p_token_hash, now() + interval '48 hours');
  elsif v_existing.status = 'pending' then
    v_feedback_id := v_existing.id;
    update public.project_feedback
      set rating = p_rating, comment = btrim(p_comment), reviewer_name = btrim(p_name), reviewer_role = p_role,
          reviewer_org = nullif(btrim(coalesce(p_org, '')), ''), snapshot = v_snapshot, updated_at = now()
      where id = v_feedback_id;
    update public.project_feedback_contacts
      set whatsapp = p_whatsapp, share_email_consent = coalesce(p_consent, false),
          confirm_token_hash = p_token_hash, token_expires_at = now() + interval '48 hours'
      where feedback_id = v_feedback_id;
  else
    -- Already confirmed: the change waits for this email to confirm again.
    -- (Validate the new content now, so a bad update fails here, not at confirm time.)
    v_feedback_id := v_existing.id;
    if p_rating not between 1 and 5 or char_length(btrim(p_comment)) not between 1 and 500
       or p_comment ~* '(https?://|www\.)' or char_length(btrim(p_name)) not between 1 and 100
       or p_role not in ('business_owner', 'investor', 'lecturer', 'mentor', 'student', 'other')
       or char_length(coalesce(p_org, '')) > 120 or p_whatsapp !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception 'invalid_feedback' using errcode = '23514';
    end if;
    update public.project_feedback set pending_update = v_payload, updated_at = now() where id = v_feedback_id;
    update public.project_feedback_contacts
      set confirm_token_hash = p_token_hash, token_expires_at = now() + interval '48 hours'
      where feedback_id = v_feedback_id;
  end if;

  return jsonb_build_object(
    'feedback_id', v_feedback_id,
    'student_name', v_profile ->> 'name',
    'project_title', v_project.title,
    'is_update', v_existing.id is not null and v_existing.status = 'confirmed'
  );
end;
$$;

-- Called by the Worker's confirm route with the SHA-256 of the token from the email link.
create or replace function public.confirm_project_feedback(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.project_feedback_contacts;
  f public.project_feedback;
  v_handle text;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into c from public.project_feedback_contacts where confirm_token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if c.token_expires_at is null or c.token_expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;
  select * into f from public.project_feedback where id = c.feedback_id;

  if f.status = 'pending' then
    update public.project_feedback set status = 'confirmed', confirmed_at = now(), updated_at = now() where id = f.id;
  elsif f.pending_update is not null then
    update public.project_feedback set
      rating = (f.pending_update ->> 'rating')::smallint,
      comment = f.pending_update ->> 'comment',
      reviewer_name = f.pending_update ->> 'reviewer_name',
      reviewer_role = f.pending_update ->> 'reviewer_role',
      reviewer_org = f.pending_update ->> 'reviewer_org',
      snapshot = coalesce(f.pending_update -> 'snapshot', f.snapshot),
      pending_update = null,
      confirmed_at = now(),
      updated_at = now()
    where id = f.id;
    update public.project_feedback_contacts set
      whatsapp = f.pending_update ->> 'whatsapp',
      share_email_consent = coalesce((f.pending_update ->> 'share_email_consent')::boolean, false)
    where feedback_id = f.id;
  end if;

  -- Single use; retention runs 12 months from the latest confirmation.
  update public.project_feedback_contacts
    set confirm_token_hash = null, token_expires_at = null, contacts_expire_at = now() + interval '12 months'
    where feedback_id = f.id;

  select t.handle into v_handle from public.twins t where t.id = f.twin_id;
  return jsonb_build_object(
    'status', 'confirmed',
    'handle', v_handle,
    'project_title', (select title from public.projects where id = f.project_id)
  );
end;
$$;

-- Retention: contact details 12 months after confirmation; unconfirmed feedback
-- after 48 hours; expired re-submissions are dropped (the confirmed version stays).
create or replace function public.purge_expired_feedback_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_contacts int;
  n_pending int;
  n_updates int;
begin
  delete from public.project_feedback f
    where f.status = 'pending' and f.created_at < now() - interval '48 hours';
  get diagnostics n_pending = row_count;

  update public.project_feedback f set pending_update = null
    where f.pending_update is not null
      and not exists (select 1 from public.project_feedback_contacts c
                      where c.feedback_id = f.id and c.token_expires_at > now());
  get diagnostics n_updates = row_count;

  delete from public.project_feedback_contacts c where c.contacts_expire_at < now();
  get diagnostics n_contacts = row_count;

  return jsonb_build_object('deleted_pending_feedback', n_pending, 'dropped_unconfirmed_updates', n_updates, 'deleted_contacts', n_contacts);
end;
$$;

revoke all on function public.submit_project_feedback(text, uuid, int, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.confirm_project_feedback(text) from public, anon, authenticated;
revoke all on function public.purge_expired_feedback_data() from public, anon, authenticated;
grant execute on function public.submit_project_feedback(text, uuid, int, text, text, text, text, text, text, boolean, text) to service_role;
grant execute on function public.confirm_project_feedback(text) to service_role;
grant execute on function public.purge_expired_feedback_data() to service_role;

-- ---------------------------------------------------------------- student (owner)

-- Confirmed feedback on the caller's own projects. Never returns contact details;
-- email_unlockable only says whether the reviewer consented (for Release B).
create or replace function public.get_my_project_feedback(p_project_id uuid default null)
returns table (
  id uuid, project_id uuid, project_title text, rating smallint, comment text,
  reviewer_name text, reviewer_role text, reviewer_org text, snapshot jsonb,
  hidden_by_owner boolean, reported_at timestamptz, created_at timestamptz, confirmed_at timestamptz,
  email_unlockable boolean, contact_expired boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.project_id, p.title, f.rating, f.comment, f.reviewer_name, f.reviewer_role, f.reviewer_org, f.snapshot,
         f.hidden_by_owner, f.reported_at, f.created_at, f.confirmed_at,
         coalesce(c.share_email_consent, false), c.feedback_id is null
  from public.project_feedback f
  join public.projects p on p.id = f.project_id
  left join public.project_feedback_contacts c on c.feedback_id = f.id
  where f.twin_id = (select auth.uid())
    and f.status = 'confirmed'
    and (p_project_id is null or f.project_id = p_project_id)
  order by f.confirmed_at desc nulls last;
$$;

create or replace function public.set_project_feedback_hidden(p_feedback_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_feedback set hidden_by_owner = coalesce(p_hidden, false), updated_at = now()
    where id = p_feedback_id and twin_id = (select auth.uid()) and status = 'confirmed';
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Reporting also hides it from the student's list; platform admins review reports.
create or replace function public.report_project_feedback(p_feedback_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_feedback
    set reported_at = now(), report_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 300), hidden_by_owner = true, updated_at = now()
    where id = p_feedback_id and twin_id = (select auth.uid()) and status = 'confirmed';
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------- school admin

-- Feedback on projects by students at the caller's own verified institution.
-- No parameters (same pattern as get_my_institution_grades). No contact details.
-- Hidden/reported feedback is excluded.
create or replace function public.get_my_institution_feedback()
returns table (
  id uuid, student_name text, student_handle text, project_title text, rating smallint, comment text,
  reviewer_name text, reviewer_role text, reviewer_org text, confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, t.name, t.handle, p.title, f.rating, f.comment, f.reviewer_name, f.reviewer_role, f.reviewer_org, f.confirmed_at
  from public.school_admins sa
  join public.twins t on t.university_id = sa.university_id
  join public.project_feedback f on f.twin_id = t.id
  join public.projects p on p.id = f.project_id
  where sa.id = (select auth.uid())
    and sa.status = 'verified'
    and f.status = 'confirmed'
    and not f.hidden_by_owner
  order by f.confirmed_at desc;
$$;

-- ---------------------------------------------------------------- platform admin

create or replace function public.admin_list_project_feedback()
returns table (
  id uuid, student_name text, student_handle text, project_title text, status text, rating smallint, comment text,
  reviewer_name text, reviewer_role text, reviewer_org text, reviewer_email text, reviewer_whatsapp text,
  share_email_consent boolean, hidden_by_owner boolean, reported_at timestamptz, report_reason text,
  created_at timestamptz, confirmed_at timestamptz, contacts_expire_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.id = (select auth.uid()) and pa.status = 'verified') then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  return query
    select f.id, t.name, t.handle, p.title, f.status, f.rating, f.comment, f.reviewer_name, f.reviewer_role, f.reviewer_org,
           c.email, c.whatsapp, c.share_email_consent, f.hidden_by_owner, f.reported_at, f.report_reason,
           f.created_at, f.confirmed_at, c.contacts_expire_at
    from public.project_feedback f
    join public.twins t on t.id = f.twin_id
    join public.projects p on p.id = f.project_id
    left join public.project_feedback_contacts c on c.feedback_id = f.id
    order by (f.reported_at is not null) desc, f.created_at desc;
end;
$$;

create or replace function public.admin_delete_project_feedback(p_feedback_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.id = (select auth.uid()) and pa.status = 'verified') then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  delete from public.project_feedback where id = p_feedback_id;
end;
$$;

revoke all on function public.get_my_project_feedback(uuid) from public, anon;
revoke all on function public.set_project_feedback_hidden(uuid, boolean) from public, anon;
revoke all on function public.report_project_feedback(uuid, text) from public, anon;
revoke all on function public.get_my_institution_feedback() from public, anon;
revoke all on function public.admin_list_project_feedback() from public, anon;
revoke all on function public.admin_delete_project_feedback(uuid) from public, anon;
grant execute on function public.get_my_project_feedback(uuid) to authenticated;
grant execute on function public.set_project_feedback_hidden(uuid, boolean) to authenticated;
grant execute on function public.report_project_feedback(uuid, text) to authenticated;
grant execute on function public.get_my_institution_feedback() to authenticated;
grant execute on function public.admin_list_project_feedback() to authenticated;
grant execute on function public.admin_delete_project_feedback(uuid) to authenticated;
