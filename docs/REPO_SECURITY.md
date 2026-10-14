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
- [ ] Decide public vs private. Recommendation: **private** (see "Information exposed while public" below). Note: on a
  private org repo, GitHub's secret-scanning push protection needs the paid *Secret Protection* add-on; the CI gitleaks
  scan still runs either way.

**Protect `main`** — Settings → Rules → Rulesets → New branch ruleset, target `main`:
- [ ] Require a pull request before merging (at least 1 approval; dismiss stale approvals on new commits).
- [ ] Require status checks to pass: `check` and `secret-scan` (from CI). Require branches to be up to date.
- [ ] Block force pushes. Restrict deletions.
- [ ] Do not add bypass actors (or limit bypass to one owner, for emergencies only).
  *Effect:* nobody — human or AI session — can push straight to `main` any more; everything lands via a reviewed PR
  with green CI. Past sessions pushed directly to `main`; this ends that.

**Code security** — Settings → Code security:
- [ ] Dependabot alerts **on**; Dependabot security updates **on**.
- [ ] Secret scanning **on**; Push protection **on** (free while public).
- [ ] Private vulnerability reporting **on** (makes the `SECURITY.md` "Report a vulnerability" button work).
- [ ] Code scanning → CodeQL **default setup** (free for public repos).

**Actions** — Settings → Actions → General:
- [ ] Allow only actions created by GitHub, plus actions by verified creators (or an explicit allow-list).
- [ ] Workflow permissions: **Read repository contents** (default read-only token); do not allow Actions to approve PRs.
- [ ] Require approval for workflows from outside collaborators / first-time contributors.

**Organisation** — `github.com/organizations/BARBAHGAMES/settings`:
- [ ] Require two-factor authentication for all members.
- [ ] Base member permission: **Read**; grant Write per repo only to people who need it. Review members and outside
  collaborators on `metatwin` (e.g. Victor, who pushes directly) and remove anyone who no longer needs access.
- [ ] Review installed GitHub Apps, authorised OAuth Apps and deploy keys; remove anything unused.
- [ ] Personal access tokens: fine-grained only, with an expiry date.

## Secret hygiene (owner actions outside GitHub)

- [ ] **Rotate the Supabase `service_role` key.** `.claude/PROJECT_STATE.md` records it being pasted into an AI chat on
  2026-10-10. Treat it as exposed. After rotating: update the Worker secret
  (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config .output/server/wrangler.json`) and your local `.env`,
  then redeploy with `npm run deploy`. Touches production — schedule it deliberately.
- [ ] Before production M-Pesa go-live, create **fresh production Daraja credentials**; never reuse anything that has
  been pasted into a chat.
- [ ] Going forward: secrets go only into Cloudflare Worker secrets, Supabase Vault or a local `.env` — never into chat,
  issues, PR descriptions or committed files.

## Information exposed while the repo is public

No secrets were found, but the repo (especially `.claude/PROJECT_STATE.md`) reveals internal detail useful for
targeting or social engineering: the Supabase project ref, Google Cloud project IDs, the platform-admin email
allow-list, a personal Gmail address, a real business paybill/account number, a Safaricom receipt number, and local
machine paths. It also documented the twins-table security hole until it was fixed. Another reason to go private.
