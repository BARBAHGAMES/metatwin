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

## Lovable design port (2026-10-11)

Andrew built a full MetaTwin design in Lovable (project `48ea735b-4de2-4b28-986c-6cb0cda09057`, https://lovable.dev/projects/48ea735b-4de2-4b28-986c-6cb0cda09057) — a much richer IA than our v1 scope: public profile with "AI employees," hire/connect/follow, connections/followers counts, a 5-step "Build Your MetaTwin" wizard, capability/project detail pages with reviewer quotes and iteration/journey timelines. Andrew's call when asked how far to take it: **"take the full lovable build and let's build on it"** — i.e. port the whole thing in, not just the design tokens.

**What was ported, in full, into this repo:**
- Design system: `src/styles.css` (oklch tokens — ink/electric/violet palette, Sora/Manrope/JetBrains Mono fonts, gradients, shadows), `components.json` (shadcn "new-york" style).
- The full shadcn/ui component set via its CLI (`npx shadcn@latest add ...`) rather than copying file-by-file — faster and guaranteed current. `button.tsx` had Lovable's custom `hero`/`heroOutline` variants re-added by hand (the CLI only installs vanilla shadcn). Removed `resizable.tsx` — unused anywhere, and its pinned `react-resizable-panels` version didn't match the installed v4 API; not worth fixing for a component nothing uses.
- Custom components: `AITeam.tsx`, `CareerGraph.tsx`, `Journey.tsx`, `ProfileMockup.tsx`, `site.tsx` (Header/Footer/Logo/Card/Section/PageHero/StatusBadge/SampleTag).
- All of Lovable's routes: `/`, `/about`, `/how-it-works`, `/journey`, `/capability/$slug`, `/projects`, `/projects/$id`, `/build`, `/profile` — ported close to verbatim. All of this content is explicit demo/mock data from `src/lib/data.ts` (fictional person "Victorious Kibaki", fictional projects/capabilities) — every page carries a "Prototype"/"Fictional sample data" label, same as Lovable had it.
- `/dashboard` **was replaced** by Lovable's richer (but still mock-data, local-React-state-only) version — this is a deliberate regression of real functionality (it no longer reads/writes the real `twins` table) in exchange for the much better UI; wiring it back to real data is the top priority below.

**Deliberate deviations from a literal Lovable copy:**
- `/login` and `/signup` don't exist in Lovable's build (it only has the fake `/build` wizard). Kept **our own real ones**, restyled to match the new design system, still calling real Supabase Auth (`src/lib/auth.tsx`, unchanged).
- The primary "Build Your MetaTwin" CTAs (header, homepage, how-it-works) now point to `/signup` (real account creation) instead of `/build` (Lovable's non-persisting demo wizard) — pointing new visitors at a dead-end demo felt wrong for a real product entry point. `/build` itself is still in the codebase and still reachable by direct link, unchanged.
- Victorious Kibaki's sample photo (`victorious-kibaki.jpg`) couldn't be fetched as a binary asset through the Lovable MCP's `read_file` (text-only). Replaced every use of it with `SampleAvatar` (a gradient initials badge, same pattern as `AITeam`'s avatars) in `ProfileMockup.tsx`, `profile.tsx`, and `index.tsx` — no visual asset dependency, and it's a more honest placeholder for a fictional person anyway.
- `Header` (`site.tsx`) is now auth-aware: shows "Log in" / "Log out" using the real `useAuth()` hook (Lovable's had no auth concept at all).
- Did not adopt Lovable's `vite.config.ts` (wraps a private `@lovable.dev/vite-tanstack-config` package, not meant for external deploys), stricter `tsconfig.json`, or test setup — kept ours, which already does the equivalent and is proven to build/deploy.

**Verified this session**: `npm run build` clean, `tsc --noEmit` clean, and all 12 routes (`/`, `/profile`, `/dashboard`, `/projects`, `/about`, `/how-it-works`, `/journey`, `/build`, `/login`, `/signup`, `/capability/3d-modelling`, `/projects/aqualoop-filter`) return 200 with real rendered content via `vite dev` smoke test. **Not yet deployed** — this is all pushed to `main` but the live site at metatwin.metaglobetechnologies.co.ke still has the pre-port bare-bones UI until `npm run deploy` runs again.

## In progress / next up

1. **Deploy this port** — `npm run deploy` (blocked by Claude Code's production-deploy guardrail same as before; ask Andrew to run it or explicitly request it in-session).
2. **Wire `/dashboard` to real data** — biggest gap from the port. Currently 100% Lovable mock state (capabilities count, "Add project/evidence/capability/milestone" dialogs that don't persist). Needs real reads/writes against `twins`/`competencies`/`courses`/`projects`/`assessments`, reusing the query pattern from the pre-port `dashboard.tsx` (now gone, but simple: `supabase.from("twins").select(...).eq("id", user.id)`).
3. **Wire `/profile`, `/capability/$slug`, `/projects`, `/projects/$id`, `/journey`** to real per-user data once there's a real public-profile concept (a route keyed by twin id/slug, visibility-gated per the `twins.visibility` RLS policies already in the schema) — currently these all show the same hardcoded "Victorious Kibaki" sample regardless of who's logged in.
4. **Decide on "AI employees," hire/connect/follow, connections/followers** — these are pure Lovable concepts with no backing schema or product decision yet. Andrew said "build on it," not necessarily "build these specific features" — surface this choice before investing in schema for any of them.
5. Configure Supabase Auth Custom SMTP (Resend) once able.
6. The parental-consent flow for under-18 students, and seeding `opportunities` — unchanged from before the design port.
