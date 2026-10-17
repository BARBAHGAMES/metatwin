-- Deck views (pitch flow v3, Release A): count how often visitors open a
-- project's pitch deck on MetaTwin, so the student can see interest.
--
-- Privacy by design (pitch flow §3, D12 spirit):
--   * no IP address, user agent or account id is stored, only a daily-rotating
--     salted hash computed by the Worker (de-duplication: one view per visitor
--     per project per day) and the country code Cloudflare already provides;
--   * the student never learns who viewed (counts and countries only). Signed-in
--     visitors are recorded the same way as anonymous ones (decision on naming
--     them is still open; counts-only is the privacy-safe default);
--   * rows older than 13 months are purged with the other feedback retention.
--
-- Writes: service_role only (the Worker's /api/projects/deck-view route).
-- Reads: get_my_deck_views() for the project owner.

create table public.project_deck_views (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  view_day date not null default (now() at time zone 'utc')::date,
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  constraint project_deck_views_one_per_day unique (project_id, visitor_hash, view_day)
);
create index project_deck_views_project_day_idx on public.project_deck_views (project_id, view_day);

alter table public.project_deck_views enable row level security;
revoke all on public.project_deck_views from anon, authenticated;

-- Records a view if the project is shown on a public profile (same rules as
-- the public page). Idempotent per visitor per day. Returns true if counted.
create or replace function public.record_deck_view(p_handle text, p_project_id uuid, p_visitor_hash text, p_country text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
  v_inserted int;
begin
  v_profile := public.get_public_profile(p_handle);
  if v_profile is null or not exists (
    select 1 from jsonb_array_elements(v_profile -> 'projects') pr
    where pr ->> 'id' = p_project_id::text and coalesce(pr ->> 'pitch_deck_url', '') <> ''
  ) then
    return false;
  end if;
  insert into public.project_deck_views (project_id, visitor_hash, country)
  values (p_project_id, p_visitor_hash, case when p_country ~ '^[A-Z]{2}$' then p_country else null end)
  on conflict (project_id, visitor_hash, view_day) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

-- Owner summary: totals and top countries per project (never visitor-level rows).
create or replace function public.get_my_deck_views(p_project_id uuid default null)
returns table (project_id uuid, total bigint, last_7_days bigint, last_viewed_at timestamptz, countries jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select v.project_id,
         count(*) as total,
         count(*) filter (where v.view_day > (now() at time zone 'utc')::date - 7) as last_7_days,
         max(v.created_at) as last_viewed_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('country', c.country, 'views', c.n) order by c.n desc)
           from (
             select v2.country, count(*) as n from public.project_deck_views v2
             where v2.project_id = v.project_id and v2.country is not null
             group by v2.country order by count(*) desc limit 5
           ) c
         ), '[]'::jsonb) as countries
  from public.project_deck_views v
  join public.projects p on p.id = v.project_id
  where p.twin_id = (select auth.uid())
    and (p_project_id is null or v.project_id = p_project_id)
  group by v.project_id;
$$;

-- Retention for deck views joins the existing feedback purge.
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
  n_views int;
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

  delete from public.project_deck_views v where v.created_at < now() - interval '13 months';
  get diagnostics n_views = row_count;

  return jsonb_build_object('deleted_pending_feedback', n_pending, 'dropped_unconfirmed_updates', n_updates,
                            'deleted_contacts', n_contacts, 'deleted_deck_views', n_views);
end;
$$;

revoke all on function public.record_deck_view(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_deck_view(text, uuid, text, text) to service_role;
revoke all on function public.get_my_deck_views(uuid) from public, anon;
grant execute on function public.get_my_deck_views(uuid) to authenticated;
revoke all on function public.purge_expired_feedback_data() from public, anon, authenticated;
grant execute on function public.purge_expired_feedback_data() to service_role;
