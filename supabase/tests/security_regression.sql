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
  d uuid := gen_random_uuid();   -- new (unpaid) student for the plan/activation section
  e uuid := gen_random_uuid();   -- account whose twin row is removed (client-insert check)
  s1 uuid; s2 uuid; s3 uuid;
  ca uuid; cb uuid; pb uuid; pa uuid; ev uuid;
  yr int := extract(year from now())::int;
  blocked boolean;
  q0 int; q1 int;
  prof jsonb;
  n int;
  city uuid; uni uuid;
  rv_id uuid; rv_token uuid; rv_result boolean; rv_row jsonb;
  gh_id uuid; pitch_id uuid; ai_emp_id uuid;
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

  -- New signups default to plan_status 'unpaid' (20261014072301) and need an MBTI
  -- type to newly go public (20261014132806). Set both here, as the table owner
  -- (the way the M-Pesa callback / assessments trigger would), so the visibility
  -- checks below exercise the handle/adult rules they were written for. The MBTI
  -- and plan rules have their own section at the end.
  update public.twins set mbti_type = 'INTJ', plan_status = 'grandfathered' where id in (a, b, c);

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

  ------------------------------------------------------------ onboarding fields + reference tables
  select id into city from public.kenya_cities order by name limit 1;
  select id into uni from public.universities order by name limit 1;
  assert city is not null and uni is not null, 'reference tables must be seeded';

  -- anyone can read the reference lists; nobody on the client can write them
  set local role anon;
  select count(*) into n from public.kenya_cities;   assert n > 0, 'anon can read cities';
  select count(*) into n from public.universities;   assert n > 0, 'anon can read universities';
  blocked := false; begin insert into public.kenya_cities (name) values ('Atlantis'); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not write cities';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false; begin insert into public.universities (name) values ('Fake University'); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'students must not add universities';
  blocked := false; begin update public.kenya_cities set name = 'Hacked' where id = city; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'students must not edit cities';

  -- the owner can save valid onboarding values (max-length boundary values included)
  update public.twins set city_id = city, university_id = uni, education_status = 'in_university',
    first_name = repeat('f', 60), last_name = 'Otieno', bio = repeat('b', 500) where id = a;
  reset role;
  assert (select city_id = city and university_id = uni and education_status = 'in_university' and char_length(bio) = 500
          from public.twins where id = a), 'onboarding fields must save for the owner';

  -- invalid references and values are rejected
  set local role authenticated;
  blocked := false; begin update public.twins set city_id = gen_random_uuid() where id = a; exception when foreign_key_violation then blocked := true; end;
  assert blocked, 'unknown city id must be rejected (FK)';
  blocked := false; begin update public.twins set university_id = gen_random_uuid() where id = a; exception when foreign_key_violation then blocked := true; end;
  assert blocked, 'unknown university id must be rejected (FK)';
  blocked := false; begin update public.twins set education_status = 'astronaut' where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'education_status must be one of the allowed values';
  blocked := false; begin update public.twins set first_name = repeat('f', 61) where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'first_name length limit (60)';
  blocked := false; begin update public.twins set bio = repeat('b', 501) where id = a; exception when check_violation then blocked := true; end;
  assert blocked, 'bio length limit (500)';
  reset role;

  -- another student cannot write A's onboarding fields (RLS hides the row from the update)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.twins set city_id = city, bio = 'defaced' where id = a;
  get diagnostics n = row_count;
  assert n = 0, 'student B must not be able to update student A''s twin';
  reset role;
  assert (select bio is distinct from 'defaced' from public.twins where id = a), 'A''s bio must be untouched by B';

  -- reference tables are read-only for every client role; FK indexes exist
  assert not exists (
    select 1 from unnest(array['kenya_cities','universities']) t(tbl),
         unnest(array['insert','update','delete','truncate']) p(priv)
    where has_table_privilege('anon', 'public.' || t.tbl, p.priv) or has_table_privilege('authenticated', 'public.' || t.tbl, p.priv)
  ), 'reference tables must be read-only for all client roles';
  assert exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'twins_city_id_idx'), 'twins.city_id FK index';
  assert exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'twins_university_id_idx'), 'twins.university_id FK index';

  ------------------------------------------------------------ evidence_reviews: native reviewer workflow
  -- owner can invite a reviewer on their own evidence. Token is generated client-side
  -- (mirroring dashboard.tsx's inviteReviewer()) rather than read back via RETURNING --
  -- RETURNING on an INSERT must also satisfy the SELECT policy, and a fresh/unsubmitted
  -- invite never does (see the "fabrication guard" + "nobody can read a pending invite" tests below).
  rv_token := gen_random_uuid();
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.evidence_reviews (evidence_id, twin_id, reviewer_name, reviewer_role, token)
    values (ev, a, 'Dr. Imani Wekesa', 'Mentor', rv_token);
  reset role;
  select id into rv_id from public.evidence_reviews where token = rv_token;

  -- another student cannot insert a review row claiming A's twin_id
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false;
  begin insert into public.evidence_reviews (evidence_id, twin_id, reviewer_name) values (ev, a, 'Faker'); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'only the owner can insert a review invite for their own twin_id';
  reset role;

  -- fabrication guard: the owner cannot self-insert an already-"submitted" review
  -- (state transitions must only happen through submit_evidence_review)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false;
  begin
    insert into public.evidence_reviews (evidence_id, twin_id, reviewer_name, comment, submitted_at)
      values (ev, a, 'Fabricated Reviewer', 'Amazing!', now());
  exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'owner must not be able to insert a pre-submitted (fabricated) review';
  reset role;

  -- nobody can read a pending (unsubmitted) invite directly, not even the owner
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.evidence_reviews where id = rv_id;
  assert n = 0, 'owner cannot select their own pending review row directly (only via the RPC flow)';
  reset role;

  set local role anon;
  blocked := false;
  begin perform 1 from public.evidence_reviews where id = rv_id; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon cannot read evidence_reviews directly at all';
  blocked := false;
  begin update public.evidence_reviews set submitted_at = now() where id = rv_id; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not be able to update evidence_reviews directly';
  reset role;

  assert not has_table_privilege('authenticated', 'public.evidence_reviews', 'update'), 'authenticated must not hold UPDATE on evidence_reviews';
  assert not has_table_privilege('authenticated', 'public.evidence_reviews', 'delete'), 'authenticated must not hold DELETE on evidence_reviews';
  assert not has_table_privilege('anon', 'public.evidence_reviews', 'select') and not has_table_privilege('anon', 'public.evidence_reviews', 'insert'),
    'anon must hold no direct table privileges on evidence_reviews';

  -- the public review-lookup RPC works for anon, scoped to this one token
  assert has_function_privilege('anon', 'public.get_review_invite(uuid)', 'execute'), 'get_review_invite must be callable by anon';
  assert has_function_privilege('anon', 'public.submit_evidence_review(uuid, text)', 'execute'), 'submit_evidence_review must be callable by anon';
  select to_jsonb(r) into rv_row from public.get_review_invite(rv_token) r;
  assert rv_row ->> 'evidence_title' = 'Proof', 'get_review_invite must return the evidence title';
  assert (rv_row ->> 'already_submitted')::boolean = false, 'fresh invite must not show already_submitted';
  assert (rv_row ->> 'expired')::boolean = false, 'fresh invite must not show expired';
  select count(*) into n from public.get_review_invite(gen_random_uuid());
  assert n = 0, 'an unknown token must return no rows';

  -- an anonymous reviewer can submit using the token, but cannot reuse it
  set local role anon;
  select public.submit_evidence_review(rv_token, 'Great work!') into rv_result;
  reset role;
  assert rv_result, 'a valid, unexpired, unused token must be accepted';

  set local role anon;
  select public.submit_evidence_review(rv_token, 'again') into rv_result;
  reset role;
  assert not rv_result, 'a token must not be reusable once submitted';

  -- the token cannot be enumerated / read back via the table directly
  set local role anon;
  blocked := false; begin perform 1 from public.evidence_reviews where token = rv_token; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not be able to query evidence_reviews by token directly';
  reset role;

  -- once submitted, the owner can read it; other students still cannot
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.evidence_reviews where id = rv_id and comment = 'Great work!';
  assert n = 1, 'owner can read the submitted review, comment included';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.evidence_reviews where id = rv_id;
  assert n = 0, 'another student must not be able to read A''s submitted review';
  reset role;

  -- an expired token must be rejected even though it was never submitted
  rv_token := gen_random_uuid();
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.evidence_reviews (evidence_id, twin_id, reviewer_name, token, token_expires_at)
    values (ev, a, 'Late reviewer', rv_token, now() - interval '1 day');
  reset role;
  set local role anon;
  select public.submit_evidence_review(rv_token, 'too late') into rv_result;
  reset role;
  assert not rv_result, 'an expired token must be rejected';

  -- an over-length comment is rejected inside the function too, not just the table check
  rv_token := gen_random_uuid();
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.evidence_reviews (evidence_id, twin_id, reviewer_name, token) values (ev, a, 'Yet another reviewer', rv_token);
  reset role;
  blocked := false;
  set local role anon;
  begin perform public.submit_evidence_review(rv_token, repeat('x', 1001)); exception when others then blocked := true; end;
  reset role;
  assert blocked, 'an over-length comment must be rejected by submit_evidence_review';

  ------------------------------------------------------------ github_repos / pitches (Lovable-sync round)
  -- github_repos is now written only by the server (Build Plan 0.5 — the
  -- sync route runs as service_role, via supabaseAdmin), not the client.
  set local role service_role;
  insert into public.github_repos (twin_id, project_id, full_name, url, stars, forks, language)
    values (a, pa, 'octocat/hello-world', 'https://github.com/octocat/hello-world', 5, 1, 'TypeScript')
    returning id into gh_id;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.pitches (twin_id, project_id, business_name, outcome)
    values (a, pa, 'Acme Duka', 'customer') returning id into pitch_id;
  reset role;

  -- another student cannot write or read A's github_repos / pitches rows
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.github_repos where id = gh_id; assert n = 0, 'B must not read A''s github_repos row';
  select count(*) into n from public.pitches where id = pitch_id; assert n = 0, 'B must not read A''s pitches row';
  blocked := false; begin insert into public.github_repos (twin_id, project_id, full_name) values (a, pa, 'evil/repo'); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'B must not insert a github_repos row claiming A''s twin_id';
  blocked := false; begin insert into public.pitches (twin_id, project_id, business_name) values (a, pa, 'Fake Co'); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'B must not insert a pitches row claiming A''s twin_id';
  reset role;

  -- not even the owner can write github_repos directly any more (Build Plan 0.5)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false; begin insert into public.github_repos (twin_id, project_id, full_name) values (a, pa, 'owner/attempt'); exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'owner must not be able to insert a github_repos row directly any more';
  blocked := false; begin update public.github_repos set stars = 9999 where id = gh_id; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'owner must not be able to forge github_repos stats directly any more';
  reset role;

  -- anon has no direct table access to either (public exposure is only via get_public_profile)
  set local role anon;
  blocked := false; begin perform 1 from public.github_repos limit 1; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not read github_repos directly';
  blocked := false; begin perform 1 from public.pitches limit 1; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not read pitches directly';
  blocked := false; begin perform 1 from public.pitch_stats limit 1; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'anon must not read pitch_stats directly';
  reset role;

  -- owner can still read, and separately delete, their own rows; the computed stats view still works
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.github_repos where id = gh_id; assert n = 1, 'owner can read their own github_repos row';
  select total_pitches into n from public.pitch_stats where project_id = pa; assert n = 1, 'pitch_stats must compute from real pitches, not be hand-set';
  reset role;

  -- cannot attach a second project's github_repos/pitches row to a different owner's project
  -- (FK integrity still holds for the server's own writes, not just RLS)
  blocked := false;
  set local role service_role;
  begin insert into public.github_repos (twin_id, project_id, full_name) values (a, pb, 'x/y'); exception when foreign_key_violation then blocked := true; end;
  reset role;
  assert blocked, 'github_repos must reject a project_id that does not belong to the same twin_id';

  ------------------------------------------------------------ list_public_twins() + extended get_public_profile()
  set local role anon;
  select count(*) into n from public.list_public_twins() where handle = 'amina-reg';
  assert n = 0, 'A is still private at this point, so list_public_twins must not include her';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.twins set visibility = 'public', photo_url = 'https://example.com/me.jpg' where id = a;
  reset role;

  set local role anon;
  select count(*) into n from public.list_public_twins() where handle = 'amina-reg';
  assert n = 1, 'a public, handled, adult twin must appear in list_public_twins';
  reset role;
  assert not exists (
    select 1 from public.list_public_twins() t
    join public.twins tw on tw.handle = t.handle
    where tw.visibility <> 'public' or not tw.is_adult or tw.handle is null
  ), 'list_public_twins must never include a private, non-adult, or handleless twin';

  set local role anon;
  prof := public.get_public_profile('amina-reg');
  assert prof ->> 'photo_url' = 'https://example.com/me.jpg', 'get_public_profile must surface photo_url';
  assert (prof -> 'projects' -> 0 -> 'github' ->> 'full_name') = 'octocat/hello-world', 'get_public_profile must surface github stats for a project';
  assert (prof -> 'projects' -> 0 -> 'pitch_stats' ->> 'total_pitches') = '1', 'get_public_profile must surface pitch_stats for a project';
  reset role;

  -- the earlier evidence_reviews section submitted a real review for this evidence item
  -- (token rv_token, comment "Great work!") -- the public page must reflect that as reviewed=true
  assert (prof -> 'capabilities' -> 0 -> 'evidence' -> 0 ->> 'reviewed')::boolean = true,
    'evidence with a submitted review must show reviewed=true on the public page';

  ------------------------------------------------- plan, activation and MBTI gating
  -- A brand-new (unpaid) student must not be able to grant themselves a plan, undo a
  -- platform-admin deactivation, or recreate their twin row to reset either.
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (d, 'd@test.invalid', 'authenticated', 'authenticated', jsonb_build_object('birth_year', yr - 21, 'is_adult_declared', true)),
    (e, 'e@test.invalid', 'authenticated', 'authenticated', jsonb_build_object('birth_year', yr - 21, 'is_adult_declared', true));
  assert (select plan_status = 'unpaid' and plan_paid_until is null and plan_tier = 'basic' and is_active
          from public.twins where id = d), 'new signups start unpaid, basic, active';

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- MBTI is required to newly go public (no test covered this before).
  blocked := false;
  begin update public.twins set name = 'Dee', handle = 'dee-reg', visibility = 'public' where id = d;
  exception when raise_exception then blocked := true; end;
  assert blocked, 'going public without an MBTI type must be blocked';
  -- Self-granted plan: silently ignored, like is_adult/birth_year.
  update public.twins set plan_status = 'paid', plan_paid_until = '2099-01-01', plan_tier = 'builder' where id = d;
  update public.twins set name = 'Dee', handle = 'dee-reg', mbti_type = 'ENFP', visibility = 'public' where id = d;
  reset role;
  assert (select plan_status = 'unpaid' and plan_paid_until is null and plan_tier = 'basic' from public.twins where id = d),
    'plan_status / plan_paid_until / plan_tier must ignore client writes';
  assert (select visibility = 'public' and name = 'Dee' from public.twins where id = d),
    'ordinary profile fields must still save in the same update';
  set local role anon;
  select count(*) into n from public.list_public_twins() where handle = 'dee-reg';
  assert n = 0, 'an unpaid twin must not appear in list_public_twins even after a self-granted plan attempt';
  assert public.get_public_profile('dee-reg') is null, 'an unpaid twin''s public profile must stay hidden';
  reset role;

  -- The legitimate writer (the M-Pesa callback runs as service_role) still works.
  set local role service_role;
  update public.twins set plan_status = 'paid', plan_paid_until = now() + interval '1 year', plan_tier = 'guided' where id = d;
  reset role;
  assert (select plan_status = 'paid' and plan_tier = 'guided' from public.twins where id = d),
    'service_role (M-Pesa callback) must still be able to set the plan';

  -- Deactivation (deactivate_twin() runs as the function owner) cannot be undone by the student.
  update public.twins set is_active = false, deactivated_at = now() where id = d;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.twins set is_active = true, deactivated_at = null where id = d;
  reset role;
  assert (select not is_active and deactivated_at is not null from public.twins where id = d),
    'is_active / deactivated_at must ignore client writes';

  -- ...nor by deleting the row and recreating it (a fresh row would default to active).
  set local role authenticated;
  blocked := false; begin delete from public.twins where id = d; exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'a student must not be able to delete their own twin row';
  reset role;
  assert exists (select 1 from public.twins where id = d), 'twin row must survive the delete attempt';

  -- A signed-in account with no twin row must not be able to create one (only handle_new_user does).
  delete from public.twins where id = e;
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false;
  begin insert into public.twins (id, plan_status, is_active) values (e, 'paid', true);
  exception when insufficient_privilege then blocked := true; end;
  assert blocked, 'clients must not be able to insert twin rows';
  reset role;

  ------------------------------------------------------------ project proof columns (Build Plan 0.5)
  -- interviews_count/synced_at + pitch_scores/scores_synced_at are server-fetched
  -- (a published Google Sheet) but must never be forgeable by the browser —
  -- interviews_count feeds recompute_project_stage(), so this used to let a
  -- student self-advance their own project stage.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.projects set interviews_count = 999, interviews_synced_at = now() where id = pa;
  update public.projects set pitch_scores = '{"responses": 50, "overall": 10, "questions": []}'::jsonb, scores_synced_at = now() where id = pa;
  reset role;
  assert (select interviews_count = 0 and interviews_synced_at is null from public.projects where id = pa),
    'interviews_count / interviews_synced_at must ignore a direct client write';
  assert (select pitch_scores = '{}'::jsonb and scores_synced_at is null from public.projects where id = pa),
    'pitch_scores / scores_synced_at must ignore a direct client write';

  -- the real sync routes run as service_role (via supabaseAdmin) and write the url + derived values together
  set local role service_role;
  update public.projects set interviews_csv_url = 'https://docs.google.com/x', interviews_count = 12, interviews_synced_at = now() where id = pa;
  update public.projects set scores_csv_url = 'https://docs.google.com/y', pitch_scores = '{"responses": 5, "overall": 8, "questions": []}'::jsonb, scores_synced_at = now() where id = pa;
  reset role;
  assert (select interviews_count = 12 from public.projects where id = pa),
    'service_role (the sync route) must still be able to set interviews_count';
  assert (select (pitch_scores->>'responses')::int = 5 from public.projects where id = pa),
    'service_role (the sync route) must still be able to set pitch_scores';

  -- a client-made change to the source url invalidates the stale derived number (the
  -- url itself stays client-writable, only the derived columns are pinned)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.projects set interviews_csv_url = 'https://docs.google.com/a-new-sheet' where id = pa;
  update public.projects set scores_csv_url = 'https://docs.google.com/a-new-sheet-2' where id = pa;
  reset role;
  assert (select interviews_count = 0 and interviews_synced_at is null from public.projects where id = pa),
    'changing interviews_csv_url must reset the stale interviews_count/synced_at';
  assert (select pitch_scores = '{}'::jsonb and scores_synced_at is null from public.projects where id = pa),
    'changing scores_csv_url must reset the stale pitch_scores/scores_synced_at';

  ------------------------------------------------------------ ai_employees github stats (Build Plan 0.5)
  -- github_full_name/stars/forks/open_issues/synced_at are server-fetched (the
  -- public GitHub API) but must never be forgeable by the browser.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ai_employees (twin_id, name, link_url) values (a, 'Research bot', 'https://github.com/octocat/hello-world') returning id into ai_emp_id;
  update public.ai_employees set github_full_name = 'fake/repo', github_stars = 9999 where id = ai_emp_id;
  reset role;
  assert (select github_full_name is null and github_stars is null from public.ai_employees where id = ai_emp_id),
    'ai_employees.github_* must ignore a direct client write';

  -- the real sync route runs as service_role (via supabaseAdmin) and writes the stats
  set local role service_role;
  update public.ai_employees set github_full_name = 'octocat/hello-world', github_stars = 5, github_forks = 1, github_open_issues = 0, github_synced_at = now() where id = ai_emp_id;
  reset role;
  assert (select github_full_name = 'octocat/hello-world' and github_stars = 5 from public.ai_employees where id = ai_emp_id),
    'service_role (the sync route) must still be able to set ai_employees.github_*';

  -- changing link_url invalidates the now-unrelated stats
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.ai_employees set link_url = 'https://github.com/octocat/spoon-knife' where id = ai_emp_id;
  reset role;
  assert (select github_full_name is null and github_stars is null and github_synced_at is null from public.ai_employees where id = ai_emp_id),
    'changing link_url must reset the stale github_* stats';

  raise exception 'ALL PASS (rolled back)';
exception
  when assert_failure then
    raise exception 'ASSERTION FAILED: %', sqlerrm;
end $$;
