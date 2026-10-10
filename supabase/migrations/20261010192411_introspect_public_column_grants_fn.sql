-- Backs the build-time guardrail (scripts/check-grants.mjs, run as
-- `predeploy`), carried over from barbah-games-platform. information_schema
-- isn't exposed to PostgREST directly, so this is a thin SECURITY DEFINER
-- wrapper the check script can call via the service-role key. Read-only,
-- introspection-only — no data, no writes.
create or replace function public.introspect_public_column_grants(p_table text)
returns table(column_name text, anon_select boolean, authenticated_select boolean)
language sql
security definer
set search_path = public
as $$
  select
    c.column_name::text,
    exists(
      select 1 from information_schema.column_privileges p
      where p.table_schema = 'public' and p.table_name = p_table
        and p.column_name = c.column_name and p.grantee = 'anon' and p.privilege_type = 'SELECT'
    ) as anon_select,
    exists(
      select 1 from information_schema.column_privileges p
      where p.table_schema = 'public' and p.table_name = p_table
        and p.column_name = c.column_name and p.grantee = 'authenticated' and p.privilege_type = 'SELECT'
    ) as authenticated_select
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table;
$$;

-- Introspection of grants is itself sensitive (schema reconnaissance) —
-- service_role only, never anon/authenticated.
revoke all on function public.introspect_public_column_grants(text) from public, anon, authenticated;
grant execute on function public.introspect_public_column_grants(text) to service_role;
