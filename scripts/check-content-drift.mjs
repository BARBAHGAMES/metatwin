// Pre-deploy guardrail. Content on this site (marketing copy, pricing plans,
// fictional sample data in src/lib/data.ts/pricing.ts) has gone missing from
// the live site twice without anyone noticing before it shipped — once from a
// concurrent-session merge, once from a stale asset. Neither `tsc` nor
// `eslint` catches "a paragraph silently vanished"; the page still compiles
// fine with less text on it.
//
// This script extracts every piece of literal page copy (JSX text nodes +
// JSX attribute string literals in src/routes & src/components, every string
// literal in src/lib/data.ts & pricing.ts) into a deterministic snapshot and
// diffs it against the last COMMITTED snapshot at .claude/content-snapshot.json.
//
// It is deliberately a blunt instrument, not a precise content-management
// system: it will not catch a single sentence being reworded, and it treats
// some non-prose strings (CSS utility classes slipping past the attribute
// blocklist, enum-like values) as content too. What it WILL catch is a whole
// paragraph, section, or route's copy disappearing — the actual failure mode
// this was built to prevent. False positives are expected and fine: when a
// flagged change is real (you deliberately rewrote or removed copy), accept
// it with `npm run content-snapshot` and commit the updated snapshot file
// alongside your content change, so the diff is visible in the PR/commit.
//
// Usage:
//   npm run check-content-drift   — compares current source against the
//                                   committed snapshot; exits 1 on regression.
//   npm run content-snapshot      — regenerates the snapshot file from
//                                   current source (run after a deliberate
//                                   content change, then commit the result).
import ts from "typescript";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = path.join(root, ".claude", "content-snapshot.json");

// Directories/files scanned for content. Deliberately excludes
// src/components/ui/** (vanilla shadcn primitives, no page-specific prose —
// would be pure noise) and anything generated.
const SCAN_ROOTS = [
  path.join(root, "src", "routes"),
  path.join(root, "src", "components"),
  path.join(root, "src", "lib"),
];
const EXCLUDE_DIRS = new Set(["ui"]);
const EXCLUDE_FILES = /\.(gen|test)\.(ts|tsx)$/;

// JSX attributes that are structural/styling, never page copy, even though
// their value is technically a string literal.
const ATTR_BLOCKLIST = new Set([
  "className",
  "class",
  "id",
  "key",
  "name",
  "htmlFor",
  "type",
  "variant",
  "size",
  "role",
  "rel",
  "target",
  "aria-hidden",
  "width",
  "height",
  "viewBox",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeLinecap",
  "strokeLinejoin",
  "d",
  "cx",
  "cy",
  "r",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "points",
  "transform",
  "to",
  "method",
  "autoComplete",
  "inputMode",
  "pattern",
  "min",
  "max",
  "step",
  "colSpan",
  "rowSpan",
  "scope",
  "value",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !EXCLUDE_FILES.test(entry)) out.push(full);
  }
  return out;
}

function extractContent(filePath, sourceText) {
  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const strings = [];

  function addIfContent(text) {
    const t = text.trim().replace(/\s+/g, " ");
    // Skip empty, pure-whitespace, single-char, or obviously non-prose tokens.
    if (t.length < 2) return;
    strings.push(t);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return; // module specifiers aren't content
    if (ts.isJsxText(node)) {
      addIfContent(node.getText(sf));
    } else if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sf);
      if (!ATTR_BLOCKLIST.has(attrName)) {
        const init = node.initializer;
        if (init && ts.isStringLiteral(init)) {
          addIfContent(init.text);
        } else if (init && ts.isJsxExpression(init) && init.expression) {
          if (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)) {
            addIfContent(init.expression.text);
          }
        }
      }
      // Don't recurse into the attribute's own children beyond what we just handled.
      return;
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // Only for plain .ts data files (routes/components are covered via
      // JsxText/JsxAttribute above; bare string literals there are far more
      // likely to be non-content like Tailwind classes or import-adjacent
      // identifiers). TemplateExpression (has substitutions) is skipped —
      // those are per-item dynamic strings, not fixed copy.
      if (filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
        addIfContent(node.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return strings;
}

function buildSnapshot() {
  const snapshot = {};
  for (const scanRoot of SCAN_ROOTS) {
    if (!existsSync(scanRoot)) continue;
    for (const file of walk(scanRoot)) {
      const rel = path.relative(root, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      const content = extractContent(file, text);
      if (content.length) snapshot[rel] = content;
    }
  }
  return snapshot;
}

function diffFile(oldStrings, newStrings) {
  const newSet = new Set(newStrings);
  return oldStrings.filter((s) => !newSet.has(s));
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const current = buildSnapshot();

  if (mode === "write") {
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2) + "\n");
    const fileCount = Object.keys(current).length;
    const stringCount = Object.values(current).reduce((n, arr) => n + arr.length, 0);
    console.log(`[content-snapshot] wrote ${SNAPSHOT_PATH} — ${fileCount} files, ${stringCount} strings.`);
    console.log("[content-snapshot] commit this file alongside your content change.");
    return;
  }

  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(
      `[check-content-drift] No snapshot found at ${path.relative(root, SNAPSHOT_PATH)}. Run \`npm run content-snapshot\` once to create the baseline, then commit it.`,
    );
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));

  const regressions = [];
  const removedFiles = [];

  for (const [file, oldStrings] of Object.entries(baseline)) {
    const newStrings = current[file];
    if (!newStrings) {
      removedFiles.push(file);
      continue;
    }
    const missing = diffFile(oldStrings, newStrings);
    const oldChars = oldStrings.join("").length;
    const newChars = newStrings.join("").length;
    // Flag if a meaningful chunk of this file's copy disappeared: either a
    // double-digit number of distinct strings, or >=15% of total characters.
    const charDropRatio = oldChars === 0 ? 0 : (oldChars - newChars) / oldChars;
    if (missing.length >= 3 || charDropRatio >= 0.15) {
      regressions.push({ file, missing, oldChars, newChars, charDropRatio });
    }
  }

  const newFiles = Object.keys(current).filter((f) => !(f in baseline));

  console.log(
    `[check-content-drift] compared ${Object.keys(baseline).length} snapshotted file(s) against current source.`,
  );

  if (removedFiles.length) {
    console.error(`\n[check-content-drift] ${removedFiles.length} file(s) that had tracked content are now GONE:`);
    removedFiles.forEach((f) => console.error("  ✗ " + f));
  }

  if (regressions.length) {
    console.error(`\n[check-content-drift] ${regressions.length} file(s) lost significant copy:`);
    for (const r of regressions) {
      console.error(
        `  ✗ ${r.file} — ${r.missing.length} string(s) gone, ${Math.round(r.charDropRatio * 100)}% character drop (${r.oldChars} -> ${r.newChars})`,
      );
      for (const m of r.missing.slice(0, 8)) {
        console.error(`      - "${m.length > 100 ? m.slice(0, 100) + "…" : m}"`);
      }
      if (r.missing.length > 8) console.error(`      … and ${r.missing.length - 8} more`);
    }
  }

  if (newFiles.length) {
    console.log(`\n[check-content-drift] ${newFiles.length} new content-bearing file(s) not yet in the snapshot (fine, just informational):`);
    newFiles.forEach((f) => console.log("  + " + f));
  }

  if (removedFiles.length || regressions.length) {
    console.error(
      "\nIf this is a deliberate content change: run `npm run content-snapshot` and commit the updated .claude/content-snapshot.json alongside it.\nIf it's not deliberate: this is exactly what this check exists to catch — find out where the copy went before deploying.",
    );
    process.exit(1);
  }

  console.log("[check-content-drift] no content regressions found.");
}

main();
