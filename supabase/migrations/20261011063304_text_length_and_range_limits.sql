-- P1-7: bound every student-writable text field and the study year, so one
-- account can't bloat the database or break layouts with megabyte values.
-- The UI enforces the same limits (maxLength) with friendly messages.
alter table public.twins
  add constraint twins_text_lengths check (
    (name is null or char_length(name) <= 100)
    and (headline is null or char_length(headline) <= 160)
    and (institution is null or char_length(institution) <= 120)
    and (programme is null or char_length(programme) <= 120)
  ),
  add constraint twins_year_range check (year is null or year between 1 and 10);

alter table public.projects
  add constraint projects_text_lengths check (
    char_length(btrim(title)) between 1 and 120
    and (description is null or char_length(description) <= 2000)
  );

alter table public.evidence
  add constraint evidence_text_lengths check (
    char_length(btrim(title)) between 1 and 120
    and (note is null or char_length(note) <= 1000)
  );

alter table public.courses
  add constraint courses_text_lengths check (
    char_length(btrim(name)) between 1 and 120
    and (grade is null or char_length(grade) <= 20)
    and (term is null or char_length(term) <= 40)
  );

alter table public.assessments
  add constraint assessments_text_lengths check (
    char_length(btrim(trait_type)) between 1 and 60
    and char_length(btrim(trait_value)) between 1 and 200
  );
