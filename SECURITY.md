# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

- Preferred: GitHub → this repository → **Security** tab → **Report a vulnerability** (private advisory).
- Or email **hello@metaglobetechnologies.co.ke** with "SECURITY" in the subject.

Include what you found, how to reproduce it, and what an attacker could do with it. We aim to acknowledge reports
promptly and will tell you when a fix is live. Please give us a reasonable chance to fix an issue before disclosing it.

## Scope

- The MetaTwin web app at `metatwin.metaglobetechnologies.co.ke` (Cloudflare Worker) and this repository.
- The MetaTwin Supabase project's database rules (RLS policies, grants, functions) as defined in `supabase/migrations/`.

Out of scope: denial-of-service, social engineering of staff, and findings that require a compromised device.

Please test only against accounts you own. Never access, modify or delete another person's data, and never trigger a
real payment.

## How this codebase stays secure (for contributors)

- Every table has RLS; anonymous reads go only through narrow `SECURITY DEFINER` functions (`get_public_profile`, …).
- Columns that carry money, access or verification (plan status, activation, evidence counts, project stage, …) are
  never client-writable: guard triggers reset them on writes made as `authenticated`/`anon`.
- `supabase/tests/security_regression.sql` must end with `ALL PASS (rolled back)` after any schema change — run it on a
  local or dev database, never on production.
- No secrets in git: `.env`, `.dev.vars`, keys and certificates are gitignored; CI scans the full history with gitleaks
  on every push. Production secrets live in Cloudflare Worker secrets and Supabase Vault only.
- Repository settings checklist: [`docs/REPO_SECURITY.md`](docs/REPO_SECURITY.md).
