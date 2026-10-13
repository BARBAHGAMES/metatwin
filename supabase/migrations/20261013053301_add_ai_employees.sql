-- "AI employees": the agents/tools a student uses as part of their own
-- workflow — a real feature now (previously just fictional display copy on
-- the dashboard, see PROJECT_STATE). Owner-managed like projects/competencies
-- (plain RLS, no RPC needed); public exposure goes through
-- get_public_profile() only, never a direct anon grant on this table.
create table public.ai_employees (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins(id) on delete cascade,
  name text not null,
  role text,
  platform text,
  description text,
  link_url text,
  created_at timestamptz not null default now(),
  constraint ai_employees_name_length check (char_length(name) between 1 and 80),
  constraint ai_employees_role_length check (role is null or char_length(role) <= 80),
  constraint ai_employees_platform_length check (platform is null or char_length(platform) <= 60),
  constraint ai_employees_description_length check (description is null or char_length(description) <= 500),
  constraint ai_employees_link_url_format check (link_url is null or (link_url ~ '^https?://[^[:space:]]+$' and char_length(link_url) <= 2048))
);

create index ai_employees_twin_id_idx on public.ai_employees(twin_id);

alter table public.ai_employees enable row level security;
create policy "own read" on public.ai_employees for select to authenticated using (twin_id = (select auth.uid()));
create policy "own insert" on public.ai_employees for insert to authenticated with check (twin_id = (select auth.uid()));
create policy "own update" on public.ai_employees for update to authenticated using (twin_id = (select auth.uid()));
create policy "own delete" on public.ai_employees for delete to authenticated using (twin_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_employees to authenticated;
