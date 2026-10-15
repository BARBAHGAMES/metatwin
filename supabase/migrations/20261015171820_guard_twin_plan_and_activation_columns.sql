-- Security fix: a signed-in student could grant themselves a paid plan, or undo a
-- platform-admin deactivation, straight from the browser.
--
-- `twins` carries a table-wide `grant ... update on public.twins to authenticated`,
-- and guard_twin_protected_columns() (20261011062032) only pinned is_adult /
-- birth_year / parental_consent_at. The plan columns (20261014072301,
-- 20261014083935) and the soft-delete columns (20261014062257) were added later
-- and inherited the open UPDATE grant with no guard, so e.g.
--   supabase.from('twins').update({ plan_status: 'paid', plan_paid_until: '2099-01-01' })
-- skipped the M-Pesa paywall, and `update({ is_active: true })` reversed a deactivation.
--
-- Fix, same mechanism as the existing guard (client writes are silently reset, so
-- no current client code breaks — none of it sends these columns):
--   * pin plan_status / plan_paid_until / plan_tier / is_active / deactivated_at on
--     any write made as `authenticated` or `anon`.
--   * legitimate writers are unaffected: the M-Pesa callback runs as service_role;
--     deactivate_twin()/reactivate_twin() and handle_new_user() are SECURITY DEFINER
--     and run as their owner.
--
-- Also closes the delete-and-recreate bypass: a deactivated student could DELETE
-- their own twin row and INSERT a fresh one (is_active defaults to true). No client
-- code inserts or deletes twin rows — handle_new_user() creates the row at signup —
-- so both privileges are revoked. (The owner insert/delete policies are left in place
-- and become inert; account deletion, when built, should go through a server route.)
--
-- Covered by the "plan, activation and MBTI gating" section of
-- supabase/tests/security_regression.sql.

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
      new.plan_status := 'unpaid';
      new.plan_paid_until := null;
      new.plan_tier := 'basic';
      new.is_active := true;
      new.deactivated_at := null;
    else
      new.is_adult := old.is_adult;
      new.birth_year := old.birth_year;
      new.parental_consent_at := old.parental_consent_at;
      new.plan_status := old.plan_status;
      new.plan_paid_until := old.plan_paid_until;
      new.plan_tier := old.plan_tier;
      new.is_active := old.is_active;
      new.deactivated_at := old.deactivated_at;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_twin_protected_columns() from public, anon, authenticated;

revoke insert, delete on public.twins from authenticated, anon;
