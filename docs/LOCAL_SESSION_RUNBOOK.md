# Local Claude Code session — runbook to finish Stage 0

> For a **Claude Code session on Andrew's machine**, in the existing clone
> (`C:\Users\14048\OneDrive\Desktop\metatwin` — the only clone; never make a second one), with the Supabase MCP,
> `wrangler login` and git push access. Written 2026-10-14 by the cloud session that built
> `feature/phase1-foundation-hardening` (it had no database or push access).
> Read first: `CLAUDE.md`, `docs/BUILD_PLAN.md`, `docs/DECISIONS.md`, the last entry of `.claude/PROJECT_STATE.md`.

## Authority and limits

Andrew approved the build plan on 2026-10-14 and gave permission to complete Stage 0 using database and tool access.
Within that permission:

- **Go ahead without asking again:** import the branch, run local checks, push the *feature branch*, open the PR, run
  the read-only production queries below, apply migration 0.1 (announce it first), rename/commit the migration file.
- **Announce in one line before every production action** (CLAUDE.md rule), then do it. If any check fails or
  anything differs from what this runbook expects, **stop and report** — don't work around a guardrail.
- **Ask Andrew in-session first:** merging to `main`; any Worker deploy; key rotation; repo visibility/settings
  changes; applying any migration other than 0.1; modifying or deleting any production row.
- **Never:** push to `main`; run `security_regression.sql` or any write/test script against production (D-007 —
  it runs in CI via `npm run test:db`); destructive SQL on production; echo or paste secrets; `prettier --write` on
  existing files.

## Step 0 — Import the branch and run the local gate

```bash
git status                      # must be clean apart from Andrew's untracked "src/website pages/" (leave it).
                                # Anything else uncommitted: STOP and ask Andrew.
git fetch origin
git log -1 --format=%h origin/main   # expected 38c60f7 (or later — see below)
git fetch "<path-to>/metatwin-phase1-hardening.bundle" feature/phase1-foundation-hardening:feature/phase1-foundation-hardening
git checkout feature/phase1-foundation-hardening
```

If `origin/main` has moved past `38c60f7`: `git rebase origin/main`. If main gained a migration with a version newer
than `20261015171820`, rename ours (file + every reference in docs) to a later version before continuing.

Local gate — all must pass, report actual output:

```bash
npm ci
npm run build && npm run typecheck && npm run lint && npm test
npm run test:db        # expect: applied 95 migrations / PASS security_regression.sql / PASS admin_paths.local.sql
npm run db:audit       # expect: every public table has RLS enabled
npm run check-content-drift && npm run check-grants
```

Then: `git push -u origin feature/phase1-foundation-hardening` and open a PR (do not merge). CI must go green on both
jobs, `secret-scan` and `check`.

## Step 1 — Read-only checks on production (Supabase MCP `execute_sql`, SELECT only)

**Q1 — is the hole live?** Expected before the fix: `true, true, true, false`.
```sql
select has_table_privilege('authenticated', 'public.twins', 'UPDATE') as can_update,
       has_table_privilege('authenticated', 'public.twins', 'DELETE') as can_delete,
       has_table_privilege('authenticated', 'public.twins', 'INSERT') as can_insert,
       position('plan_status' in pg_get_functiondef('public.guard_twin_protected_columns'::regproc)) > 0 as guard_covers_plan;
```

**Q2 — drift check.** `select pg_get_functiondef('public.guard_twin_protected_columns'::regproc);` must match the
version in `20261011062032_adult_gate_18_plus_protected_twin_columns.sql` (pins only `is_adult`, `birth_year`,
`parental_consent_at`). If production has anything else in it, **STOP**: migration 0.1 replaces the function and
would drop it.

**Q3 — has anyone used the hole?** Report the results to Andrew. Change nothing; he decides what to do with any rows.
```sql
-- paid with no successful payment
select t.id, t.plan_status, t.plan_tier, t.plan_paid_until, t.created_at
from public.twins t
where t.plan_status = 'paid'
  and not exists (select 1 from public.payments p where p.twin_id = t.id and p.status = 'success');

-- a tier above basic that no successful payment bought
select t.id, t.plan_tier
from public.twins t
where t.plan_tier <> 'basic'
  and not exists (select 1 from public.payments p where p.twin_id = t.id and p.status = 'success' and p.plan_tier = t.plan_tier);

-- 'grandfathered' on an account created after the paywall shipped (only the migration set that value)
select id, created_at from public.twins where plan_status = 'grandfathered' and created_at > '2026-10-14 07:23:01+00';

-- half-reverted deactivation (an admin reactivation clears both columns; a full self-revert is indistinguishable)
select id, is_active, deactivated_at from public.twins where is_active and deactivated_at is not null;
```

## Step 2 — Apply migration 0.1 (approved)

1. Announce: "Applying migration guard_twin_plan_and_activation_columns to production."
2. `apply_migration` with name `guard_twin_plan_and_activation_columns` and the **exact** contents of
   `supabase/migrations/20261015171820_guard_twin_plan_and_activation_columns.sql`.
   (If the MCP tool errors, use the SQL editor, then register the version by hand in
   `supabase_migrations.schema_migrations` — existing practice, see PROJECT_STATE.md.)
3. Read back the version it assigned (`select version, name from supabase_migrations.schema_migrations order by version desc limit 3;`)
   and `git mv` the file to `<exact-version>_guard_twin_plan_and_activation_columns.sql`. Update the references in
   `docs/` and `.claude/PROJECT_STATE.md`. Run `npm run test:db` again. Commit, push.
4. Verify read-only: **Q1 must now return `true, false, false, true`.** Run `get_advisors(security)`; it should match
   the known baseline (the six intentionally anon-callable functions and leaked-password protection). Run
   `npm run check-migrations-sync` → clean.
5. **No Worker deploy is needed for this branch.** Nothing under `src/` changed; the fix takes effect when the
   migration is applied.

## Step 3 — Merge

With CI green and Step 2 verified, ask Andrew to merge the PR (or merge with his explicit OK). Then update
`.claude/PROJECT_STATE.md`: migration applied (exact version), Q1/Q3 results, PR link.

## Step 4 — Owner settings and secret rotation (with Andrew)

Walk through `docs/REPO_SECURITY.md`. Andrew does the GitHub UI steps; with his OK per item, the `gh` CLI can do some
of them. Order: make the repo private (Andrew to decide) → add the `main` ruleset requiring `check` + `secret-scan` →
turn on secret scanning/push protection and Dependabot alerts → review org members and 2FA.

**Service-role key rotation — plan before acting, and get Andrew's go-ahead for the production changes.**
- Where the key is used: Worker secret `SUPABASE_SERVICE_ROLE_KEY`, and the local `.env` (used by `check-grants` /
  `check-migrations-sync`). Database webhooks use the Vault secret `metatwin_webhook_secret`, not this key.
- First find out which key types the project uses (Supabase dashboard → Settings → API Keys: legacy JWT
  `anon`/`service_role` vs new `sb_publishable_…`/`sb_secret_…`), and whether `VITE_SUPABASE_PUBLISHABLE_KEY` is the
  legacy anon JWT.
- **Do not rotate the legacy JWT secret blindly.** It also changes the anon key that ships in the browser bundle and
  signs every user out. Preferred route: create a new secret key, switch the Worker secret to it
  (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config .output/server/wrangler.json`, piped from a temp file
  that is deleted afterwards, never echoed), update `.env`, deploy with `npm run deploy`, confirm the M-Pesa status
  route and the admin dashboard still work. Only then disable or revoke the leaked key, making sure the publishable
  key the app uses keeps working.

## Step 5 — Build item 0.5: server-only "measured" proof numbers

Same workflow as 0.1: feature branch `feature/stage0-5-server-proof-numbers` off updated `main`; test red→green with
`npm run test:db`; local gate; PR. **Then show Andrew the plan for applying and deploying it, and get a "go" before
touching production**: it's new code he hasn't reviewed.

**Problem.** The server fetches these values, but the browser writes them under its own RLS session, so a student can
forge them through the API:
- `projects.interviews_count`, `interviews_synced_at` (they advance the project stage through `recompute_project_stage`)
- `projects.pitch_scores`, `scores_synced_at`
- `github_repos.*` stats
- `ai_employees.github_full_name/stars/forks/open_issues/synced_at`

Current client writers: `ProjectExtras.tsx` (~L80 GitHub repo, ~L502 pitch feedback, ~L594 interviews) and
`src/lib/ai-employees.ts` (~L77).

**Design.**
1. **Server writes.** The sync routes (`pitch-feedback-sync-route.server.ts`, `github-sync-route.server.ts`, or a single
   new `/api/proof/sync`) take `{ kind, id, url }`. They authenticate the caller with the existing `authenticateTwin`
   bearer-token pattern (`github-connect-route.server.ts`), load the row with `supabaseAdmin`, check
   `row.twin_id === caller`, fetch and summarize as today (keep the `docs.google.com` / github.com host allow-lists,
   timeouts and size caps), and write the URL and derived values together with `supabaseAdmin`. Return the new values.
   The client keeps calling `recompute_project_stage` afterwards (it reads the counts server-side).
2. **Migration — guard on `projects`** (extend `guard_project_stage` or add a new guard). Writes made as
   `authenticated`/`anon` cannot change `interviews_count`, `interviews_synced_at`, `pitch_scores` or
   `scores_synced_at`. If a client changes `interviews_csv_url` or `scores_csv_url`, reset the matching derived values
   (`0` / `'{}'` / `null`): a changed source invalidates the old number.
3. **Migration — `github_repos`.** Revoke `insert, update` from `authenticated` (keep `select, delete`); only the server
   route upserts.
4. **Migration — `ai_employees`.** Guard trigger pins the `github_*` columns for client writes; reset them when
   `link_url` changes.
5. **Tests.** A new `security_regression.sql` section: the client can't write any pinned column; changing a source URL
   resets the derived values; `github_repos` client insert/update is denied; the owner can still edit name, role and
   links. Plus vitest cases for the route's ownership and validation logic (follow `mpesa-route.server.test.ts`).
6. **Rollout order: deploy the Worker first, then apply the migration.** The new routes work before and after the
   migration; the old client writes would be silently reset once the migration is in.
7. **Post-deploy check, without test scripts against production:** Andrew syncs a sheet on his own real project in
   the normal UI and confirms the count updates. Then read-only: `has_table_privilege('authenticated', 'public.github_repos', 'UPDATE')`
   should be `false`.

## Step 6 — Record

Update `docs/BUILD_PLAN.md` statuses, `docs/DECISIONS.md` (anything new), `docs/SPEC.md` §5 "known open violations",
and `.claude/PROJECT_STATE.md` (what was applied/deployed, exact versions, Worker version). Report to Andrew: what
changed, files touched, what was verified (actual output), what's left, and any decision needed.
