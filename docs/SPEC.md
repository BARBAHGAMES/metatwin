# MetaTwin — living spec

> What MetaTwin is, who it serves, what exists today, and the rules every change must follow.
> The build-out sequence lives in [`BUILD_PLAN.md`](BUILD_PLAN.md); decisions in [`DECISIONS.md`](DECISIONS.md);
> the per-session engineering log in [`../.claude/PROJECT_STATE.md`](../.claude/PROJECT_STATE.md).
> Last updated: 2026-10-14 (branch `feature/phase1-foundation-hardening`).

## 1. Product

CVs and LinkedIn are self-reported. MetaTwin replaces the CV with **proof of capability**. It serves university
students and builders who build solutions for businesses — or start businesses — using AI automation and AI agents as
their workforce. Each builder arrives with an AI workforce.

Three jobs, in order of dependency:

1. **Prove capability** — a profile is built from verifiable work (shipped projects, live workflows, usage, outcomes),
   not claims.
2. **Get discovered** — businesses and hirers can search and rank projects and builders.
3. **Sell and get hired** — builders list AI skills, workflows and agents; businesses buy or hire them.

**Product test for every feature:** does it make capability more *verifiable* or more *discoverable*? If not, flag it
before building it.

The site's own public promise (homepage): *"Transparent statuses, never a single score"* and *"Not everything is
verified — and MetaTwin never pretends it is."* Any scoring work must respect or explicitly revise this promise.

## 2. Users and account types

| Account | Status | How it's created | Notes |
|---|---|---|---|
| **Builder / student** (`twins`) | Live | `/signup` (email+password, 18+ declaration) or Google/GitHub OAuth | One `twins` row per user, created by `handle_new_user()`. Private by default. |
| **Reviewer** | Live | No account — single-use 14-day token link | Attests one evidence item (`evidence_reviews`). |
| **School admin** (`school_admins`) | Live (MKU pilot) | `/school/signup`, `@mku.ac.ke` only, manually verified | Sees CBE grades lecturers submit via Google Form → webhook. |
| **Platform admin** (`platform_admins`) | Live | Invite-only email allow-list, manually verified | Onboarding analytics, deactivate/reactivate profiles. |
| **Business / hirer** | **Not built** | — | Needed for Phase 3 (discovery) and Phase 4 (marketplace). |

## 3. What exists today (`main` at `38c60f7`; see PROJECT_STATE.md for what's deployed)

**Foundation (Phase 1) — built.**
Auth (email/password + Google + GitHub, password reset, 18+ gate); builder profile (`twins`: name, headline, bio,
institution/programme, city, photo, handle, visibility); onboarding wizard (`/build`); project submission
(`projects` with problem/solution, links, stage pipeline, iterations/pivots); public profile `/t/<handle>` (SSR,
`noindex`); teams; courses; dashboard with seven tabs.

**Proof layer (Phase 2) — partly built.**
`evidence` items (title/type/link/note) tied to a capability and optionally a project; reviewer attestation via token;
institution CBE grades (webhook, server-computed score); pitch-competition scores (webhook); GitHub activity via OAuth
(server-fetched contribution stats); AI employees with public GitHub repo stats. **Gaps:** no explicit verification
model (tiers) across these sources; several "measured" numbers are written by the browser and can be forged (see §5);
capability `level` is self-rated; no file attachments (links only).

**Discovery (Phase 3) — minimal.**
`/talent` directory (`list_public_twins()`), deterministic opportunity matching (`get_my_opportunity_matches()`),
AI chat over a public twin's data. **Gaps:** no project search/browse/filters, no business-side view, public pages are
`noindex`, and unpaid profiles are hidden from all public reads.

**Marketplace (Phase 4) — payments only.**
M-Pesa STK Push (Daraja **sandbox**) for MetaTwin's own subscription plans (individual + team); `payments` table.
**Gaps:** no listings, no hiring flow, no builder payouts, no card payments, production Daraja not live.

## 4. Architecture

- **App:** TanStack Start (React 19) on a Cloudflare Worker (`metatwin`), built with Vite/Nitro. Deploy only via
  `npm run deploy` (runs `check-grants`, `check-migrations-sync`, `check-content-drift` first).
- **Data/auth:** Supabase project `metatwin` (Postgres + Auth + Storage), region ap-south-1. Session is held
  client-side (localStorage); authenticated pages render after hydration.
- **Server routes** (`src/lib/*-route.server.ts`): webhooks (new user, grades, pitch scores, M-Pesa callback), GitHub
  proxy/connect, AI chat (Workers AI), M-Pesa initiate/status. Only these may use the service-role client.
- **Email:** Resend (welcome + admin notifications from the Worker; auth emails via Supabase Custom SMTP).

## 5. Security and data-integrity rules (non-negotiable)

1. **RLS on every table.** New tables start with no grants (default privileges are revoked) and must `GRANT`
   explicitly. Any column the browser selects needs a `GRANT SELECT` (`check-grants.mjs` enforces this).
2. **Anonymous reads only through narrow `SECURITY DEFINER` RPCs** that return a fixed, public-safe field set
   (`get_public_profile`, `list_public_twins`, `get_team_public_profile`, …). No `anon` table grants beyond reference
   data.
3. **The client never writes a column that carries money, access, moderation or verification.** Today enforced by
   guard triggers on `twins` (adult declaration, plan, activation), `competencies.evidence_count`, `projects.stage`,
   `school_admins`/`platform_admins` status; and by zero-grant tables (`payments`, `pitch_scores`, `project_grades`,
   `teams`, `team_members`, `github_connections`).
   Since 0.5 (2026-10-15) the server-fetched proof numbers (`projects.interviews_count`/`pitch_scores`, `github_repos`,
   `ai_employees.github_*`) are written only by authenticated, ownership-checked server routes. **Limits that remain**
   (Build Plan 2.1a): a synced GitHub repo isn't yet proven to be the builder's, and sheet-based counts come from a
   sheet the student controls.
4. **Server routes that act on a user's behalf verify the caller's Supabase access token** and check ownership before
   any side effect (e.g. before an STK push).
5. **Untrusted URLs:** http(s)-only CHECK constraints; rendered via `safeHref`; server-side fetches are host-restricted
   (no open SSRF proxy).
6. **Security regression suite** (`supabase/tests/security_regression.sql`) must pass after any schema change — run on
   a local or dev database, **never on production**.
7. **Minimum personal data.** 18+ only; birth year, not full DOB. Email lives only in `auth.users`.

## 6. Non-functional

- **Mobile-first**, East African connections. Supported widths: 320px and up; layouts verified at 320/360/768/1280px
  (no horizontal overflow; tap targets >= 32px for standalone controls; form fields >= 16px on touch devices so iOS
  doesn't zoom). Root font size steps 17px (phones) / 18px (tablets) / 19px (desktop). Hero photos ship an 800px
  variant via `srcset` (~30 KB vs ~90 KB on phones). Ambient hero animations are off below 640px. Largest JS chunk
  ~101 KB gzipped; the shared `site` chunk is ~72 KB gzipped (mostly supabase-js, incl. unused realtime).
- **Layout rules that prevent clipped content** (`src/styles.css`): `.grid` defaults to `minmax(0, 1fr)` columns and
  body text uses `overflow-wrap: anywhere`. `html { overflow-x: clip }` stays as a safety net, but anything it clips
  is invisible, so new layouts must not rely on it.
- **Honesty:** fictional sample data is always labelled; unbuilt features are labelled "Preview"/"Coming soon".
