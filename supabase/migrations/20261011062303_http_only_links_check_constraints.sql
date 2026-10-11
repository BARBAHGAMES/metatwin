-- P0-3: user-supplied links must be plain http(s) URLs. A javascript: or data:
-- URL rendered as <a href> runs script on click (the CSP allows 'unsafe-inline').
-- Enforced in the database so it holds for any client; the UI validates too.
-- No whitespace allowed anywhere in the value, max 2048 chars.
alter table public.evidence
  add constraint evidence_link_http_only
  check (link is null or (link ~* '^https?://[^[:space:]]+$' and char_length(link) <= 2048));

alter table public.projects
  add constraint projects_artifact_url_http_only
  check (artifact_url is null or (artifact_url ~* '^https?://[^[:space:]]+$' and char_length(artifact_url) <= 2048));

alter table public.opportunities
  add constraint opportunities_url_http_only
  check (url is null or (url ~* '^https?://[^[:space:]]+$' and char_length(url) <= 2048));
