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

**Verified this session**: `npm run build` clean, `tsc --noEmit` clean, and all 12 routes (`/`, `/profile`, `/dashboard`, `/projects`, `/about`, `/how-it-works`, `/journey`, `/build`, `/login`, `/signup`, `/capability/3d-modelling`, `/projects/aqualoop-filter`) return 200 with real rendered content via `vite dev` smoke test.

**Deployed and verified live** — Andrew asked for the deploy explicitly (same production-deploy guardrail as before, ran clean on his direct request). `metatwin.metaglobetechnologies.co.ke` confirmed serving the new design (`<title>MetaTwin — The Future of the CV</title>`, "Victorious Kibaki" on `/profile`). Version `2ec12b2e-c2e0-4d41-a115-8a0e2e371a68`.

## Dashboard wired to real data (2026-10-10, later same session)

`/dashboard` no longer uses Lovable's mock state — rewritten against the real schema:
- Reads the signed-in user's `twins` row, their `competencies` (joined to `skills.name`), and their `projects` on load; redirects to `/login` if not authenticated.
- "Add a project" → real insert into `projects`. "Add a capability" → real insert into `competencies` (skill picked from the seeded `skills` list — users can't invent new skills client-side, matching the RLS/grants design). "Add evidence" → increments the chosen competency's `evidence_count` (no generic evidence/attachment table exists yet, so this is the honest real mapping, not a fabricated one — see item 2 below).
- Dropped the "Record a milestone" and "View feedback" demo actions (no backing table for either); replaced the milestones card with a real "Recent activity" feed derived from `competencies.updated_at` / `projects.created_at`.
- `competencyStatus()` derives self/evidence (no "reviewed" — there's no reviewer/review concept in the schema yet).
- Added a profile editor (name/headline/institution/programme/year/visibility) writing to `twins` via upsert — same pattern the pre-port dashboard used.
- New migration `20261010212116_seed_skills.sql` seeds 8 starter skills (matching the ported design's taxonomy) so the "Add a capability" dropdown has real options.

**Verified against the live Supabase project** (not just typecheck/build): created a disposable confirmed test auth user via the admin API, signed in with the plain publishable-key client (real RLS, not service-role), and ran every query/insert/update the dashboard performs — twin read/upsert, skills read, competency insert + evidence-count update, project insert, and the joined read-back — all succeeded; a cross-user read by a bogus id correctly returned null with no error. Test user and all cascaded rows deleted afterward.

**Found and fixed a real bug during testing**: on `/login` and `/signup`, the white card's input text was inheriting the dark page wrapper's light `text-ink-foreground` color, making typed text essentially invisible (white-on-white). Fixed by adding `text-foreground` to those Cards. Caught via actual browser screenshots before Chrome automation started failing with an unrelated `chrome-extension://` conflict (looked like interference from another installed extension) — switched to scripted verification against Supabase directly for the rest, which is arguably the more reliable check for data-layer correctness anyway.

## In progress / next up

1. **Wire `/profile`, `/capability/$slug`, `/projects`, `/projects/$id`, `/journey`** to real per-user data once there's a real public-profile concept (a route keyed by twin id/slug, visibility-gated per the `twins.visibility` RLS policies already in the schema) — currently these all show the same hardcoded "Victorious Kibaki" sample regardless of who's logged in.
2. **No generic evidence/attachment table exists** — "evidence" is currently just `competencies.evidence_count`, a counter with no title/file/link per item. Lovable's design implies real evidence items (title, type, link, note) like the mock `capabilities[].evidence[]` shape. Worth a real `evidence` table before this goes much further.
3. **Decide on "AI employees," hire/connect/follow, connections/followers** — these are pure Lovable concepts with no backing schema or product decision yet. Andrew said "build on it," not necessarily "build these specific features" — surface this choice before investing in schema for any of them.
4. Configure Supabase Auth Custom SMTP (Resend) once able.
5. The parental-consent flow for under-18 students, and seeding `opportunities` — unchanged from before the design port.
6. ~~Not yet redeployed~~ — deployed and verified live (Andrew asked explicitly again). Version `567797fa-ae8f-4506-ad8f-b16d002a63e4`. Confirmed the `/login` text-contrast fix is actually in the served HTML, `/` and `/dashboard` both 200.
