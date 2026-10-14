# Decision log

> One entry per decision that shapes the product or the codebase. Newest last. Status: **Accepted**, **Proposed**
> (awaiting owner), or **Superseded by D-xxx**. Earlier decisions are recorded in detail in
> `.claude/PROJECT_STATE.md`; the ones below are the load-bearing ones, restated so they're findable.

### D-001 · `twins` is the builder profile model — Accepted (2026-10-11, restated 2026-10-14)
One row per user in `public.twins`, created by `handle_new_user()` at signup. No parallel `profiles` table. Student-only
fields stay nullable so non-student builders fit the same table.

### D-002 · Auth: email/password + Google + GitHub — Accepted (2026-10-11)
OAuth providers are additive, not replacements. GitHub identity is also the basis for system-verified GitHub activity
(Phase 2). Phone/SMS OTP not adopted (cost).

### D-003 · Public reads only through narrow `SECURITY DEFINER` functions — Accepted (2026-10-11)
No `anon` table grants beyond reference data (`skills`, `kenya_cities`, `universities`). Each public function returns a
fixed field set and hides unknown, private, non-adult, inactive and unpaid profiles alike (no existence oracle).

### D-004 · The client never writes money/access/moderation/verification columns — Accepted (2026-10-14)
Enforced by guard triggers (writes as `authenticated`/`anon` are silently reset) or by zero-grant tables written only
by server routes / `SECURITY DEFINER` functions. Applied to `twins.plan_*`, `is_active`, `deactivated_at` in migration
`20261014200000` after they were found client-writable. Remaining violations are tracked as Build Plan 0.5.

### D-005 · Client may not insert or delete `twins` rows — Accepted (2026-10-14)
Rows are created only by `handle_new_user()`. Revoking DELETE closes a delete-and-recreate deactivation bypass.
Consequence: account deletion must be a server route (Build Plan 1.2).

### D-006 · Feature branches; no pushes to `main`; no deploys without approval — Accepted (2026-10-14)
Supersedes the earlier practice of committing and deploying straight from `main`. To be enforced with a GitHub
ruleset (see `docs/REPO_SECURITY.md`).

### D-007 · Never test against production — Accepted (2026-10-14)
After the 2026-10-14 incident (a verification script wiped production projects/evidence), the security suite and
migration rehearsals run on a local Postgres harness (PGlite + Supabase stubs) or a dev database. Production gets only
approved, already-proven migrations.

### D-008 · Repo security baseline — Accepted (2026-10-14)
gitleaks full-history scan + `npm audit` in CI, SHA-pinned actions, Dependabot, hardened `.gitignore`, `SECURITY.md`.
Uses the gitleaks CLI (not the action, which needs a paid licence for org repos).

### D-009 · Docs layout — Accepted (2026-10-14, with the plan)
`docs/SPEC.md` (what it is / what exists), `docs/BUILD_PLAN.md` (what's next), `docs/DECISIONS.md` (this file),
`docs/REPO_SECURITY.md` (owner checklist), `docs/LOCAL_SESSION_RUNBOOK.md` (Stage 0 hand-off). `.claude/PROJECT_STATE.md`
stays as the per-session engineering log.

### D-010 · Build plan approved; Stage 0 continues in a local Claude Code session — Accepted (2026-10-14)
Andrew approved `docs/BUILD_PLAN.md` and gave permission to complete Stage 0 using database and tool access. The
cloud session has neither, so it built everything that can be verified offline (0.1 migration, 0.2 repo security,
0.6 DB test harness) and hands off to a local session via `docs/LOCAL_SESSION_RUNBOOK.md`. The local session may apply
migration 0.1 and run read-only production queries; merges, deploys, key rotation and other migrations still need
Andrew's in-session OK.

### D-011 · Local DB test harness in the repo and CI — Accepted (2026-10-14)
`npm run test:db` / `npm run db:audit` (PGlite, Postgres 17 in WASM, with Supabase stubs). Dev dependency
`@electric-sql/pglite` pinned to 0.3.16. Production may run a different Postgres major version; the harness is a
safety net, not a replacement for a dev database (Build Plan 0.7).

## Pending owner decisions
See the "Open decisions" list at the end of `docs/BUILD_PLAN.md`.
