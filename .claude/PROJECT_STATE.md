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
- Supabase project `metatwin` created; full v1 schema applied as 5 migrations (see `supabase/migrations/`):
  - `20261010192358_initial_schema_rls_grants.sql` — the 8 core tables (`twins`, `skills`, `competencies`, `courses`, `projects`, `assessments`, `opportunities`, `matches`), RLS policies, and grants.
  - `20261010192411_introspect_public_column_grants_fn.sql`, `20261010192421_introspect_applied_migrations_fn.sql` — backing RPCs for the two predeploy guardrail scripts.
  - `20261010192431_handle_new_user_trigger.sql` — auto-creates a blank `twins` row on signup.
  - `20261010192551_lock_down_handle_new_user_fn.sql` — fixes a `get_advisors(security)` finding (the trigger function was publicly RPC-callable; revoked). **`get_advisors(security)` is clean as of this session.**
- App skeleton: `/`, `/login`, `/signup`, `/dashboard` (reads/writes the signed-in student's own `twins` row — proves the auth + RLS path end to end). `src/lib/auth.tsx` wraps Supabase Auth (signIn/signUp/signOut/resetPassword).
- Welcome email path: `src/lib/new-user-webhook-route.server.ts` (Worker route at `/api/webhooks/new-user`) sends a welcome email via Resend's direct API when Supabase's `auth.users` Database Webhook fires on INSERT. **Not wired up yet** — needs the webhook configured in the Supabase dashboard once `SUPABASE_WEBHOOK_SECRET` is set.
- Verification email: intentionally left as Supabase Auth's own built-in "Confirm signup" flow, meant to be sent through Custom SMTP configured in the Supabase dashboard with Resend's SMTP credentials — **not configured yet**, blocked on the Resend domain below.
- `.env` has real `SUPABASE_URL` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` filled in. `SUPABASE_SERVICE_ROLE_KEY` is blank — MCP tools never expose it; copy it from the Supabase dashboard (Project Settings → API) into `.env` to run `check-grants`/`check-migrations-sync` locally.

## Blocked

1. **Supabase Auth Custom SMTP not configured yet** — no MCP tool exposes Auth SMTP settings; needs to be done by hand in the Supabase dashboard (Authentication → Settings → SMTP), using Resend's SMTP credentials for `metaglobetechnologies.co.ke`.
2. **`SUPABASE_SERVICE_ROLE_KEY` still blank** — not set as a `wrangler secret` yet, so the deployed Worker's `supabaseAdmin` paths (the new-user webhook) will throw until Andrew pastes it into `.env` and it gets set as a secret.

## In progress / next up

- `npm install`, `npm run typecheck`, `npm run build` all verified passing this session (see "Done this session").
- First deploy + custom domain **blocked by Claude Code's own auto-mode safety classifier** ("Production Deploy") — `npm run deploy` needs to be run by Andrew directly from his machine (secrets/env already in place; see `.env`). Did not attempt to route around this.
- **Design**: Andrew is having Lovable produce the look & feel (design system / mockups) — explicitly NOT replacing this app. Claude implements that design into this repo's existing TanStack Start routes/components once Andrew shares Lovable's output; the Supabase schema, auth, and deploy pipeline built this session stay as-is.
- Configure Supabase Auth Custom SMTP (Resend) once able.
- Configure the `auth.users` INSERT Database Webhook in the Supabase dashboard pointing at `/api/webhooks/new-user`, once `SUPABASE_SERVICE_ROLE_KEY` is set.
- Product work beyond the scaffold: UI for `skills`/`competencies`/`courses`/`projects`/`assessments` (dashboard currently only covers the `twins` profile row), the parental-consent flow for under-18 students, and seeding `opportunities`.
