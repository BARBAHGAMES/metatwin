-- P0-1: evidence integrity.
-- Bug 1: evidence.competency_id / project_id only had single-column FKs, so a
-- user could attach evidence (twin_id = self) to ANOTHER user's competency or
-- project; the SECURITY DEFINER count trigger then inflated the victim's
-- evidence_count. Fix: composite FKs that force the referenced row to belong
-- to the same twin as the evidence row.
-- Bug 2: competencies.evidence_count was client-writable (insert and update),
-- so "evidence-backed" status could be self-asserted. Fix: a BEFORE trigger
-- that only lets the evidence sync trigger (trigger depth >= 2) change it.

alter table public.competencies
  add constraint competencies_id_twin_id_key unique (id, twin_id);
alter table public.projects
  add constraint projects_id_twin_id_key unique (id, twin_id);

alter table public.evidence drop constraint evidence_competency_id_fkey;
alter table public.evidence drop constraint evidence_project_id_fkey;

alter table public.evidence
  add constraint evidence_competency_owner_fkey
  foreign key (competency_id, twin_id)
  references public.competencies (id, twin_id) on delete cascade;

-- MATCH SIMPLE: a null project_id skips the check. SET NULL only the project
-- column (twin_id is NOT NULL and must survive).
alter table public.evidence
  add constraint evidence_project_owner_fkey
  foreign key (project_id, twin_id)
  references public.projects (id, twin_id) on delete set null (project_id);

-- Sync trigger now also covers UPDATE OF competency_id (moving evidence
-- between competencies) and recomputes both the old and new competency.
create or replace function public.sync_competency_evidence_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid[];
begin
  if tg_op = 'INSERT' then
    affected := array[new.competency_id];
  elsif tg_op = 'DELETE' then
    affected := array[old.competency_id];
  else
    affected := array[old.competency_id, new.competency_id];
  end if;

  update public.competencies c
  set evidence_count = (select count(*) from public.evidence e where e.competency_id = c.id),
      updated_at = now()
  where c.id = any (affected);
  return null;
end;
$$;

drop trigger evidence_sync_count on public.evidence;
create trigger evidence_sync_count
  after insert or delete or update of competency_id on public.evidence
  for each row execute function public.sync_competency_evidence_count();

-- Repair any drift before the guard goes live (a no-op on a clean table).
update public.competencies c
set evidence_count = (select count(*) from public.evidence e where e.competency_id = c.id);

create or replace function public.guard_competency_evidence_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.evidence_count := 0;
  elsif pg_trigger_depth() < 2 then
    -- A direct write (client or service role), not the evidence sync trigger.
    new.evidence_count := old.evidence_count;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_competency_evidence_count() from public, anon, authenticated;

create trigger competencies_guard_evidence_count
  before insert or update on public.competencies
  for each row execute function public.guard_competency_evidence_count();
