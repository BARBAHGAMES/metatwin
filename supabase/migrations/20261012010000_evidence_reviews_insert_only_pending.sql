drop policy "evidence_reviews: owner insert" on public.evidence_reviews;

create policy "evidence_reviews: owner insert pending" on public.evidence_reviews
  for insert with check (
    (select auth.uid()) = twin_id
    and submitted_at is null
    and comment is null
  );
