# Repository security checklist

What's enforced **in the repo** (this branch) and what only an **owner of the `BARBAHGAMES` GitHub org** can switch on.
Tick items off as they're done; record anything skipped (and why) in `docs/DECISIONS.md`.

## Already in the repo

- [x] CI runs a **gitleaks** scan of the full git history (all branches) on every push and PR — fails on any secret.
  First full scan (2026-10-14): 107 commits, **no leaks found**.
- [x] CI runs `npm audit --audit-level=high` (0 vulnerabilities at 2026-10-14).
- [x] GitHub Actions pinned to full commit SHAs; `persist-credentials: false`; workflow token is read-only
  (`permissions: contents: read`); CI never deploys and holds no secrets.
- [x] Dependabot for npm and GitHub Actions (weekly, grouped, PRs only — nothing auto-merges).
- [x] `.gitignore` covers `.env*` (except `.env.example`), `.dev.vars*`, keys/certificates, service-account JSON,
  Supabase CLI state and `.claude/settings.local.json`.
- [x] `SECURITY.md` vulnerability-reporting policy.

## Owner actions on GitHub (Settings)

**Repository visibility**
- [x] Already private (checked 2026-10-15, nothing to change). Note: GitHub's secret-scanning push protection and
  CodeQL default setup need the paid *Secret Protection*/Advanced Security add-on on a private org repo — confirmed
  unavailable on this org's current (Free) plan; see Code security below.

**Protect `main`** — Settings → Rules → Rulesets → New branch ruleset, target `main`:
- [ ] **Blocked on the current plan, not skipped.** Confirmed 2026-10-15: `BARBAHGAMES` is on GitHub Free, which only
  allows branch protection/rulesets on a **public** repo (or requires upgrading to GitHub Team). Andrew's call:
  stay private, leave this unenforced by GitHub for now — branch discipline (feature branches, no direct pushes to
  `main`) stays a `CLAUDE.md`/process rule only. Revisit if the org ever moves to a paid plan.

**Code security** — Settings → Code security:
- [x] Dependabot alerts **on** (already was). Dependabot security updates **on** (enabled 2026-10-15).
- [ ] **Confirmed unavailable on the Free plan** (2026-10-15): secret scanning, push protection, private
  vulnerability reporting, and CodeQL default setup all returned "Advanced Security must be enabled" /
  equivalent 403s via the API. Revisit if the org upgrades.

**Actions** — Settings → Actions → General:
- [x] Allowed actions restricted to GitHub-owned + verified creators only (2026-10-15) — confirmed this doesn't
  break CI (`actions/checkout`, `actions/setup-node` are both GitHub-owned; gitleaks runs as a downloaded binary,
  not a Marketplace Action).
- [x] Default workflow token permissions set to **Read repository contents**, PR-approval via Actions disabled
  (was previously `write` with PR-approve allowed — a real gap, now closed) (2026-10-15).
- [x] SHA-pinning required for all Actions (2026-10-15) — matches the existing convention of pinning
  `actions/checkout`/`actions/setup-node` to full SHAs, now GitHub-enforced too.
- [ ] Require approval for workflows from outside collaborators / first-time contributors — not chased down; this
  setting is about fork-PR workflow runs, and `metatwin` is private with no external contributors today, so low
  priority. No confirmed API endpoint found for it either.

**Organisation** — `github.com/organizations/BARBAHGAMES/settings`:
- [ ] Require two-factor authentication for all members. **Audited, not enabled** (2026-10-15): currently off
  org-wide; default member permission is already `none` (least-privilege). 4 members (`barbahgamesfounder`,
  `ryantigi254`, `Vonmak`, `winnieedtech-dev`), 2 with admin on `metatwin`, no outside collaborators. **Flagging,
  not flipping this myself**: enabling it immediately removes any member without 2FA from the org — verify
  everyone has it on first.
- [ ] Base member permission: already **none**. Review members and outside collaborators on `metatwin` (e.g.
  Victor, who pushes directly) and remove anyone who no longer needs access — not done, needs your judgment on
  who still needs it.
- [ ] Review installed GitHub Apps, authorised OAuth Apps and deploy keys. **Audited** (2026-10-15): no deploy
  keys, no webhooks on `metatwin` itself; 7 org-level GitHub Apps installed (aws-amplify, flutterflow, netlify,
  lovable-dev, supabase, cloudflare-workers-and-pages, claude) — shared across your other projects, so left alone;
  your call on whether any are stale.
- [ ] Personal access tokens: fine-grained only, with an expiry date.

## Secret hygiene (owner actions outside GitHub)

- [ ] **Rotate the Supabase `service_role` key.** `.claude/PROJECT_STATE.md` records it being pasted into an AI chat on
  2026-10-10. Treat it as exposed. **Checked 2026-10-15: this project already uses the new `sb_secret_...` key format**
  (confirmed via `VITE_SUPABASE_PUBLISHABLE_KEY`'s `sb_publishable_...` prefix and a format-only check on
  `SUPABASE_SERVICE_ROLE_KEY`, value never read) — so rotating it is safe and independent, unlike the legacy JWT pair
  (no user gets signed out, the publishable key is untouched). Still needs you: create a new secret key in the
  Supabase dashboard (Settings → API Keys) and run `wrangler secret put` with it yourself — the new value should
  never pass through an AI chat, which is the exact mistake being fixed. After: update the Worker secret
  (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config .output/server/wrangler.json`) and your local `.env`,
  then redeploy with `npm run deploy`. Tell the session once done and it'll verify M-Pesa/admin routes still work,
  then revoke the old key (safe to do from here — just an id, no secret value involved).
- [ ] Before production M-Pesa go-live, create **fresh production Daraja credentials**; never reuse anything that has
  been pasted into a chat.
- [ ] Going forward: secrets go only into Cloudflare Worker secrets, Supabase Vault or a local `.env` — never into chat,
  issues, PR descriptions or committed files.

## Information exposed while the repo is public

No secrets were found, but the repo (especially `.claude/PROJECT_STATE.md`) reveals internal detail useful for
targeting or social engineering: the Supabase project ref, Google Cloud project IDs, the platform-admin email
allow-list, a personal Gmail address, a real business paybill/account number, a Safaricom receipt number, and local
machine paths. It also documented the twins-table security hole until it was fixed. Another reason to go private.
