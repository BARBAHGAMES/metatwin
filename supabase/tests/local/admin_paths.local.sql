-- LOCAL HARNESS ONLY (`npm run test:db`). Never run against a real database: it
-- signs up the real allow-listed platform-admin email, which already exists on
-- production. Checks that the admin deactivate/reactivate path still works after
-- the twins column guard (migration 20261014200000).
do $$
declare
  adm uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  yr int := extract(year from now())::int;
  proj uuid;
  fb jsonb;
  fb_id uuid;
  n int;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (adm, 'andrew@metaglobetechnologies.co.ke', 'authenticated', 'authenticated', '{"account_type":"platform_admin","full_name":"Admin"}'),
    (s, 's@test.invalid', 'authenticated', 'authenticated', jsonb_build_object('birth_year', yr - 22, 'is_adult_declared', true));
  update public.platform_admins set status = 'verified', verified_at = now() where id = adm;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.deactivate_twin(s);
  reset role;
  assert (select not is_active and deactivated_at is not null from public.twins where id = s),
    'a verified platform admin must still be able to deactivate a twin';

  set local role authenticated;
  perform public.reactivate_twin(s);
  reset role;
  assert (select is_active from public.twins where id = s),
    'a verified platform admin must still be able to reactivate a twin';

  -- A student cannot call the admin functions on anyone.
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.deactivate_twin(s);
    assert false, 'a student must not be able to call deactivate_twin';
  exception when assert_failure then raise; when insufficient_privilege then null;  -- 'Not authorized.' (42501)
  end;
  reset role;

  -- Visitor-feedback moderation: only a verified platform admin sees reviewer contacts and can delete.
  update public.twins set name = 'Sam', handle = 'sam-local', mbti_type = 'INTJ', plan_status = 'grandfathered', visibility = 'public' where id = s;
  insert into public.projects (twin_id, title) values (s, 'Sam project') returning id into proj;
  set local role service_role;
  fb := public.submit_project_feedback('sam-local', proj, 4, 'Solid idea.', 'Visitor', 'mentor', null, 'visitor@test.invalid', '+254711111111', true, repeat('e', 64));
  fb_id := (fb ->> 'feedback_id')::uuid;
  perform public.confirm_project_feedback(repeat('e', 64));
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_list_project_feedback();
    assert false, 'a student must not be able to list feedback with contact details';
  exception when assert_failure then raise; when insufficient_privilege then null;
  end;
  begin
    perform public.admin_delete_project_feedback(fb_id);
    assert false, 'a student must not be able to delete feedback as admin';
  exception when assert_failure then raise; when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select to_jsonb(x) into fb from public.admin_list_project_feedback() x where x.id = fb_id;
  assert fb ->> 'reviewer_email' = 'visitor@test.invalid' and fb ->> 'reviewer_whatsapp' = '+254711111111',
    'a verified platform admin sees reviewer email and WhatsApp for moderation';
  perform public.admin_delete_project_feedback(fb_id);
  reset role;
  assert not exists (select 1 from public.project_feedback where id = fb_id), 'platform admin delete removes the feedback';
  assert not exists (select 1 from public.project_feedback_contacts where feedback_id = fb_id), '... and its contact details';

  raise exception 'ALL PASS (rolled back)';
exception
  when assert_failure then
    raise exception 'ASSERTION FAILED: %', sqlerrm;
end $$;
