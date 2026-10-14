-- pg_trigger_depth() can't distinguish a direct client UPDATE from
-- recompute_project_stage's own internal UPDATE: neither is nested inside
-- another trigger, so both fire this trigger at the same depth (1). The
-- actually-working mechanism, already used by guard_twin_protected_columns,
-- is current_user: a SECURITY DEFINER function runs as its owner (not
-- "authenticated"), so checking current_user correctly tells client writes
-- apart from writes made from inside recompute_project_stage/mark_project_complete.
create or replace function public.guard_project_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.stage := 'idea';
    else
      new.stage := old.stage;
    end if;
  end if;
  return new;
end;
$$;
