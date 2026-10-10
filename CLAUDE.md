# MetaTwin — metatwin

Read [`.claude/PROJECT_STATE.md`](.claude/PROJECT_STATE.md) **first, before doing anything else** — it has the current state of the project, what the last session did, what's in progress, and what to watch for. Don't rely on this CLAUDE.md alone or on assumptions from training data; the state file is the source of truth for "where are we."

At the **end of a session that changed anything real** (code, data, deploys, or a decision worth remembering), update `.claude/PROJECT_STATE.md` before finishing: move completed items out of "In progress," add anything new that's now in progress or blocked, and note the latest deployed commit. A session that only answered questions or did read-only investigation doesn't need to touch it.

## What this is

MetaTwin is a standalone product for MetaGlobe Technologies, at `metatwin.metaglobetechnologies.co.ke`. It's a student's verified digital twin: a living record of competencies, skills, projects, personality traits and coursework, matched to opportunities before the student graduates.

Same stack as `barbah-games-platform` (TanStack Start, Cloudflare Worker, Supabase, Resend) but **its own repo and its own Supabase project** — no data is shared between the two products.

v1 scope is **student-only**: students build/edit their own twin; evidence (course results, project artifacts) backs every competency claim; students control visibility. No employer portal, no university integrations, no BARBAH account linking in v1.

## Repo basics

- This is the **only** local clone of `metatwin` — never create a second one.
- Deploy with `npm run deploy` — **never** a raw `wrangler deploy` (it ships a Worker with no Supabase env vars bound).
- Use **npm** only (`npm ci`). Do not add a second lockfile.
- `npm run deploy` runs `scripts/check-grants.mjs` and `scripts/check-migrations-sync.mjs` as a `predeploy` step, carried over from `barbah-games-platform`'s hard-won guardrails — see those scripts' own comments for why. Do not bypass them.
- **Any column read from the browser needs an explicit `GRANT SELECT`** — Postgres denies an entire row if even one selected column lacks a grant, not just that column. See `barbah-games-platform`'s `public.gamers` outage for the cautionary tale this convention comes from. `check-grants.mjs` enforces this at deploy time.
- **`apply_migration` (the Supabase MCP tool) assigns its own version timestamp when it applies SQL directly to the live database — write (or rename) the local file to `<exact-version>_<exact-name>.sql` with the exact SQL that was applied, in the same commit.** `check-migrations-sync.mjs` enforces this at deploy time.
- Students are often minors or young adults: collect the minimum personal data, and require parental consent for under-18s (see the `twins` table's `parental_consent_at` column).
- Cloudflare access: Andrew's own account (logged in via `wrangler login` on 2026-10-10) is used to deploy and manage the custom domain/DNS on the `metaglobetechnologies.co.ke` zone. Tell him before any action that touches DNS or production.
