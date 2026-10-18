-- Deck viewability check (pitch flow v3, Release A). The server opens a
-- project's pitch deck link the way a stranger would and records whether
-- anyone with the link can view it, so the student is warned when hirers would
-- hit a Google sign-in wall.
--
-- Server-written proof columns (D-004): pinned for writes made as
-- authenticated/anon by extending guard_project_stage(); reset to 'unchecked'
-- whenever the student changes pitch_deck_url (a new link invalidates the old
-- result). Readable by the owner through the table-wide select grant; not part
-- of get_public_profile.

alter table public.projects
  add column pitch_deck_status text not null default 'unchecked'
    check (pitch_deck_status in ('unchecked', 'public', 'restricted', 'not_found', 'unknown')),
  add column pitch_deck_checked_at timestamptz;

create or replace function public.guard_project_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.stage := 'idea';
      new.interviews_count := 0;
      new.interviews_synced_at := null;
      new.pitch_scores := '{}'::jsonb;
      new.scores_synced_at := null;
      new.pitch_deck_status := 'unchecked';
      new.pitch_deck_checked_at := null;
    else
      new.stage := old.stage;
      if new.interviews_csv_url is distinct from old.interviews_csv_url then
        new.interviews_count := 0;
        new.interviews_synced_at := null;
      else
        new.interviews_count := old.interviews_count;
        new.interviews_synced_at := old.interviews_synced_at;
      end if;
      if new.scores_csv_url is distinct from old.scores_csv_url then
        new.pitch_scores := '{}'::jsonb;
        new.scores_synced_at := null;
      else
        new.pitch_scores := old.pitch_scores;
        new.scores_synced_at := old.scores_synced_at;
      end if;
      if new.pitch_deck_url is distinct from old.pitch_deck_url then
        new.pitch_deck_status := 'unchecked';
        new.pitch_deck_checked_at := null;
      else
        new.pitch_deck_status := old.pitch_deck_status;
        new.pitch_deck_checked_at := old.pitch_deck_checked_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;
