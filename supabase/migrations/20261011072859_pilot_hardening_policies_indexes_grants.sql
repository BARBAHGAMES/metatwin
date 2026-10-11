-- P2-9: pilot hardening, driven by Supabase's own advisors.
-- 1. RLS performance: policies called auth.uid() per row; (select auth.uid()) is
--    evaluated once per statement. The adult check is inlined as a subquery on
--    twins (visible to the owner under twins' own owner-select policy), so the
--    twin_is_adult() oracle can be locked away from signed-in callers.
-- 2. Indexes for foreign keys the advisor flagged.
-- 3. Grants: Supabase's default privileges gave anon and authenticated every
--    privilege (including TRUNCATE, which bypasses RLS) on every table. Reduce
--    to least privilege and stop new tables from inheriting those defaults, so
--    each new table must GRANT explicitly (the repo convention that
--    check-grants.mjs enforces for reads).

-- 1. policies
alter policy "assessments: owner delete" on public.assessments using (((select auth.uid()) = twin_id));
alter policy "assessments: owner insert" on public.assessments with check ((((select auth.uid()) = twin_id) AND (exists (select 1 from public.twins t where t.id = twin_id and t.is_adult))));
alter policy "assessments: owner select" on public.assessments using (((select auth.uid()) = twin_id));
alter policy "assessments: owner update" on public.assessments using (((select auth.uid()) = twin_id));
alter policy "competencies: owner delete" on public.competencies using (((select auth.uid()) = twin_id));
alter policy "competencies: owner insert" on public.competencies with check ((((select auth.uid()) = twin_id) AND (exists (select 1 from public.twins t where t.id = twin_id and t.is_adult))));
alter policy "competencies: owner select" on public.competencies using (((select auth.uid()) = twin_id));
alter policy "competencies: owner update" on public.competencies using (((select auth.uid()) = twin_id));
alter policy "courses: owner delete" on public.courses using (((select auth.uid()) = twin_id));
alter policy "courses: owner insert" on public.courses with check ((((select auth.uid()) = twin_id) AND (exists (select 1 from public.twins t where t.id = twin_id and t.is_adult))));
alter policy "courses: owner select" on public.courses using (((select auth.uid()) = twin_id));
alter policy "courses: owner update" on public.courses using (((select auth.uid()) = twin_id));
alter policy "evidence: owner delete" on public.evidence using (((select auth.uid()) = twin_id));
alter policy "evidence: owner insert" on public.evidence with check ((((select auth.uid()) = twin_id) AND (exists (select 1 from public.twins t where t.id = twin_id and t.is_adult))));
alter policy "evidence: owner select" on public.evidence using (((select auth.uid()) = twin_id));
alter policy "evidence: owner update" on public.evidence using (((select auth.uid()) = twin_id));
alter policy "matches: owner delete" on public.matches using (((select auth.uid()) = twin_id));
alter policy "matches: owner insert" on public.matches with check ((((select auth.uid()) = twin_id) AND (exists (select 1 from public.twins t where t.id = twin_id and t.is_adult))));
alter policy "matches: owner select" on public.matches using (((select auth.uid()) = twin_id));
alter policy "matches: owner update" on public.matches using (((select auth.uid()) = twin_id));
alter policy "projects: owner delete" on public.projects using (((select auth.uid()) = twin_id));
alter policy "projects: owner insert" on public.projects with check ((((select auth.uid()) = twin_id) AND (exists (select 1 from public.twins t where t.id = twin_id and t.is_adult))));
alter policy "projects: owner select" on public.projects using (((select auth.uid()) = twin_id));
alter policy "projects: owner update" on public.projects using (((select auth.uid()) = twin_id));
alter policy "twins: owner delete" on public.twins using (((select auth.uid()) = id));
alter policy "twins: owner insert" on public.twins with check (((select auth.uid()) = id));
alter policy "twins: owner select" on public.twins using (((select auth.uid()) = id));
alter policy "twins: owner update" on public.twins using (((select auth.uid()) = id));

-- no policy references twin_is_adult() any more
revoke all on function public.twin_is_adult(uuid) from public, anon, authenticated;

-- 2. indexes for flagged foreign keys
create index if not exists competencies_skill_id_idx on public.competencies (skill_id);
create index if not exists evidence_competency_twin_idx on public.evidence (competency_id, twin_id);
create index if not exists evidence_project_twin_idx on public.evidence (project_id, twin_id);
create index if not exists matches_opportunity_id_idx on public.matches (opportunity_id);

-- 3. least-privilege grants
revoke all on all tables in schema public from anon;
grant select on public.skills to anon;                       -- read by the SSR /capability loader
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on public.skills, public.opportunities from authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
