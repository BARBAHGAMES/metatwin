# Deploy runbook — branch `claude/p1-5-public-profile`

For a **local desktop Claude Code session** in the `metatwin` folder (where `wrangler login` is active).
Andrew has explicitly asked for this deploy to go to production. Read `.claude/PROJECT_STATE.md` first.

## What is already live vs. what this deploy ships

The **database is already live** (all migrations applied and verified against the production Supabase project
`yxfclmareqiykgixklbp`). This deploy ships the **app code** that goes with them:

- P0-2: 18+ signup form (birth year + confirmation) and the "confirm your year of birth" gate for existing accounts
- P0-3: http(s)-only links in forms and safe link rendering
- P0-4: welcome-email Worker route (escaped HTML, constant-time auth, new copy)
- P1-5: public profile page `/t/<handle>`, dashboard "Public profile" panel
- P1-6: preview labels; P1-7: load-error states, `/reset-password`, field limits, password min 8

Until it ships, existing accounts keep working (the old UI doesn't send the new fields), but new signups skip
the age step and land on the gate screen.

## Steps

1. `git fetch origin && git checkout claude/p1-5-public-profile && git pull`
2. Ensure `.env` has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY` (Worker secrets `RESEND_API_KEY`, `SUPABASE_WEBHOOK_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY` already exist on Cloudflare and survive deploys).
3. `npm ci`
4. Local gate: `npx tsc --noEmit -p tsconfig.json` (must pass) and `npx vitest run` (54 tests must pass).
   `npx eslint src` has ONE known pre-existing error (`person` unused in `src/routes/index.tsx`) — not part of this deploy.
5. Tell Andrew you are about to touch production, then: `npm run deploy`
   - Never a raw `wrangler deploy`. Do not bypass `check-grants` / `check-migrations-sync`; if either fails,
     show Andrew the output and stop.
   - All six migrations after `20261011061431` were registered in `supabase_migrations.schema_migrations` by hand
     with exact versions, so `check-migrations-sync` should pass.
6. Smoke test on https://metatwin.metaglobetechnologies.co.ke (all must pass; report results honestly):
   - `/` loads 200 with security headers.
   - `/signup` shows "Year of birth" + the 18+ checkbox; birth year 2015 shows the 18+ message and sends no request.
   - Logging in with Andrew's existing account shows the "One quick step" year-of-birth screen before the dashboard.
   - Dashboard: add a capability; add evidence with an `https://` link (works); `javascript:alert(1)` link is rejected.
   - Profile → Public profile: set a handle, tick public, save; `/t/<handle>` opens in a private window with name,
     capabilities, projects, and NO link/note unless "show links" was ticked; untick public → `/t/<handle>` shows
     "This MetaTwin isn't available" (HTTP 404).
   - `/login` → "Forgot password?" → `/reset-password` sends a reset email (see manual steps below first).
   - A marketing page (`/about`) still shows the "fictional demonstration data" footer; `/t/*` and `/dashboard` do not.
   - Welcome email: confirming a new account sends exactly one welcome email (an unconfirmed signup sends none).
7. Update `.claude/PROJECT_STATE.md` with the deployed commit and Worker version
   (`npx wrangler deployments list --name metatwin`), commit and push.

## Manual Supabase dashboard steps (Andrew, one minute each)

- Authentication → URL Configuration → Redirect URLs: add
  `https://metatwin.metaglobetechnologies.co.ke/reset-password`.
- Authentication → Sign In / Providers → Email: set minimum password length to 8.

## Rollback

Worker: `npx wrangler rollback --name metatwin` (previous version). The database changes are additive/safe with the old
UI, so no DB rollback is needed.
