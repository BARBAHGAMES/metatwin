// Guardrail against migration-history drift between this repo and what's
// actually applied to the database, carried over from barbah-games-platform's
// scripts/check-migrations-sync.mjs.
//
// apply_migration (the Supabase MCP tool) assigns its own version timestamp
// at apply time, decoupled from whatever local filename a session writes —
// so drift happens when a fix lands live and the matching local file is
// never written. Unlike barbah-games-platform, this project has no legacy
// drift to grandfather: every migration, from the first one, must have an
// exact-matching local file.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(root, "supabase", "migrations");

function loadEnv() {
  const envVars = {};
  try {
    readFileSync(path.join(root, ".env"), "utf8")
      .split("\n")
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        )
          val = val.slice(1, -1);
        envVars[key] = val;
      });
  } catch {
    // .env missing — fall back to process.env (e.g. a future CI environment)
  }
  return envVars;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[check-migrations-sync] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available — skipping (not blocking, but unverified).",
    );
    process.exit(0);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("introspect_applied_migrations");
  if (error) {
    console.error(
      `[check-migrations-sync] couldn't introspect applied migrations: ${error.message}`,
    );
    console.error(
      "(if this is a fresh project without the introspect_applied_migrations_fn migration yet, apply it first.)",
    );
    process.exit(1);
  }

  const localFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const localByVersion = new Map();
  for (const f of localFiles) {
    const m = f.match(/^(\d+)_(.+)\.sql$/);
    if (!m) continue;
    localByVersion.set(m[1], { name: m[2], file: f });
  }

  const applied = data ?? [];

  const missing = [];
  const mismatched = [];
  for (const row of applied) {
    const local = localByVersion.get(row.version);
    if (!local) {
      missing.push(row);
    } else if (local.name !== row.name) {
      mismatched.push({ row, local });
    }
  }

  console.log(
    `[check-migrations-sync] ${applied.length} migration(s) applied, checked against ${localFiles.length} local file(s).`,
  );

  if (missing.length || mismatched.length) {
    if (missing.length) {
      console.error(
        `\n[check-migrations-sync] ${missing.length} migration(s) applied to the database with NO matching local file:`,
      );
      missing.forEach((row) =>
        console.error(
          `  ✗ ${row.version}_${row.name}.sql — create this file with the exact SQL that was applied.`,
        ),
      );
    }
    if (mismatched.length) {
      console.error(
        `\n[check-migrations-sync] ${mismatched.length} local file version(s) whose name doesn't match what was actually applied:`,
      );
      mismatched.forEach(({ row, local }) =>
        console.error(
          `  ✗ local "${local.file}" has name "${local.name}", but the DB recorded "${row.name}" for version ${row.version}`,
        ),
      );
    }
    console.error(
      "\nFix: use list_migrations / query supabase_migrations.schema_migrations for the exact version+name+statements, then write/rename the local file to match verbatim.",
    );
    process.exit(1);
  }

  console.log("[check-migrations-sync] no drift found — local migrations match what's applied.");
}

main().catch((err) => {
  console.error("[check-migrations-sync] crashed:", err);
  process.exit(1);
});
