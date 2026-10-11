-- MetaTwin security regression suite.
-- Run against the live project (Supabase SQL editor, or the MCP execute_sql tool)
-- after ANY migration that touches tables, policies, grants, triggers or functions.
-- Everything runs inside one transaction that ALWAYS aborts at the end, so it
-- leaves no rows behind. Result:
--   * "ALL PASS (rolled back)"  -> every guarantee holds
--   * "ASSERTION FAILED: <msg>" -> the named guarantee is broken
-- It creates throwaway auth.users (the signup triggers run, so the queued welcome
-- webhook rows roll back with the transaction and no email is sent).

do $$
declare
  a uuid := gen_random_uuid();   -- adult student with data
  b uuid := gen_random_uuid();   -- second adult student (the "other user")
  c uuid := gen_random_uuid();   -- signup with NO age declaration
  s1 uuid; s2 uuid; s3 uuid;
  ca uuid; cb uuid; pb uuid; pa uuid; ev uuid;
  yr int := extract(year from now())::int;
  blocked boolean;
  q0 int; q1 int;
  prof jsonb;
  n int;
begin
  ------------------------------------------------------------------ signups
  -- under-18 declaration is rejected at signup
  blocked := false;
  begin
    insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values (gen_random_uuid(), 'minor@test.invalid', 'authenticated', 'authenticated',
            jsonb_build_object('birth_year', yr - 10, 'is_adult_declared', true));
  exception when others then blocked := true; end;
  assert blocked, 'under-18 signup must be rejected';

  -- welcome email: nothing on bare signup, one on confirmation
  select count(*) into q0 from net.http_request_queue;
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'a@test.invalid', 'authenticated', 'authenticated', jsonb_build_object('birth_year', yr - 22, 'is_adult_declared', true)),
    (b, 'b@test.invalid', 'authenticated', 'authenticated', jsonb_build_object('birth_year', yr - 22, 'is_adult_declared', true)),
    (c, 'c@test.invalid', 'authenticated', 'authenticated', null);
  select count(*) into q1 from net.http_request_queue;
  assert q1 = q0, 'unconfirmed signups must not queue a welcome email';
  update auth.users set email_confirmed_at = now() where id = a;
  select count(*) into q1 from net.http_request_queue;
  assert q1 = q0 + 1, 'confirming an address must queue exactly one welcome email';

  assert (select is_adult from public.twins where id = a), 'adult declaration stored';
  assert not (select is_adult from public.twins where id = c), 'no declaration => is_adult false';

  select id into s1 from public.skills where slug = '3d-modelling';
  select id into s2 from public.skills where slug = 'user-research';
  select id into s3 from public.skills where slug = 'technical-writing';
  insert into public.competencies (twin_id, skill_id, level) values (a, s1, 3) returning id into ca;
  insert into public.competencies (twin_id, skill_id, level) values (b, s1, 3) returning id into cb;
  insert into public.projects (twin_id, title, description, artifact_url) values (a, 'A project', 'd', 'https://example.com/a') returning id into pa;
  insert into public.projects (twin_id, title) values (b, 'B project') returning id into pb;

  ------------------------------------------------------------ as student A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- evidence integrity
  blocked := false; begin insert into public.evidence (twin_id, competency_id, title) values (a, cb, 'forged'); exception when foreign_key_violation then blocked := true; end;
  assert blocked, 'evidence on another student''s competency must be blocked';
  blocked := false; begin insert into public.evidence (twin_id, competency_id, project_id, title) values (a, ca, pb, 'x'); exception when foreign_key_violation then blocked := true; end;
  assert blocked, 'evidence linked to another student''s project must be blocked';
  update public.competencies set evidence_count = 99 where id = ca;
  insert into public.evidence (twin_id, competency_id, project_id, title, link, note) values (a, ca, pa, 'Proof', 'https://example.com/e', 'private note') returning id into ev;
  reset role;
  assert (select evidence_count from public.competencies where id = ca) = 1, 'evidence_count must be server-derived (not self-set)';
  assert (select evidence_count from public.competencies where id = cb) = 0, 'other student''s count must be untouched';

  set local role authenticated;
  -- links: http(s) only
  blocked := false; begin insert into public.evidence (twin_id, competency_id, title, link) values (a, ca, 'x', 'javascript:alert(1)'); exception when check_violation then blocked := true; end;
  assert blocked, 'javascript: links must be blocked';
  blocked := false; begin insert into public.projects (twin_id, title, artifact_url) values (a, 'x', 'data:text/html,<script>1</script>'); exception when check_violation then blocked := true; end;
  assert blocked, 'data: project URLs must be blocked';
  -- length / range limits
  blocked := false; begin update public.twins set headline = repeat('x', 161) where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'headline length limit';
  blocked := false; begin update public.twins set year = -40 where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'study year range';
  blocked := false; begin insert into public.projects (twin_id, title) values (a, '   '); exception when check_violation then blocked := true; end;
  assert blocked, 'blank project title';

  -- protected columns are not client-writable
  update public.twins set is_adult = false, birth_year = 1950, parental_consent_at = now() where id = a;
  reset role;
  assert (select is_adult and birth_year = yr - 22 and parental_consent_at is null from public.twins where id = a),
    'is_adult / birth_year / parental_consent_at must ignore client writes';

  -- handle rules + public gating
  set local role authenticated;
  blocked := false; begin update public.twins set visibility = 'public' where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'cannot go public without a handle';
  blocked := false; begin update public.twins set handle = 'admin' where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'reserved handle';
  blocked := false; begin update public.twins set handle = 'Bad Handle' where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'handle format';
  update public.twins set name = 'Amina', handle = 'amina-reg', visibility = 'public' where id = a;
  reset role;

  ------------------------------------------------------------ as student C (undeclared)
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false; begin insert into public.projects (twin_id, title) values (c, 'sneaky'); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'undeclared account must not be able to add content';
  blocked := false; begin update public.twins set handle = 'c-handle', visibility = 'public' where id = c; exception when check_violation then blocked := true; end;
  assert blocked, 'undeclared account must not be able to go public';
  perform public.declare_adult(yr - 25);
  insert into public.projects (twin_id, title) values (c, 'now allowed');
  blocked := false; begin perform public.declare_adult(yr - 10); exception when others then blocked := true; end;
  assert blocked, 'declare_adult must reject an under-18 year';
  reset role;

  ------------------------------------------------------------ student B / anon isolation
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.projects where twin_id = a;       assert n = 0, 'B must not read A''s projects';
  select count(*) into n from public.evidence where twin_id = a;       assert n = 0, 'B must not read A''s evidence';
  select count(*) into n from public.competencies where twin_id = a;   assert n = 0, 'B must not read A''s competencies';
  select count(*) into n from public.twins where id = a;               assert n = 0, 'B must not read A''s twin row';
  reset role;

  set local role anon;
  blocked := false; begin perform 1 from public.projects limit 1; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not read projects';
  blocked := false; begin perform 1 from public.evidence limit 1; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not read evidence';
  blocked := false; begin perform 1 from public.competencies limit 1; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not read competencies';
  prof := public.get_public_profile('amina-reg');
  assert prof ->> 'name' = 'Amina', 'public profile is readable via the function';
  assert not (prof::text ~* 'private note|a@test|birth_year|is_adult|parental'), 'public profile must not leak notes, email or age fields';
  assert not (prof -> 'capabilities' -> 0 -> 'evidence' -> 0 ? 'link'), 'evidence links hidden unless the student opts in';
  assert public.get_public_profile('nobody-here') is null, 'unknown handle => null';
  reset role;
  update public.twins set visibility = 'private' where id = a;
  set local role anon;
  assert public.get_public_profile('amina-reg') is null, 'private profile => null (same as unknown)';
  reset role;

  ------------------------------------------------------------ matching + matches
  insert into public.opportunities (title, org_name, required_skill_ids) values
    ('Both', 'O1', array[s1, s2]), ('Missing', 'O2', array[s1, s3]), ('None', 'O3', '{}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.get_my_opportunity_matches() where title = 'Missing' and score = 50 and 'Technical Writing' = any (missing_skills);
  assert n = 1, 'matching: one evidence-backed skill of two => 50, missing skill listed';
  select count(*) into n from public.get_my_opportunity_matches() where title = 'None' and score is null;
  assert n = 1, 'matching: no required skills => null score';
  blocked := false; begin insert into public.matches (twin_id, opportunity_id, score) select a, id, 100 from public.opportunities limit 1; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'students must not be able to write match scores';
  reset role;
  set local role anon;
  blocked := false; begin perform * from public.get_my_opportunity_matches(); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not call get_my_opportunity_matches';
  reset role;

  ------------------------------------------------------------ least-privilege grants (P2-9)
  assert has_table_privilege('anon', 'public.skills', 'select'), 'anon must be able to read skills (SSR /capability loader)';
  assert not exists (
    select 1 from unnest(array['twins','competencies','projects','evidence','courses','assessments','matches','opportunities']) t(tbl),
         unnest(array['select','insert','update','delete','truncate']) p(priv)
    where has_table_privilege('anon', 'public.' || t.tbl, p.priv)
  ), 'anon must hold NO privileges on student tables or opportunities';
  assert not has_table_privilege('anon', 'public.skills', 'insert') and not has_table_privilege('anon', 'public.skills', 'update'), 'anon cannot write skills';
  assert not exists (
    select 1 from unnest(array['twins','competencies','projects','evidence','courses','assessments','matches','opportunities','skills']) t(tbl)
    where has_table_privilege('authenticated', 'public.' || t.tbl, 'truncate')
       or has_table_privilege('authenticated', 'public.' || t.tbl, 'references')
       or has_table_privilege('authenticated', 'public.' || t.tbl, 'trigger')
  ), 'authenticated must not hold TRUNCATE/REFERENCES/TRIGGER';
  assert not has_table_privilege('authenticated', 'public.skills', 'insert') and not has_table_privilege('authenticated', 'public.opportunities', 'insert'),
    'students cannot write skills or opportunities';
  assert not has_table_privilege('authenticated', 'public.matches', 'insert'), 'students cannot write matches';
  assert not has_function_privilege('authenticated', 'public.twin_is_adult(uuid)', 'execute'), 'twin_is_adult must not be callable';
  assert has_function_privilege('anon', 'public.get_public_profile(text)', 'execute'), 'public profile function stays callable by anon';
  assert not has_function_privilege('anon', 'public.declare_adult(integer)', 'execute'), 'declare_adult is signed-in only';
  assert not exists (
    select 1 from pg_policies where schemaname = 'public'
      and (coalesce(qual,'') ~* 'auth\.uid\(\)' and coalesce(qual,'') !~* 'select\s+auth\.uid\(\)')
  ), 'RLS policies must use (select auth.uid())';

  raise exception 'ALL PASS (rolled back)';
exception
  when assert_failure then
    raise exception 'ASSERTION FAILED: %', sqlerrm;
end $$;
