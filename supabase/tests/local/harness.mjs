// Local database harness: a throwaway, in-memory Postgres 17 (PGlite, compiled to
// WebAssembly — no Docker, no server, no network) with stand-ins for the
// Supabase-managed schemas, and every migration in supabase/migrations applied in
// order. Used by `npm run test:db` and `npm run db:audit`, locally and in CI.
//
// Why this exists: the only real database is production, and on 2026-10-14 a
// verification script run against it deleted real data (see docs/DECISIONS.md
// D-007). Schema changes and the security regression suite are proven here first.
//
// Fidelity notes: PGlite is real Postgres (same planner, RLS, grants, triggers,
// plpgsql). The stubs (supabase-stubs.sql) model only what the migrations touch:
// roles anon/authenticated/service_role, auth.users + auth.uid()/role()/jwt()
// reading `request.jwt.claims` (as PostgREST sets it), storage.buckets/objects,
// vault secrets, and pg_net's net.http_post (queued into net.http_request_queue,
// never sent). Supabase's default privileges are reproduced so that migrations
// which revoke them behave as they did on the real project.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// pg_net isn't available in PGlite; migrations that create/move the extension get
// this stub instead (same function signature, requests are only queued).
const NET_STUB = `
create schema if not exists net;
create table if not exists net.http_request_queue (
  id bigserial primary key, url text, headers jsonb, body jsonb, created_at timestamptz default now()
);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language sql as $$
  insert into net.http_request_queue(url, headers, body) values (url, headers, body) returning id
$$;
`;

/** Returns a PGlite instance with the stubs and every migration applied. Throws on the first failing migration. */
export async function createMigratedDb(repoRoot) {
  const migDir = path.join(repoRoot, "supabase", "migrations");
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(HERE, "supabase-stubs.sql"), "utf8"));

  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  let netReady = false;
  for (const file of files) {
    let sql = fs.readFileSync(path.join(migDir, file), "utf8");
    if (/extension[^;]*pg_net/i.test(sql)) {
      sql = sql.replace(/(drop|create|alter)\s+extension[^;]*pg_net[^;]*;/gi, "");
      if (!netReady) {
        sql = NET_STUB + sql;
        netReady = true;
      }
    }
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration failed: ${file}\n  ${error.message}`);
    }
    const [version, ...name] = file.replace(/\.sql$/, "").split("_");
    await db.query("insert into supabase_migrations.schema_migrations(version, name) values ($1, $2)", [version, name.join("_")]);
  }
  return { db, migrationCount: files.length };
}
