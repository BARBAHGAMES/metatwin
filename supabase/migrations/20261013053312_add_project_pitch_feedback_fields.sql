-- Per-project judge/customer feedback: a student pastes their own Google
-- Form's published-to-web response sheet as a CSV URL; the computed summary
-- (per-question averages, no raw rows) is cached here. Deliberately
-- restricted to docs.google.com at the DB layer too (defense in depth — the
-- server route that fetches it enforces the same restriction, since it's the
-- Worker making the outbound request on the student's behalf).
alter table public.projects
  add column scores_csv_url text,
  add column pitch_scores jsonb not null default '{}'::jsonb,
  add column scores_synced_at timestamptz,
  add constraint projects_scores_csv_url_format check (
    scores_csv_url is null or (scores_csv_url ~ '^https://docs\.google\.com/[^[:space:]]+$' and char_length(scores_csv_url) <= 2048)
  );
