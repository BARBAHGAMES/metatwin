-- School admin accounts (MKU pilot). A materially different entity from
-- twins — no handle, no public profile, no capabilities. status starts
-- 'pending' and can only move to 'verified'/'rejected' by hand (see
-- school_admin_signup_webhook_trigger for the "Andrew gets emailed" half);
-- there is no in-app approval UI at this pilot scale.
create table public.school_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  university_id uuid not null references public.universities(id),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint school_admins_full_name_length check (char_length(full_name) between 1 and 120),
  constraint school_admins_phone_format check (phone ~ '^\+?[0-9 ]{7,20}$')
);

-- Protected columns: only handle_new_user() (SECURITY DEFINER) or a manual
-- operator action against the DB can move status — never the admin themselves.
create or replace function public.guard_school_admin_protected_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.verified_at := null;
    else
      new.status := old.status;
      new.verified_at := old.verified_at;
      new.university_id := old.university_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_school_admin_protected_columns() from public, anon, authenticated;

create trigger school_admins_guard_protected_columns
  before insert or update on public.school_admins
  for each row execute function public.guard_school_admin_protected_columns();

alter table public.school_admins enable row level security;
create policy "own read" on public.school_admins for select to authenticated using (id = (select auth.uid()));
create policy "own update" on public.school_admins for update to authenticated using (id = (select auth.uid()));

-- No insert grant: the row is created only by handle_new_user() (SECURITY
-- DEFINER, bypasses RLS/grants), same as twins. No anon grant at all.
grant select, update on public.school_admins to authenticated;
