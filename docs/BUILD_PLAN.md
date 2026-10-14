# MetaTwin — build plan

> How we get from what's live today to the four-phase product in [`SPEC.md`](SPEC.md). Steps are ordered by dependency
> and risk; no dates. Each stage ends with exit criteria, and **each phase needs the owner's go-ahead before it
> starts**. Items marked **[decision]** need an owner call before building; **[approval]** means a migration, auth,
> payments or production change that must be approved when it's ready.

## How every item is built

1. Feature branch off `main` → small, scoped commits → PR. Never push to `main`; never deploy without approval.
2. Schema changes: migration file + a new section in `supabase/tests/security_regression.sql`, proven red→green on a
   local database before anyone applies it anywhere.
3. Before "done": `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
   `npm run check-content-drift`, plus the security suite — actual output reported.
4. Update `docs/SPEC.md`, `docs/DECISIONS.md`, `.claude/PROJECT_STATE.md`.

---

## Stage 0 — Patch up tight (security and integrity) · *in progress*

Must be finished before new features, because the product's value **is** trustworthy proof.

| # | Item | Status |
|---|---|---|
| 0.1 | **Close the `twins` hole** — students could self-grant a paid plan or undo a deactivation (UPDATE), or delete and recreate their row (DELETE+INSERT). Migration `20261014200000_guard_twin_plan_and_activation_columns`; 11 new regression assertions. | Done on branch; **[approval]** apply + deploy |
| 0.2 | **Repo security** — gitleaks full-history scan in CI, `npm audit` in CI, SHA-pinned actions, Dependabot, hardened `.gitignore`, `SECURITY.md`. | Done on branch |
| 0.3 | **Owner GitHub settings** — `main` ruleset (PR + green CI required, no force push), secret scanning + push protection, 2FA, access review. Checklist: [`REPO_SECURITY.md`](REPO_SECURITY.md). | Owner action |
| 0.4 | **Rotate the Supabase service-role key** (was pasted into chat on 2026-10-10). | Owner action **[approval]** |
| 0.5 | **Server-only "measured" proof numbers** — `projects.interviews_count`/`interviews_synced_at` (they advance project stage), `projects.pitch_scores`/`scores_synced_at`, `github_repos` stats, `ai_employees.github_*`. The sync routes write them with the service role after checking the caller owns the row; a guard trigger stops browser writes. | Planned **[approval]** |
| 0.6 | **Run the security suite in CI** — add the local Postgres harness used today (PGlite + Supabase stubs, all migrations in order) to the repo as `npm run test:db`, wired into CI. It catches what went unnoticed this time: the suite has been failing since the MBTI migration and was never run because the only database was production. Adds one dev dependency (`@electric-sql/pglite`). | Planned **[decision]** |
| 0.7 | **A non-production database** — a Supabase dev project or branch for migrations and live smoke tests; production is never a test bed again (14 Oct data-loss incident). | **[decision]** (cost) |
| 0.8 | **Supabase Pro** — the free plan auto-pauses after 7 idle days and has no backups/PITR; one real data-loss event has already happened. | **[decision]** (cost) |
| 0.9 | **Abuse controls before wider launch** — Cloudflare Turnstile on signup, leaked-password protection (Pro), handle-impersonation takedown in the admin dashboard, rate limits on public RPCs and AI routes. | Planned |

**Exit criteria:** 0.1–0.5 live; the security suite passes in CI on every PR; `main` protected; no known
client-writable money, access, moderation or verification column.

---

## Phase 1 — Foundation · *built; close gaps*

| # | Item | Notes |
|---|---|---|
| 1.1 | **Builder, not just student** — signup, `/build` and profile fields assume a university student. Make student fields optional; add a "builder / founder" path and copy. Same `twins` table (D-001). | **[decision]** audience |
| 1.2 | **Account deletion** — a server route that deletes the auth user (cascades all data), with confirmation. Needed now that client DELETE on `twins` is revoked, and for data-protection rights. | **[approval]** auth |
| 1.3 | **Data-minimisation review** — MBTI is required to go public and gender is collected; neither proves capability. Keep, make optional, or drop. | **[decision]** |
| 1.4 | **Server-rendered sessions** — move the Supabase session to cookies (`@supabase/ssr`) so dashboard pages render on the server instead of showing "Loading…" until the JS arrives, which matters on slow connections. | **[approval]** auth change |
| 1.5 | **Public profile polish for proof** — each project card shows its proof sources at a glance (what's linked, attested, measured). Feeds Phase 2. | — |

**Exit criteria:** a non-student builder can sign up, build a profile, submit a project and share a public page without
student-only friction; account deletion works.

---

## Phase 2 — Proof layer

| # | Item | Notes |
|---|---|---|
| 2.1 | **Verification model** — every proof item carries an explicit *source tier*, shown as a transparent status: **Self-reported** → **Linked** (URL to the work) → **Attested** (named third party: reviewer, client, lecturer) → **Institution-verified** (webhook from a verified institution) → **System-verified** (measured server-side from GitHub, a live URL check or a platform API). Only the server can assign a tier above "Linked". | Design doc + migration **[approval]** |
| 2.2 | **Client attestation for AI work** — extend the reviewer-token flow so a *business that used the workflow/agent* can attest outcomes (what it did, for whom, results). This is the strongest proof for "builders with AI workforces". | — |
| 2.3 | **Live-workflow proof** — verify that a listed workflow or agent actually runs: a deployed URL health check, GitHub repo activity (exists), and optionally execution counts from automation platforms (n8n, Make, Zapier) via builder-provided read-only tokens. | **[decision]** which platforms first |
| 2.4 | **Evidence attachments** — private storage bucket for screenshots and PDFs (size/type limits, owner-only paths, signed URLs), alongside links. | **[approval]** |
| 2.5 | **Capability summary design** — the brief asks for a capability score; the live site promises "never a single score". Proposal: a per-capability *evidence profile* (counts per tier, recency) instead of one number. | **[decision]** |

**Exit criteria:** every capability and project on a public page shows *how* it is known; nothing above "Linked" can be
self-assigned; at least one client-attested and one system-verified source exists end to end.

---

## Phase 3 — Discovery

| # | Item | Notes |
|---|---|---|
| 3.1 | **Business accounts** — account type, how businesses are verified, and what they can see beyond the public. | **[decision]** + **[approval]** auth |
| 3.2 | **Project search and browse** — a public-safe `search_public_projects()` RPC (Postgres full-text) with filters: skill, AI tools used, stage, verification tier, location, institution. Ranked by verification strength and recency, not popularity. | Migration **[approval]** |
| 3.3 | **Business-side view** — saved searches, shortlists, compare builders by evidence. | — |
| 3.4 | **Indexing policy** — public pages are `noindex` today. Opt-in search-engine indexing per profile? | **[decision]** |
| 3.5 | **Paywall vs discoverability** — unpaid builders are currently invisible publicly. Options: free public profile with paid extras, or keep the gate. | **[decision]** |

**Exit criteria:** a verified business can find builders and projects by skill and verification tier on a phone, quickly.

---

## Phase 4 — Marketplace

| # | Item | Notes |
|---|---|---|
| 4.1 | **Listings** — builders list skills, workflows and agents (evolving `ai_employees` into listable offerings with scope, price and delivery terms). Every listing links to its proof. | Migration **[approval]** |
| 4.2 | **Hiring flow** — enquiry → proposal → agreement → delivery → completion. **A completed engagement automatically produces a client-attested proof item** (closes the loop with Phase 2). | — |
| 4.3 | **Payments** — production Daraja (M-Pesa) go-live; card payments (provider to choose, e.g. Paystack, Flutterwave, Pesapal or Stripe); builder payouts (M-Pesa B2C) and whether MetaTwin holds funds in escrow, which has regulatory implications. | **[decision]** + **[approval]** payments |
| 4.4 | **Disputes, refunds, receipts**, platform fee model. | **[decision]** |

**Exit criteria:** a business can hire a builder, pay by M-Pesa or card, and the completed work appears as attested proof
on the builder's profile.

---

## Open decisions (summary)

1. Apply + deploy Stage 0.1 (approval). 2. Repo public or private. 3. Dev database (0.7) and Supabase Pro (0.8).
4. Add the DB test harness to CI (0.6). 5. Audience: students only vs students + independent builders (1.1).
6. MBTI and gender (1.3). 7. Score vs "never a single score" (2.5). 8. Paywall vs discoverability (3.5).
9. Card provider and escrow model (4.3).
