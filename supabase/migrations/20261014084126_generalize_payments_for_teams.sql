-- Generalizes payments to cover both a twin's individual purchase and a
-- team lead's team-package purchase, mirroring the exactly-one-of pattern
-- pitch_scores already uses for twin_id/team_id in this same codebase.
alter table public.payments
  alter column twin_id drop not null,
  add column team_id uuid references public.teams(id) on delete cascade,
  add column plan_tier text check (plan_tier in ('basic', 'guided', 'builder')),
  add column plan_package text check (plan_package in ('duo', 'studio', 'launch')),
  add constraint payments_exactly_one_subject check ((twin_id is not null) <> (team_id is not null));
