create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  competency_id uuid not null references public.competencies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  evidence_type text,
  link text,
  note text,
  created_at timestamptz not null default now()
);

create index evidence_twin_id_idx on public.evidence (twin_id);
create index evidence_competency_id_idx on public.evidence (competency_id);

alter table public.evidence enable row level security;

create policy "evidence: owner select" on public.evidence for select using (auth.uid() = twin_id);
create policy "evidence: public select when twin visible" on public.evidence for select
  using (exists (select 1 from public.twins t where t.id = evidence.twin_id and t.visibility = 'public'));
create policy "evidence: owner insert" on public.evidence for insert with check (auth.uid() = twin_id);
create policy "evidence: owner update" on public.evidence for update using (auth.uid() = twin_id);
create policy "evidence: owner delete" on public.evidence for delete using (auth.uid() = twin_id);

grant select on public.evidence to anon;
grant select, insert, update, delete on public.evidence to authenticated;

-- Keep competencies.evidence_count in sync so existing status-derivation
-- code (dashboard.tsx, profile.tsx: `evidence_count > 0`) needs no changes.
create or replace function public.sync_competency_evidence_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.competencies
  set evidence_count = (select count(*) from public.evidence where competency_id = coalesce(new.competency_id, old.competency_id)),
      updated_at = now()
  where id = coalesce(new.competency_id, old.competency_id);
  return null;
end;
$$;

create trigger evidence_sync_count
  after insert or delete on public.evidence
  for each row execute function public.sync_competency_evidence_count();
