create table public.pitches (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  project_id uuid not null,
  business_name text not null,
  sector text,
  pitched_on date not null default current_date,
  outcome text not null default 'follow-up' check (outcome in ('interested', 'follow-up', 'no', 'customer')),
  notes text,
  created_at timestamptz not null default now(),
  constraint pitches_business_name_length check (char_length(business_name) between 1 and 160),
  constraint pitches_sector_length check (sector is null or char_length(sector) <= 120),
  constraint pitches_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint pitches_project_owner_fkey
    foreign key (project_id, twin_id) references public.projects (id, twin_id) on delete cascade
);

create index pitches_twin_id_idx on public.pitches (twin_id);
create index pitches_project_id_idx on public.pitches (project_id);

alter table public.pitches enable row level security;

create policy "pitches: owner select" on public.pitches
  for select to authenticated using ((select auth.uid()) = twin_id);
create policy "pitches: owner insert" on public.pitches
  for insert to authenticated with check ((select auth.uid()) = twin_id);
create policy "pitches: owner update" on public.pitches
  for update to authenticated using ((select auth.uid()) = twin_id);
create policy "pitches: owner delete" on public.pitches
  for delete to authenticated using ((select auth.uid()) = twin_id);

grant select, insert, update, delete on public.pitches to authenticated;

create view public.pitch_stats
with (security_invoker = true) as
select
  project_id,
  twin_id,
  count(*)::int as total_pitches,
  count(*) filter (where outcome in ('interested', 'customer'))::int as positive,
  count(*) filter (where outcome = 'customer')::int as customers,
  round(100.0 * count(*) filter (where outcome in ('interested', 'customer')) / nullif(count(*), 0))::int as conversion_pct
from public.pitches
group by project_id, twin_id;

grant select on public.pitch_stats to authenticated;
