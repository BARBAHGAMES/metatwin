# Project State

> Read this first. Updated at the end of each session that changes anything real. See `CLAUDE.md` for the rule.

## Decisions locked in (2026-10-10)

- **v1 scope: student-only.** No employer portal, university integrations, automated credential verification, or BARBAH account linking in v1.
- **Auth: MetaTwin has its own, fully separate Supabase Auth** — no shared user base with BARBAH.
- **Supabase project**: `metatwin` (id `yxfclmareqiykgixklbp`), org `kqtcxuppoddunjbfpmzv` (barbahgamesfounder's Org), region `ap-south-1` (Mumbai — the nearest available Supabase region to Nairobi; Supabase has no African region), **Free plan** ($0/mo). Caveat: free projects auto-pause after 7 days with no activity — upgrade to Pro before relying on this for real users.
- **App domain / mail domain: `metaglobetechnologies.co.ke`** — NOT `metaglobe.co.ke` (that was this session's wrong assumption, corrected by Andrew; there is no separate `metaglobe.co.ke` zone in play here). The app lives at `metatwin.metaglobetechnologies.co.ke`; mail sends from `hello@metaglobetechnologies.co.ke`, reusing the domain already verified in Resend (the originally-planned dedicated domain hit the account's 3/3 Resend domain cap).
- **Cloudflare access**: Andrew ran `wrangler login` himself on 2026-10-10 (OAuth, full account access on the "Barbah Games" Cloudflare account — broader than the scoped-token plan originally discussed, but his explicit choice). Claude runs deploys and manages the custom domain/DNS directly through this login — but always says what it's about to do first, every time, before touching DNS or production.
- **GitHub**: repo created under the `BARBAHGAMES` org (matches where `barbah-games-platform` lives), private.

## Done this session

- Local repo at `C:\Users\14048\OneDrive\Desktop\metatwin`, scaffolded as a TanStack Start + Cloudflare Worker app (same conventions as `barbah-games-platform`: `npm run deploy` only, `check-grants.mjs` / `check-migrations-sync.mjs` as predeploy guardrails, table-wide `GRANT SELECT` convention, `<version>_<name>.sql` migration files written to match exactly what `apply_migration` applied).
- Supabase project `metatwin` created; full v1 schema + webhook trigger applied as 7 migrations (see `supabase/migrations/`):
  - `20261010192358_initial_schema_rls_grants.sql` — the 8 core tables (`twins`, `skills`, `competencies`, `courses`, `projects`, `assessments`, `opportunities`, `matches`), RLS policies, and grants.
  - `20261010192411_introspect_public_column_grants_fn.sql`, `20261010192421_introspect_applied_migrations_fn.sql` — backing RPCs for the two predeploy guardrail scripts.
  - `20261010192431_handle_new_user_trigger.sql` — auto-creates a blank `twins` row on signup.
  - `20261010192551_lock_down_handle_new_user_fn.sql` — fixes a `get_advisors(security)` finding (the trigger function was publicly RPC-callable; revoked).
  - `20261010200653_new_user_webhook_trigger.sql` — `auth.users` AFTER INSERT trigger that calls `/api/webhooks/new-user` via `pg_net`, replacing the manual Database Webhook dashboard step. The bearer secret is NOT in this file — it's in Supabase Vault (`vault.create_secret`, run once directly against the live DB via `execute_sql`, name `metatwin_webhook_secret`), looked up by name at call time.
  - `20261010204801_move_pg_net_out_of_public.sql` — fixes a second `get_advisors(security)` finding (pg_net landed in `public`; moved to `extensions`).
  - **`get_advisors(security)` is clean as of this session.**
- App skeleton: `/`, `/login`, `/signup`, `/dashboard` (reads/writes the signed-in student's own `twins` row — proves the auth + RLS path end to end). `src/lib/auth.tsx` wraps Supabase Auth (signIn/signUp/signOut/resetPassword).
- **Welcome email: fully wired and verified live.** Signup → `auth.users` trigger → `pg_net` POST to `/api/webhooks/new-user` → `src/lib/new-user-webhook-route.server.ts` → Resend. Tested end-to-end against the deployed Worker (`delivered@resend.dev`) and confirmed `status: delivered` via Resend's own email log.
- Verification email: intentionally left as Supabase Auth's own built-in "Confirm signup" flow, meant to be sent through Custom SMTP configured in the Supabase dashboard with Resend's SMTP credentials — **not configured yet** (see Blocked).
- `.env` fully filled in: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `SUPABASE_WEBHOOK_SECRET`. Andrew pasted the service_role key from the dashboard directly into chat; not repeated back to him anywhere in responses.

## Deployed (2026-10-10)

**MetaTwin is live** at https://metatwin.metaglobetechnologies.co.ke — verified `200 OK` with the expected security headers. First deploy was blocked by Claude Code's own auto-mode safety classifier ("Production Deploy") on an unattended attempt; ran clean once Andrew explicitly asked for it in the same turn. Custom domain + SSL cert were created automatically by Cloudflare on deploy. Current Worker version: `fb1013eb-02d3-444c-9aa5-76b642e94b34` (secrets added after may have bumped this — check `wrangler deployments list` for the latest).

Secrets set on the live Worker (`wrangler secret put`, piped from a temp file, never echoed): `RESEND_API_KEY` (scoped sending-only, restricted to the `metaglobetechnologies.co.ke` domain in Resend), `SUPABASE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.

## Blocked

1. **Supabase Auth Custom SMTP not configured yet** — no MCP tool exposes Auth SMTP settings; needs to be done by hand in the Supabase dashboard (Authentication → Settings → SMTP), using Resend's SMTP credentials for `metaglobetechnologies.co.ke`. Until then, "Confirm signup" emails send from Supabase's own shared mail infra, not Resend.

## In progress / next up

- **Design**: Andrew is having Lovable produce the look & feel (design system / mockups) — explicitly NOT replacing this app. Claude implements that design into this repo's existing TanStack Start routes/components once Andrew shares Lovable's output; the Supabase schema, auth, and deploy pipeline stay as-is.
- Configure Supabase Auth Custom SMTP (Resend) once able.
- Product work beyond the scaffold: UI for `skills`/`competencies`/`courses`/`projects`/`assessments` (dashboard currently only covers the `twins` profile row), the parental-consent flow for under-18 students, and seeding `opportunities`.
