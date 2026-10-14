-- Branches signup on raw_user_meta_data->>'account_type', same pattern as
-- the school_admin branch added 2026-10-13. 'platform_admin' is gated by a
-- hardcoded email allowlist enforced server-side (the actual security
-- boundary — this is operator-level access that can see every student's
-- email and deactivate any profile, so there is no self-serve path at all,
-- not even for the allowlisted address: it still lands 'pending' and needs
-- a manual verify, same as school_admins).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  declared_year int;
  declared_adult boolean;
  account_type text;
  admin_university_id uuid;
begin
  account_type := new.raw_user_meta_data ->> 'account_type';

  if account_type = 'platform_admin' then
    if new.email is null or lower(new.email) <> 'barbahgames@gmail.com' then
      raise exception 'Platform admin accounts are invite-only.' using errcode = 'P0001';
    end if;
    insert into public.platform_admins (id, full_name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Unknown')
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if account_type = 'school_admin' then
    if new.email is null or lower(new.email) !~ '^[^@]+@mku\.ac\.ke$' then
      raise exception 'School admin accounts require a Mount Kenya University email address (@mku.ac.ke).' using errcode = 'P0001';
    end if;
    begin
      admin_university_id := nullif(new.raw_user_meta_data ->> 'university_id', '')::uuid;
    exception when others then
      admin_university_id := null;
    end;
    if admin_university_id is null or not exists (select 1 from public.universities where id = admin_university_id) then
      raise exception 'Select your Mount Kenya University campus.' using errcode = 'P0001';
    end if;
    insert into public.school_admins (id, full_name, phone, university_id)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Unknown'),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), ''),
      admin_university_id
    )
    on conflict (id) do nothing;
    return new;
  end if;

  begin
    declared_year := nullif(new.raw_user_meta_data ->> 'birth_year', '')::int;
  exception when others then
    declared_year := null;
  end;
  declared_adult := coalesce((new.raw_user_meta_data ->> 'is_adult_declared') = 'true', false);

  if declared_year is not null and declared_year > extract(year from now())::int - 18 then
    raise exception 'MetaTwin v1 is for students aged 18 or older.' using errcode = 'P0001';
  end if;

  if declared_adult and declared_year is not null and declared_year >= 1900 then
    insert into public.twins (id, is_adult, birth_year) values (new.id, true, declared_year)
    on conflict (id) do nothing;
  else
    insert into public.twins (id) values (new.id)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
