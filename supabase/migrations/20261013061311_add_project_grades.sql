-- CBE-aligned academic grades on a project, ingested from a lecturer's
-- Google Form via webhook — never a client-writable table (RLS enabled,
-- zero policies), same pattern as pitch_scores. university_id is copied
-- from the student's own twins.university_id at grading time, not asked on
-- the Form, so there's nothing for a lecturer to mistype.
create table public.project_grades (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  twin_id uuid not null references public.twins(id) on delete cascade,
  university_id uuid not null references public.universities(id),
  rating_label text not null check (rating_label in ('Exceeds Expectation','Meets Expectation','Approaches Expectation','Below Expectation')),
  rating_score smallint not null check (rating_score between 1 and 4),
  grader_name text,
  comment text,
  form_response_id text not null,
  graded_at date not null default current_date,
  created_at timestamptz not null default now(),
  constraint project_grades_grader_name_length check (grader_name is null or char_length(grader_name) <= 120),
  constraint project_grades_comment_length check (comment is null or char_length(comment) <= 2000),
  constraint project_grades_form_response_id_unique unique (form_response_id)
);

create index project_grades_twin_id_idx on public.project_grades(twin_id);
create index project_grades_project_id_idx on public.project_grades(project_id);
create index project_grades_university_id_idx on public.project_grades(university_id);

alter table public.project_grades enable row level security;
-- Zero policies: writes only via the webhook route's service-role client;
-- reads only via get_my_project_grades()/get_my_institution_grades().
