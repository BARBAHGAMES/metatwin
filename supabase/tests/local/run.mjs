// `npm run test:db` — applies every migration to a throwaway local database
// (harness.mjs) and runs each SQL test file. A test file is a single DO block that
// ends with `raise exception 'ALL PASS (rolled back)'` on success (so it always
// aborts and leaves nothing behind) or 'ASSERTION FAILED: ...' on failure.
//
// Usage: node supabase/tests/local/run.mjs [test.sql ...]
//   (defaults to supabase/tests/security_regression.sql + supabase/tests/local/*.local.sql)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMigratedDb } from "./harness.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const localDir = path.join(repoRoot, "supabase/tests/local");
const tests = process.argv.length > 2
  ? process.argv.slice(2)
  : [
      path.join(repoRoot, "supabase/tests/security_regression.sql"),
      ...fs.readdirSync(localDir).filter((f) => f.endsWith(".local.sql")).sort().map((f) => path.join(localDir, f)),
    ];

let db, migrationCount;
try {
  ({ db, migrationCount } = await createMigratedDb(repoRoot));
} catch (error) {
  console.error(`[test:db] ${error.message}`);
  process.exit(2);
}
console.log(`[test:db] applied ${migrationCount} migrations to a local throwaway database`);

let failures = 0;
for (const file of tests) {
  const name = path.relative(repoRoot, file);
  try {
    await db.exec(fs.readFileSync(file, "utf8"));
    console.error(`[test:db] FAIL ${name}: finished without the terminal 'ALL PASS' exception`);
    failures++;
  } catch (error) {
    if (/ALL PASS/.test(error.message)) {
      console.log(`[test:db] PASS ${name}`);
    } else {
      console.error(`[test:db] FAIL ${name}: ${error.message}`);
      failures++;
    }
  }
}
await db.close();
process.exit(failures ? 1 : 0);
