-- Build Plan 0.5: projects.interviews_count / interviews_synced_at /
-- pitch_scores / scores_synced_at are server-fetched (Google Sheets CSV) but
-- were browser-written, so a student could forge them through the API —
-- interviews_count in particular feeds recompute_project_stage(), so this
-- let a student self-advance their own project stage.
--
-- Same mechanism as guard_twin_protected_columns / guard_project_stage: pin
-- the derived columns for any write made as `authenticated`/`anon`. The new
-- server-side sync routes (github-sync-route.server.ts,
-- pitch-feedback-sync-route.server.ts) write via supabaseAdmin (service_role),
-- which this guard never touches.
--
-- Also: if a client-made write changes the *_csv_url (which stays
-- client-writable — no legitimate reason to pin it, and the server routes
-- write it together with the derived values anyway), the matching derived
-- values reset to their empty defaults. A changed source invalidates the old
-- number rather than leaving a stale count attached to a new, unsynced URL.
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
    end if;
  end if;
  return new;
end;
$$;
