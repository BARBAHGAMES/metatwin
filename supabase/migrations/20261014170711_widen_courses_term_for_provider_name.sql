-- The new Courses tab uses this column for "School or provider" (the mockup's
-- field, not an academic term) — widen the length cap to fit a real institution
-- name; the "term" column name stays as-is since nothing else references it.
alter table public.courses drop constraint courses_text_lengths;
alter table public.courses
  add constraint courses_text_lengths check (
    char_length(btrim(name)) between 1 and 120
    and (grade is null or char_length(grade) <= 20)
    and (term is null or char_length(term) <= 160)
  );
