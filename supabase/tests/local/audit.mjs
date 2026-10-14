// `npm run db:audit` — prints the effective security posture of the schema after all
// migrations: RLS per table, client write privileges, write policies, BEFORE triggers
// (the column guards), anon-callable SECURITY DEFINER functions and storage policies.
// Read this after any migration that adds a table, column, grant or function.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMigratedDb } from "./harness.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { db, migrationCount } = await createMigratedDb(repoRoot);
console.log(`[db:audit] ${migrationCount} migrations applied`);

const report = async (title, sql) => {
  const { rows } = await db.query(sql);
  console.log(`\n## ${title}`);
  console.table(rows);
  return rows;
};

const rls = await report("RLS per public table", `
  select c.relname as table, c.relrowsecurity as rls,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)::int as policies
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by 1`);

await report("Client write privileges (table-level)", `
  select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  group by 1, 2 order by 1, 2`);

await report("Column-only UPDATE grants (authenticated)", `
  select table_name, string_agg(column_name, ',' order by column_name) as columns
  from information_schema.column_privileges cp
  where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'UPDATE'
    and not exists (select 1 from information_schema.role_table_grants g
                    where g.table_schema = 'public' and g.table_name = cp.table_name
                      and g.grantee = 'authenticated' and g.privilege_type = 'UPDATE')
  group by 1`);

await report("Write policies", `
  select tablename, policyname, cmd, roles::text
  from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL') order by 1, 2`);

await report("BEFORE triggers (column guards)", `
  select event_object_table as table, trigger_name, string_agg(event_manipulation, ',') as events
  from information_schema.triggers where trigger_schema = 'public' and action_timing = 'BEFORE'
  group by 1, 2 order by 1`);

await report("SECURITY DEFINER functions callable by anon", `
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1`);

await report("Storage policies", `
  select policyname, cmd, roles::text from pg_policies where schemaname = 'storage' order by 1`);

await db.close();
const noRls = rls.filter((r) => !r.rls);
if (noRls.length) {
  console.error(`\n[db:audit] FAIL: tables without RLS: ${noRls.map((r) => r.table).join(", ")}`);
  process.exit(1);
}
console.log("\n[db:audit] every public table has RLS enabled");
