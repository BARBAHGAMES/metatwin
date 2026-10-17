# Release A runbook: visitor feedback loop (for the local Claude Code session)

> Ships branch `feature/visitor-feedback-a`. It is stacked on `fix/code-ux-mobile-review`, so it contains that work too.
> Design: `PITCH_FEEDBACK_FLOW.md` v3 (approved by Andrew 2026-10-15). Read `CLAUDE.md` first.
> Same authority rules as `docs/LOCAL_SESSION_RUNBOOK.md`:
> - Go ahead without asking: push the feature branch, open the PR, run read-only checks.
> - Ask Andrew in-session before: applying each migration, setting secrets, merging, deploying.
> - Never: run test scripts against production.

## What ships

| Piece | Where |
|---|---|
| Paste prompt ("Anyone with the link → Viewer"), link recognition, fixed link formats (Slides published links, Drive video, `/u/1/`, YouTube live and start times) | `src/lib/embed.ts`, `PitchMedia.tsx`, links form |
| Pitch materials always public (D7/D-013) | migration `20261015200000_public_profile_pitch_materials_always_public` |
| Visitor feedback: tables, functions, retention | migration `20261015200100_add_project_feedback` |
| Deck viewability check | migration `20261015200200_project_pitch_deck_status` + `POST /api/projects/check-deck` |
| Deck view counts | migration `20261015200300_add_project_deck_views` + `POST /api/projects/deck-view` |
| Feedback routes | `POST /api/feedback/submit`, `POST /api/feedback/confirm`, page `/feedback/confirm/<token>` |
| Screens | public profile form; student "Visitor feedback" and "Who's seen your pitch" panels; overview tile; school dashboard list; admin moderation |
| Privacy policy update | `/privacy`: **legal review before launch** |

## Order (the code must be live before the migrations)

The deck-view and deck-check routes call database functions that only exist after the migrations; the new screens need
them too. But **the migrations are safe to apply first**: they only add things, and the old app never calls them. So:

1. **Local gate** on the branch: `npm ci`, `build`, `typecheck`, `lint` (expect 0 errors and 1 old warning),
   `npm test` (**226**), `npm run test:db` (**102 migrations**, both suites PASS), `db:audit`, `check-content-drift`,
   `check-grants`. Push, open the PR, wait for green CI.
2. **Read-only pre-checks** on production:
   - `pg_get_functiondef('public.get_public_profile(text)'::regprocedure)` must match
     `20261014132838_extend_public_profile_project_stage.sql`. If it doesn't, **STOP**: migration 1 replaces it.
   - `pg_get_functiondef('public.guard_project_stage'::regproc)` must match the version in
     `20261015184954_guard_project_proof_columns.sql`. If not, **STOP**.
3. **Apply the four migrations in order** with Andrew's OK, one at a time via `apply_migration`. After each one, rename
   the file to the version actually assigned and update the references in `docs/` and `.claude/PROJECT_STATE.md`.
   Then rerun `npm run test:db`.
4. **Read-only post-checks:**
   - `select has_table_privilege('authenticated','public.project_feedback','SELECT'), has_table_privilege('anon','public.project_feedback_contacts','SELECT'), has_table_privilege('authenticated','public.project_deck_views','SELECT');` → all `false`.
   - `select has_function_privilege('anon','public.submit_project_feedback(text,uuid,int,text,text,text,text,text,text,boolean,text)','EXECUTE');` → `false`.
   - `get_advisors(security)`: the expected new notes are about the new owner/admin `SECURITY DEFINER` functions,
     which are callable by `authenticated` only. No new anon-callable functions.
   - **Regenerate Supabase types** (`generate_typescript_types`). They replace the hand-added entries in
     `src/integrations/supabase/types.ts`. Run `npm run typecheck` and commit.
5. **Secrets** (Andrew sets them; values must never pass through chat):
   - `DECK_VIEW_SALT`: random 32+ bytes. `npx wrangler secret put DECK_VIEW_SALT --config .output/server/wrangler.json`
     (pipe from a temp file and delete it). Without it, the webhook secret is used as the salt; that works, but set a
     dedicated one.
   - **Turnstile (recommended before wide launch):** create a widget in the Cloudflare dashboard for
     `metatwin.metaglobetechnologies.co.ke`.
     - Set `TURNSTILE_SECRET_KEY` as a Worker secret.
     - Add `VITE_TURNSTILE_SITE_KEY=<site key>` to `.env` **before** `npm run deploy`. Vite inlines it into the
       browser bundle at build time, so it doesn't need to be a Worker var (see `.env.example`).
     - Without both, the form works with no CAPTCHA, protected only by the per-IP/per-email limits and email confirmation.
   - Resend already sends from `hello@metaglobetechnologies.co.ke`; nothing new to set.
6. **Merge** (Andrew, in the GitHub UI) → `npm run deploy` (Andrew's go-ahead; never a raw `wrangler deploy`) → record
   the Worker version.
7. **Retention schedule:** `purge_expired_feedback_data()` already runs after every feedback submission. Also schedule
   it daily so deletions happen even when nobody submits. Two options:
   - a Worker cron trigger (needs `triggers.crons` in `patch-wrangler.cjs` and a `scheduled` handler in `src/server.ts`; not built yet);
   - Supabase `pg_cron`: `select cron.schedule('purge-feedback', '15 3 * * *', $$select public.purge_expired_feedback_data()$$);` (Andrew's OK; it touches production config).
8. **Calibrate the deck check** (do this once, with Andrew):
   - make one of his decks "Anyone with the link" and another "Restricted";
   - paste each on his own project and save;
   - the badge must read **viewable** and **Only you can see this deck** respectively.

   If Google answers differently from `classifyGoogleResponse()` (see its unit tests), adjust the mapping, add a test
   for what Google actually returned, and redeploy. Never test with someone else's deck.
9. **Live smoke test (read-only plus Andrew's own accounts; no scripts against production):**
   - `/t/<his handle>` (profile public): each project shows deck, video and write-up links and a **Give feedback** button.
   - From a phone, signed out:
     1. Send feedback with a personal email.
     2. Receive the confirmation email.
     3. Tap the link, then **Confirm**: "Thank you!".
     4. On his dashboard the project shows the feedback; the overview tile shows "1 new"; no email or WhatsApp is visible.
   - Admin dashboard (`andrew@metaglobetechnologies.co.ke`): the feedback appears with email and WhatsApp.
   - Open his deck on the public page from another device; "Who's seen your pitch" counts it (once per day).
   - `POST /api/feedback/submit` with an empty body → 400; `POST /api/projects/check-deck` without a token → 401.
10. **Record:** update `.claude/PROJECT_STATE.md` (versions, Worker version, smoke results) and `docs/BUILD_PLAN.md`
    row 0.11 via a small `chore/` PR.

## Rollback
- **Worker:** `npx wrangler rollback --config .output/server/wrangler.json`.
- **Database:**
  - The new tables and functions are unused by the old app, so leaving them in place is safe.
  - To restore the old pitch-materials visibility, re-apply the `get_public_profile` body from
    `20261014132838_extend_public_profile_project_stage.sql`.
  - To restore `guard_project_stage`, re-apply the body from `20261015184954_guard_project_proof_columns.sql`.

## Open items after Release A
- Decide whether signed-in viewers are named to the student (currently counts only, D-014).
- Release B: credits, paid email unlock (consent-gated), n8n recommendations with signed webhooks only.
- Business accounts and challenges: separate design pass.
- Legal review of `/privacy` and of charging students for reviewer emails (Kenya Data Protection Act consent).
