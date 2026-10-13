alter table public.projects
  add column pitch_video_url text,
  add constraint projects_pitch_video_url_http_only
  check (pitch_video_url is null or (pitch_video_url ~* '^https?://[^[:space:]]+$' and char_length(pitch_video_url) <= 2048));
