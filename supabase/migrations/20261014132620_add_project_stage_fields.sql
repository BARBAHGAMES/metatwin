alter table public.projects
  add column stage text not null default 'idea' check (stage in ('idea','in_progress','prototype','completed')),
  add column interviews_csv_url text,
  add column interviews_count int not null default 0,
  add column interviews_synced_at timestamptz,
  add column open_to_collaborators boolean not null default false,
  add column completion_reason text check (completion_reason is null or completion_reason in ('abandoned','graduated','business_adopted')),
  add column completed_at timestamptz;

create index projects_stage_idx on public.projects (stage);

-- stage is system-maintained, not client-writable (mirrors
-- guard_competency_evidence_count in evidence_integrity_composite_fks_and_count_guard):
-- only recompute_project_stage/mark_project_complete (trigger depth >= 2) may change it.
create or replace function public.guard_project_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.stage := 'idea';
  elsif pg_trigger_depth() < 2 then
    new.stage := old.stage;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_project_stage() from public, anon, authenticated;

create trigger projects_guard_stage
  before insert or update on public.projects
  for each row execute function public.guard_project_stage();
