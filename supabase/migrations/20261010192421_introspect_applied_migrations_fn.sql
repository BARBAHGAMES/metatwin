-- Backs the build-time guardrail (scripts/check-migrations-sync.mjs, run as
-- `predeploy`), carried over from barbah-games-platform. apply_migration
-- (the Supabase MCP tool) assigns its own version timestamp at apply time,
-- decoupled from whatever local filename a session writes --
-- supabase_migrations.schema_migrations isn't exposed to PostgREST directly
-- (non-public schema), so this is a thin SECURITY DEFINER wrapper the check
-- script can call via the service-role key, same pattern as
-- introspect_public_column_grants.
create or replace function public.introspect_applied_migrations()
returns table(version text, name text)
language sql
security definer
set search_path = public
as $$
  select m.version, m.name
  from supabase_migrations.schema_migrations m
  order by m.version;
$$;

revoke all on function public.introspect_applied_migrations() from public, anon, authenticated;
grant execute on function public.introspect_applied_migrations() to service_role;
