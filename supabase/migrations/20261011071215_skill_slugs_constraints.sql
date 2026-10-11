-- P2-8 (part 2): skills.slug is the stable URL key for /capability/<slug>.
-- Backfilled (explicit values so "React App Development" -> react-development and
-- "Visual & Interface Design" -> visual-design line up with the sample pages),
-- then made required, unique and well-formed. New skills must supply a slug.
alter table public.skills
  alter column slug set not null,
  add constraint skills_slug_key unique (slug),
  add constraint skills_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$');
