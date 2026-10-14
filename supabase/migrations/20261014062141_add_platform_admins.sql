-- Platform admin accounts (Andrew's own operator access). A materially
-- different entity from twins and school_admins — sees every student's
-- email, can deactivate any profile. status starts 'pending' and can only
-- move to 'verified'/'rejected' by hand (see
-- notify_platform_admin_signup_webhook for the "Andrew gets emailed" half);
-- there is no in-app approval UI at this scale, same as school_admins.
create table public.platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint platform_admins_full_name_length check (char_length(full_name) between 1 and 120)
);

-- Protected columns: only handle_new_user() (SECURITY DEFINER) or a manual
-- operator action against the DB can move status — never the admin themselves.
create or replace function public.guard_platform_admin_protected_columns()
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
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_platform_admin_protected_columns() from public, anon, authenticated;

create trigger platform_admins_guard_protected_columns
  before insert or update on public.platform_admins
  for each row execute function public.guard_platform_admin_protected_columns();

alter table public.platform_admins enable row level security;
create policy "own read" on public.platform_admins for select to authenticated using (id = (select auth.uid()));
create policy "own update" on public.platform_admins for update to authenticated using (id = (select auth.uid()));

-- No insert grant: the row is created only by handle_new_user() (SECURITY
-- DEFINER, bypasses RLS/grants), same as twins/school_admins. No anon grant.
grant select, update on public.platform_admins to authenticated;
