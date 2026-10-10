-- Starter skill taxonomy, matching the categories used by the ported
-- design (Technical/Creative/Problem-solving/Collaboration/Domain).
-- Students pick from this list — RLS/grants only allow authenticated
-- clients to SELECT from public.skills, never INSERT, so the vocabulary
-- stays controlled (seeded by us via service_role, per PLAN.md).
insert into public.skills (name, category) values
  ('3D Modelling', 'Technical'),
  ('React App Development', 'Technical'),
  ('User Research', 'Problem-solving'),
  ('Visual & Interface Design', 'Creative'),
  ('Systems Thinking', 'Problem-solving'),
  ('Team Facilitation', 'Collaboration'),
  ('Technical Writing', 'Collaboration'),
  ('Sustainable Materials', 'Domain')
on conflict (name) do nothing;
