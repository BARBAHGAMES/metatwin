-- P1-5 (part B): close the anonymous enumeration hole.
-- Anonymous (logged-out) API callers could list every public student's
-- competencies, projects and evidence (including private notes) through the
-- "public select when twin visible" policies. The only public read path is now
-- get_public_profile(handle). Owners still read their own rows through the
-- "owner select" policies.

drop policy "competencies: public select when twin visible" on public.competencies;
drop policy "projects: public select when twin visible" on public.projects;
drop policy "evidence: public select when twin visible" on public.evidence;

revoke select on public.competencies from anon;
revoke select on public.projects from anon;
revoke select on public.evidence from anon;

drop function public.twin_is_public(uuid);
