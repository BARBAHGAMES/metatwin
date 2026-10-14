-- Admin-only, unspoofable: each looks up the CALLER's own verified
-- platform_admins row via auth.uid() rather than trusting a passed-in admin
-- id — same pattern as get_my_institution_grades(). No destructive effect:
-- is_active just gates get_public_profile/list_public_twins and the
-- student's own dashboard; evidence/projects/competencies are untouched.
create or replace function public.deactivate_twin(p_twin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.platform_admins where id = (select auth.uid()) and status = 'verified'
  ) then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  update public.twins set is_active = false, deactivated_at = now() where id = p_twin_id;
end;
$$;

create or replace function public.reactivate_twin(p_twin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.platform_admins where id = (select auth.uid()) and status = 'verified'
  ) then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  update public.twins set is_active = true, deactivated_at = null where id = p_twin_id;
end;
$$;

-- Revoke from anon explicitly (revoking from public alone doesn't touch the
-- direct anon/authenticated grants Supabase creates at function-creation
-- time — the lesson from the 2026-10-13 pitch-score/teams RPC sweep).
revoke all on function public.deactivate_twin(uuid) from public, anon;
revoke all on function public.reactivate_twin(uuid) from public, anon;
grant execute on function public.deactivate_twin(uuid) to authenticated;
grant execute on function public.reactivate_twin(uuid) to authenticated;
