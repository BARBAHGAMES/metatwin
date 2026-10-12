alter table public.twins
  add column photo_url text;

alter table public.twins
  add constraint twins_photo_url_http_only
  check (photo_url is null or (photo_url ~* '^https?://[^[:space:]]+$' and char_length(photo_url) <= 2048));

alter table public.projects
  add column github_repo text,
  add column writeup_url text,
  add column pitch_deck_url text;

alter table public.projects
  add constraint projects_github_repo_format
  check (github_repo is null or (github_repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' and char_length(github_repo) <= 200));

alter table public.projects
  add constraint projects_writeup_url_http_only
  check (writeup_url is null or (writeup_url ~* '^https?://[^[:space:]]+$' and char_length(writeup_url) <= 2048));

alter table public.projects
  add constraint projects_pitch_deck_url_http_only
  check (pitch_deck_url is null or (pitch_deck_url ~* '^https?://[^[:space:]]+$' and char_length(pitch_deck_url) <= 2048));
