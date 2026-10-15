-- LOCAL HARNESS ONLY (`npm run test:db`). Never run against a real database: it
-- signs up the real allow-listed platform-admin email, which already exists on
-- production. Checks that the admin deactivate/reactivate path still works after
-- the twins column guard (migration 20261014200000).
do $$
declare
  adm uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  yr int := extract(year from now())::int;
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

  raise exception 'ALL PASS (rolled back)';
exception
  when assert_failure then
    raise exception 'ASSERTION FAILED: %', sqlerrm;
end $$;
