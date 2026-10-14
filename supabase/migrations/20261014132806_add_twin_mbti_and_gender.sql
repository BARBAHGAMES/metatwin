alter table public.twins
  add column mbti_type text check (mbti_type is null or mbti_type in (
    'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
    'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'
  )),
  add column gender text check (gender is null or gender in ('female','male','prefer_not_to_say','self_described')),
  add column gender_self_described text;

alter table public.twins
  add constraint twins_gender_self_described_length check (
    gender_self_described is null or char_length(gender_self_described) <= 60
  );

-- MBTI is new and Andrew's own account is already public without one — a plain
-- same-table CHECK (the style used by twins_public_requires_adult/_handle) would
-- retroactively break it. Instead, a trigger that only requires mbti_type at the
-- moment a profile newly GOES public (private/nonexistent -> public), grandfathering
-- any already-public profile exactly like plan_status did for the pilot cohort.
create or replace function public.guard_twin_public_requires_mbti()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.visibility = 'public' and (tg_op = 'INSERT' or old.visibility <> 'public') and new.mbti_type is null then
    raise exception 'Add your MBTI type before making your profile public.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_twin_public_requires_mbti() from public, anon, authenticated;

create trigger twins_guard_public_requires_mbti
  before insert or update on public.twins
  for each row execute function public.guard_twin_public_requires_mbti();

-- Denormalizes the latest MBTI submission from assessments onto twins.mbti_type,
-- same "sync a summary column via trigger" pattern as sync_competency_evidence_count.
create or replace function public.sync_twin_mbti_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trait_type = 'mbti' then
    update public.twins set mbti_type = new.trait_value, updated_at = now() where id = new.twin_id;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_twin_mbti_type() from public, anon, authenticated;

create trigger assessments_sync_mbti_type
  after insert or update of trait_value on public.assessments
  for each row execute function public.sync_twin_mbti_type();
