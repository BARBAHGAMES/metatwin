-- P2-8 (part 1): opportunity matching + stop students forging match scores.
-- get_my_opportunity_matches(): server-side skill-overlap scoring for the
-- signed-in student. SECURITY INVOKER, so RLS still applies (a student only
-- ever sees their own competencies). Evidence-backed skills count 1.0,
-- self-reported 0.5; score = 100 * weight / required skills.
-- matches was client-writable (owner insert/update policies), so a student
-- could forge their own match scores. Matching is computed on demand and
-- nothing needs client writes, so revoke them.

alter table public.skills add column slug text;

create or replace function public.get_my_opportunity_matches()
returns table (
  id uuid,
  title text,
  org_name text,
  description text,
  url text,
  score int,
  matched_skills text[],
  missing_skills text[],
  required_count int,
  evidence_backed_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    o.id, o.title, o.org_name, o.description, o.url,
    case when cardinality(o.required_skill_ids) = 0 then null
         else round(100.0 * m.weight / cardinality(o.required_skill_ids))::int end,
    m.matched, m.missing,
    cardinality(o.required_skill_ids),
    m.backed::int
  from public.opportunities o
  cross join lateral (
    select
      coalesce(sum(case when c.evidence_count > 0 then 1.0 when c.id is not null then 0.5 else 0 end), 0) as weight,
      coalesce(array_agg(s.name order by s.name) filter (where c.id is not null), '{}') as matched,
      coalesce(array_agg(s.name order by s.name) filter (where c.id is null), '{}') as missing,
      count(*) filter (where c.evidence_count > 0) as backed
    from unnest(o.required_skill_ids) as r(skill_id)
    join public.skills s on s.id = r.skill_id
    left join public.competencies c on c.skill_id = r.skill_id and c.twin_id = auth.uid()
  ) m
  order by 6 desc nulls last, o.created_at desc;
$$;

revoke all on function public.get_my_opportunity_matches() from public, anon;
grant execute on function public.get_my_opportunity_matches() to authenticated;

revoke insert, update, delete on public.matches from authenticated;
revoke all on public.matches from anon;
