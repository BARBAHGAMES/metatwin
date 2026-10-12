create table public.evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  twin_id uuid not null references public.twins (id) on delete cascade,
  reviewer_name text not null,
  reviewer_role text,
  comment text,
  token uuid not null default gen_random_uuid(),
  token_expires_at timestamptz not null default (now() + interval '14 days'),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint evidence_reviews_reviewer_name_length check (char_length(reviewer_name) between 1 and 120),
  constraint evidence_reviews_reviewer_role_length check (reviewer_role is null or char_length(reviewer_role) <= 120),
  constraint evidence_reviews_comment_length check (comment is null or char_length(comment) <= 1000)
);

create unique index evidence_reviews_token_idx on public.evidence_reviews (token);
create index evidence_reviews_evidence_id_idx on public.evidence_reviews (evidence_id);
create index evidence_reviews_twin_id_idx on public.evidence_reviews (twin_id);

alter table public.evidence_reviews enable row level security;

create policy "evidence_reviews: owner select submitted" on public.evidence_reviews
  for select using ((select auth.uid()) = twin_id and submitted_at is not null);

create policy "evidence_reviews: owner insert" on public.evidence_reviews
  for insert with check ((select auth.uid()) = twin_id);

grant select, insert on public.evidence_reviews to authenticated;

create or replace function public.submit_evidence_review(p_token uuid, p_comment text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_comment is not null and char_length(p_comment) > 1000 then
    raise exception 'comment too long';
  end if;
  update public.evidence_reviews
  set comment = p_comment, submitted_at = now()
  where token = p_token and submitted_at is null and token_expires_at > now();
  return found;
end;
$$;

revoke all on function public.submit_evidence_review(uuid, text) from public;
grant execute on function public.submit_evidence_review(uuid, text) to anon, authenticated;

create or replace function public.get_review_invite(p_token uuid)
returns table (
  evidence_title text,
  evidence_note text,
  evidence_link text,
  reviewer_name text,
  twin_name text,
  already_submitted boolean,
  expired boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.title,
    e.note,
    e.link,
    r.reviewer_name,
    t.name,
    r.submitted_at is not null,
    r.token_expires_at <= now()
  from public.evidence_reviews r
  join public.evidence e on e.id = r.evidence_id
  join public.twins t on t.id = r.twin_id
  where r.token = p_token;
$$;

revoke all on function public.get_review_invite(uuid) from public;
grant execute on function public.get_review_invite(uuid) to anon, authenticated;
