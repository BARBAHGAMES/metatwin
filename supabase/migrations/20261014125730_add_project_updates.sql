create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  project_id uuid not null,
  kind text not null check (kind in ('iteration', 'pivot')),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint project_updates_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint project_updates_description_length check (description is null or char_length(description) <= 1000),
  constraint project_updates_project_owner_fkey
    foreign key (project_id, twin_id) references public.projects (id, twin_id) on delete cascade
);

create index project_updates_twin_id_idx on public.project_updates (twin_id);
create index project_updates_project_id_idx on public.project_updates (project_id);

alter table public.project_updates enable row level security;

create policy "project_updates: owner select" on public.project_updates
  for select to authenticated using ((select auth.uid()) = twin_id);
create policy "project_updates: owner insert" on public.project_updates
  for insert to authenticated with check ((select auth.uid()) = twin_id);
create policy "project_updates: owner update" on public.project_updates
  for update to authenticated using ((select auth.uid()) = twin_id);
create policy "project_updates: owner delete" on public.project_updates
  for delete to authenticated using ((select auth.uid()) = twin_id);

grant select, insert, update, delete on public.project_updates to authenticated;
