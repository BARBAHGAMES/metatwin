alter table public.twins
  add column development_goal text,
  add column fields_of_interest text[],
  add column seeking text[];

alter table public.twins
  add constraint twins_development_goal_length check (
    development_goal is null or char_length(development_goal) <= 300
  );
