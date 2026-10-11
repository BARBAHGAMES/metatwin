# Pilot readiness — what's done and what only Andrew can do

Goal: ~50–100 real students (HIT first) with evidence-backed twins. Everything the code and database can do is done;
this is the remainder. Order is by risk.

## Must do before inviting students

| # | Step (dashboard) | Why | Time |
|---|---|---|---|
| 1 | **Supabase → Settings → Billing: upgrade `metatwin` to Pro** | Free projects pause after 7 idle days, which would silently take the site down. Pro also adds daily backups and unlocks #4. | 2 min |
| 2 | **Auth → URL Configuration → Redirect URLs:** add `https://metatwin.metaglobetechnologies.co.ke/reset-password` | Password-reset links otherwise fall back to the Site URL. | 1 min |
| 3 | **Auth → Sign In / Providers → Email:** minimum password length **8** | The client enforces 8; this is what stops direct API calls. | 1 min |
| 4 | **Auth → Sign In / Providers → Email:** turn on **Prevent use of leaked passwords** (Pro) | Supabase advisor warning `auth_leaked_password_protection`. | 1 min |
| 5 | **Auth → SMTP Settings:** enable Custom SMTP with Resend (host `smtp.resend.com`, port 465, user `resend`, password = a Resend API key scoped to sending, sender `hello@metaglobetechnologies.co.ke`) | Confirmation and reset emails currently use Supabase's shared mailer: heavily rate-limited (a few per hour) and likely to land in spam. With 50–100 signups this WILL break. | 5 min |
| 6 | Deploy `claude/p2-8-real-data` (or this branch) via `npm run deploy`, then run the runbook smoke test | Ships the app code for P0–P2. | 5 min |

## Strongly recommended

- **Auth → Attack Protection → CAPTCHA (Cloudflare Turnstile):** signup is open to bots; Turnstile is free. Needs a small
  code change to pass the token (ask Claude to add it once the Turnstile site key exists).
- **Add real opportunities** (HIT, NCBA, partners). The table is intentionally empty; students see an honest empty state
  until you add some. Ask Claude with the details, or run:
  `insert into opportunities (title, org_name, description, url, required_skill_ids) values (...)` with skill ids from `skills`.
- **Run the security regression suite** after any schema change: paste `supabase/tests/security_regression.sql` into the SQL
  editor. It must end with `ALL PASS (rolled back)`.

## Known limits (decided, not oversights)

- Age is **self-declared** (18+ only). Birth year can't separate a 17- from an 18-year-old born in the same year; the
  explicit checkbox carries that edge. Real verification would need ID checks.
- `/build` is a **preview wizard**: it saves nothing and now says so, then sends people to `/signup`.
- Evidence is **student-added and not independently verified**; the public page says so.
- Public profiles are `noindex`; handle impersonation (a student taking a real person's/organisation's name) is not
  reviewed — add an admin takedown path before a wider launch.
- AI team on the dashboard is a labelled concept, not a feature.

## Already done in code / database (for reference)

P0-1 evidence integrity · P0-2 18+ gate · P0-3 http(s)-only links · P0-4 welcome email after confirmation ·
P1-5 public profile · P1-6 honest preview labels · P1-7 error states, password reset, field limits ·
P2-8 real data pages + opportunity matching · P2-9 least-privilege grants, RLS performance, FK indexes, CI, security
regression suite, honest `/build`.
