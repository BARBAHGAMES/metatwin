create table public.github_repos (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  project_id uuid not null,
  full_name text not null,
  url text,
  description text,
  stars int not null default 0,
  forks int not null default 0,
  open_issues int not null default 0,
  language text,
  last_commit_at timestamptz,
  weekly_commits jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz not null default now(),
  constraint github_repos_full_name_format check (full_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  constraint github_repos_project_owner_fkey
    foreign key (project_id, twin_id) references public.projects (id, twin_id) on delete cascade,
  unique (project_id)
);

create index github_repos_twin_id_idx on public.github_repos (twin_id);

alter table public.github_repos enable row level security;

create policy "github_repos: owner select" on public.github_repos
  for select to authenticated using ((select auth.uid()) = twin_id);
create policy "github_repos: owner insert" on public.github_repos
  for insert to authenticated with check ((select auth.uid()) = twin_id);
create policy "github_repos: owner update" on public.github_repos
  for update to authenticated using ((select auth.uid()) = twin_id);
create policy "github_repos: owner delete" on public.github_repos
  for delete to authenticated using ((select auth.uid()) = twin_id);

grant select, insert, update, delete on public.github_repos to authenticated;
