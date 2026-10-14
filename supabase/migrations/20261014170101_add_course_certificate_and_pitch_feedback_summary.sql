alter table public.courses add column certificate_url text;
alter table public.courses
  add constraint courses_certificate_url_http_only
  check (certificate_url is null or (certificate_url ~* '^https?://[^[:space:]]+$' and char_length(certificate_url) <= 2048));

alter table public.projects add column pitch_feedback_summary text;
alter table public.projects
  add constraint projects_pitch_feedback_summary_length
  check (pitch_feedback_summary is null or char_length(pitch_feedback_summary) <= 500);
