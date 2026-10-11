-- P0-2: v1 is 18+ only. Age is SELF-DECLARED (is_adult + birth_year only, no
-- full date of birth). The database enforces what it can:
--   * a signup that honestly declares under-18 is rejected;
--   * an account with no adult declaration cannot write content or go public;
--   * students cannot write is_adult / birth_year / parental_consent_at
--     themselves (only the signup trigger or declare_adult() can).
-- Limitation: a student can still lie. Birth YEAR alone cannot tell a 17-year-old
-- from an 18-year-old born in the same year, so the rule is
-- birth_year <= current_year - 18 plus an explicit "I am 18 or older" declaration.

alter table public.twins
  add column is_adult boolean not null default false,
  add column birth_year int;

alter table public.twins
  add constraint twins_birth_year_sane check (birth_year is null or birth_year between 1900 and 2100),
  add constraint twins_adult_has_birth_year check (not is_adult or birth_year is not null),
  add constraint twins_public_requires_adult check (visibility = 'private' or is_adult);

-- Protected columns: client roles can never set them. Definer functions below
-- run as the function owner (current_user is not authenticated/anon) so they can.
create or replace function public.guard_twin_protected_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_adult := false;
      new.birth_year := null;
      new.parental_consent_at := null;
    else
      new.is_adult := old.is_adult;
      new.birth_year := old.birth_year;
      new.parental_consent_at := old.parental_consent_at;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_twin_protected_columns() from public, anon, authenticated;

create trigger twins_guard_protected_columns
  before insert or update on public.twins
  for each row execute function public.guard_twin_protected_columns();

-- Signup: read the self-declaration from user metadata.
-- Honest under-18 declaration -> signup rejected. No declaration (e.g. a future
-- Google sign-in) -> twin created with is_adult = false and the app asks for it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  declared_year int;
  declared_adult boolean;
begin
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

-- One-time declaration for accounts created without one (existing users,
-- future OAuth sign-ins). Cannot be changed once set.
create or replace function public.declare_adult(p_birth_year int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_birth_year is null or p_birth_year < 1900
     or p_birth_year > extract(year from now())::int - 18 then
    raise exception 'MetaTwin v1 is for students aged 18 or older.' using errcode = 'P0001';
  end if;
  update public.twins
  set is_adult = true, birth_year = p_birth_year, updated_at = now()
  where id = auth.uid() and is_adult = false;
  if not found then
    insert into public.twins (id, is_adult, birth_year) values (auth.uid(), true, p_birth_year)
    on conflict (id) do nothing;
  end if;
end;
$$;

revoke all on function public.declare_adult(int) from public, anon;
grant execute on function public.declare_adult(int) to authenticated;

-- Content writes require an adult declaration.
create or replace function public.twin_is_adult(p_twin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_adult from public.twins where id = p_twin_id), false);
$$;

revoke all on function public.twin_is_adult(uuid) from public, anon;
grant execute on function public.twin_is_adult(uuid) to authenticated;

drop policy "competencies: owner insert" on public.competencies;
create policy "competencies: owner insert" on public.competencies for insert
  with check (auth.uid() = twin_id and public.twin_is_adult(twin_id));

drop policy "courses: owner insert" on public.courses;
create policy "courses: owner insert" on public.courses for insert
  with check (auth.uid() = twin_id and public.twin_is_adult(twin_id));

drop policy "projects: owner insert" on public.projects;
create policy "projects: owner insert" on public.projects for insert
  with check (auth.uid() = twin_id and public.twin_is_adult(twin_id));

drop policy "assessments: owner insert" on public.assessments;
create policy "assessments: owner insert" on public.assessments for insert
  with check (auth.uid() = twin_id and public.twin_is_adult(twin_id));

drop policy "matches: owner insert" on public.matches;
create policy "matches: owner insert" on public.matches for insert
  with check (auth.uid() = twin_id and public.twin_is_adult(twin_id));

drop policy "evidence: owner insert" on public.evidence;
create policy "evidence: owner insert" on public.evidence for insert
  with check (auth.uid() = twin_id and public.twin_is_adult(twin_id));
