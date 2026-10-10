-- MetaTwin v1 schema: 8 core tables for the student-only twin.
-- Every student-owned row is keyed to auth.uid(); employer visibility is
-- opt-in per twin via twins.visibility (no employer consumer in v1, but the
-- "shared if visible" policies on competencies/projects are in place now so
-- that feature doesn't require a schema change later).

create table public.twins (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  institution text,
  programme text,
  year int,
  headline text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  -- Students are often minors; null until a parent/guardian consents.
  parental_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete restrict,
  level int not null check (level between 1 and 5),
  evidence_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (twin_id, skill_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  name text not null,
  grade text,
  term text,
  linked_skill_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  title text not null,
  description text,
  artifact_url text,
  skill_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  trait_type text not null,
  trait_value text not null,
  source text not null default 'self_reported' check (source in ('self_reported', 'verified')),
  created_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  org_name text,
  required_skill_ids uuid[] not null default '{}',
  url text,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  score numeric,
  reasons jsonb,
  created_at timestamptz not null default now(),
  unique (twin_id, opportunity_id)
);

create index competencies_twin_id_idx on public.competencies (twin_id);
create index courses_twin_id_idx on public.courses (twin_id);
create index projects_twin_id_idx on public.projects (twin_id);
create index assessments_twin_id_idx on public.assessments (twin_id);
create index matches_twin_id_idx on public.matches (twin_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.twins enable row level security;
alter table public.skills enable row level security;
alter table public.competencies enable row level security;
alter table public.courses enable row level security;
alter table public.projects enable row level security;
alter table public.assessments enable row level security;
alter table public.opportunities enable row level security;
alter table public.matches enable row level security;

-- twins: owner read/write only (no public policy — the twin's own
-- visibility flag governs OTHER tables, not this one).
create policy "twins: owner select" on public.twins for select using (auth.uid() = id);
create policy "twins: owner insert" on public.twins for insert with check (auth.uid() = id);
create policy "twins: owner update" on public.twins for update using (auth.uid() = id);
create policy "twins: owner delete" on public.twins for delete using (auth.uid() = id);

-- skills: public read, no client writes (seeded by us via service_role).
create policy "skills: public select" on public.skills for select using (true);

-- competencies: owner full access; anyone can read when the twin opted in.
create policy "competencies: owner select" on public.competencies for select using (auth.uid() = twin_id);
create policy "competencies: public select when twin visible" on public.competencies for select
  using (exists (select 1 from public.twins t where t.id = competencies.twin_id and t.visibility = 'public'));
create policy "competencies: owner insert" on public.competencies for insert with check (auth.uid() = twin_id);
create policy "competencies: owner update" on public.competencies for update using (auth.uid() = twin_id);
create policy "competencies: owner delete" on public.competencies for delete using (auth.uid() = twin_id);

-- courses: owner only.
create policy "courses: owner select" on public.courses for select using (auth.uid() = twin_id);
create policy "courses: owner insert" on public.courses for insert with check (auth.uid() = twin_id);
create policy "courses: owner update" on public.courses for update using (auth.uid() = twin_id);
create policy "courses: owner delete" on public.courses for delete using (auth.uid() = twin_id);

-- projects: owner full access; anyone can read when the twin opted in.
create policy "projects: owner select" on public.projects for select using (auth.uid() = twin_id);
create policy "projects: public select when twin visible" on public.projects for select
  using (exists (select 1 from public.twins t where t.id = projects.twin_id and t.visibility = 'public'));
create policy "projects: owner insert" on public.projects for insert with check (auth.uid() = twin_id);
create policy "projects: owner update" on public.projects for update using (auth.uid() = twin_id);
create policy "projects: owner delete" on public.projects for delete using (auth.uid() = twin_id);

-- assessments: owner only (MBTI etc. — self-reported, not for public view).
create policy "assessments: owner select" on public.assessments for select using (auth.uid() = twin_id);
create policy "assessments: owner insert" on public.assessments for insert with check (auth.uid() = twin_id);
create policy "assessments: owner update" on public.assessments for update using (auth.uid() = twin_id);
create policy "assessments: owner delete" on public.assessments for delete using (auth.uid() = twin_id);

-- opportunities: public read, no client writes (seeded by us).
create policy "opportunities: public select" on public.opportunities for select using (true);

-- matches: owner only.
create policy "matches: owner select" on public.matches for select using (auth.uid() = twin_id);
create policy "matches: owner insert" on public.matches for insert with check (auth.uid() = twin_id);
create policy "matches: owner update" on public.matches for update using (auth.uid() = twin_id);
create policy "matches: owner delete" on public.matches for delete using (auth.uid() = twin_id);

-- ── Grants ───────────────────────────────────────────────────────────────
-- Table-wide GRANT SELECT (not per-column) is the convention carried over
-- from barbah-games-platform: Postgres denies an ENTIRE row if even one
-- selected column lacks a grant, so a column added later with no grant
-- update would silently 403 every read of that table. RLS still gates which
-- ROWS are visible; these grants only gate which columns can be selected at all.
grant select, insert, update, delete on public.twins to authenticated;
grant select on public.skills to anon, authenticated;
-- anon only gets SELECT (for a twin that opted into public visibility) —
-- write grants stay authenticated-only even though RLS would already block
-- an anon write via auth.uid() = twin_id.
grant select on public.competencies to anon;
grant select, insert, update, delete on public.competencies to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.assessments to authenticated;
grant select on public.opportunities to anon, authenticated;
grant select, insert, update, delete on public.matches to authenticated;
