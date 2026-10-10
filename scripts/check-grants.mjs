// Pre-deploy guardrail, carried over from barbah-games-platform's
// scripts/check-grants.mjs. A column added to a public table with no SELECT
// grant to anon/authenticated silently 403s the ENTIRE row for any
// client-side query that touches it (not just that column) — and
// `get_advisors(security)` does NOT catch a missing grant, only missing RLS.
// See barbah-games-platform's .claude/task-logs/2026-08-04-gamers-column-grant-sweep.json
// for the incident this was built to prevent.
//
// Scans every `supabase.from("table").select("...")` call reachable from the
// plain (anon/authenticated) client — deliberately NOT supabaseAdmin calls,
// which run as service_role and bypass grants entirely by design — and
// cross-checks the selected columns against the live database's actual
// grants via the introspect_public_column_grants RPC (see its own migration
// for why a wrapper function is needed: information_schema isn't exposed to
// PostgREST directly).
//
// Deliberately conservative: anything this script can't confidently parse (a
// select() argument built from something other than a string literal or a
// same-file `const NAME = "..."` it can resolve) is reported as a SKIPPED
// line, never silently ignored.
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SRC_DIR = path.join(root, "src");

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

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function splitTopLevel(selectStr) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of selectStr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function extractColumns(selectStr) {
  const tokens = splitTopLevel(selectStr);
  const wildcard = tokens.includes("*");
  const columns = tokens
    .filter((t) => !t.includes("(") && t !== "*")
    .map((t) => (t.includes(":") ? t.split(":")[1] : t).trim())
    .filter(Boolean);
  return { columns, wildcard };
}

function findSelectCalls(filePath, sourceText) {
  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  let plainClientLocalName = null;
  const stringConsts = new Map();

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier.getText(sf).includes("integrations/supabase/client") &&
      !node.moduleSpecifier.getText(sf).includes("client.server")
    ) {
      const clause = node.importClause;
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          if (el.propertyName?.text === "supabase" || el.name.text === "supabase")
            plainClientLocalName = el.name.text;
        }
      }
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          ts.isStringLiteral(decl.initializer)
        ) {
          stringConsts.set(decl.name.text, decl.initializer.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (!plainClientLocalName) return [];

  const results = [];

  function visitSelects(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "select"
    ) {
      const receiver = node.expression.expression;
      if (
        ts.isCallExpression(receiver) &&
        ts.isPropertyAccessExpression(receiver.expression) &&
        receiver.expression.name.text === "from" &&
        ts.isIdentifier(receiver.expression.expression) &&
        receiver.expression.expression.text === plainClientLocalName &&
        receiver.arguments[0] &&
        ts.isStringLiteral(receiver.arguments[0])
      ) {
        const table = receiver.arguments[0].text;
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        const arg = node.arguments[0];
        let selectStr = null;
        let unresolved = false;
        if (arg) {
          if (ts.isStringLiteral(arg)) selectStr = arg.text;
          else if (ts.isIdentifier(arg) && stringConsts.has(arg.text))
            selectStr = stringConsts.get(arg.text);
          else unresolved = true;
        } else {
          unresolved = true;
        }
        results.push({ file: filePath, line: line + 1, table, selectStr, unresolved });
      }
    }
    ts.forEachChild(node, visitSelects);
  }
  visitSelects(sf);
  return results;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[check-grants] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available — skipping grant check (not blocking, but unverified).",
    );
    process.exit(0);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const files = walk(SRC_DIR);
  const allCalls = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(".select(")) continue;
    allCalls.push(...findSelectCalls(file, text));
  }

  const dbErrorTables = new Set();
  const tableCache = new Map();
  async function getTableGrants(table) {
    if (tableCache.has(table)) return tableCache.get(table);
    const { data, error } = await admin.rpc("introspect_public_column_grants", { p_table: table });
    if (error) {
      console.warn(
        `[check-grants] couldn't introspect grants for "${table}": ${error.message} — DB unreachable, cannot verify`,
      );
      dbErrorTables.add(table);
      tableCache.set(table, null);
      return null;
    }
    const map = new Map();
    for (const row of data ?? [])
      map.set(row.column_name, { anon: row.anon_select, authenticated: row.authenticated_select });
    tableCache.set(table, map);
    return map;
  }

  const failures = [];
  const skipped = [];

  for (const call of allCalls) {
    const rel = path.relative(root, call.file);
    if (call.unresolved) {
      skipped.push(
        `${rel}:${call.line}  supabase.from("${call.table}").select(<unresolved — not a string literal or known const>)`,
      );
      continue;
    }
    const grants = await getTableGrants(call.table);
    if (!grants) {
      const reason = dbErrorTables.has(call.table) ? "DB unreachable" : "grants unavailable";
      skipped.push(`${rel}:${call.line}  table "${call.table}" — ${reason}`);
      continue;
    }

    const { columns, wildcard } = extractColumns(call.selectStr);
    const toCheck = wildcard ? [...grants.keys()] : columns;
    for (const col of toCheck) {
      const g = grants.get(col);
      if (!g) continue;
      if (!g.anon && !g.authenticated) {
        failures.push(
          `${rel}:${call.line}  "${call.table}"."${col}" has NO SELECT grant to anon or authenticated — this query will 403 the ENTIRE row.`,
        );
      }
    }
  }

  console.log(
    `[check-grants] scanned ${allCalls.length} client-side select() call(s) across ${files.length} files.`,
  );
  if (skipped.length) {
    console.log(
      `\n[check-grants] ${skipped.length} call(s) skipped (couldn't statically resolve — review manually):`,
    );
    skipped.forEach((s) => console.log("  - " + s));
  }
  if (failures.length) {
    console.error(`\n[check-grants] ${failures.length} BLOCKING issue(s) found:`);
    failures.forEach((f) => console.error("  ✗ " + f));
    console.error(
      "\nFix: GRANT SELECT (column) ON public.<table> TO anon, authenticated; (or authenticated only, matching the column's intended readers per its RLS policy) via apply_migration, then re-run this check.",
    );
    process.exit(1);
  }
  if (dbErrorTables.size) {
    console.error(
      `\n[check-grants] BLOCKING: could not reach the database to verify grants for ${dbErrorTables.size} table(s): ${[...dbErrorTables].join(", ")}.`,
    );
    console.error(
      "This check cannot pass without actually verifying grants. Fix the DB connection (or credentials) and re-run — do not bypass.",
    );
    process.exit(1);
  }
  console.log("[check-grants] no missing-grant issues found.");
}

main().catch((err) => {
  console.error("[check-grants] crashed:", err);
  process.exit(1);
});
