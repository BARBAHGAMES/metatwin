-- Build Plan 0.5: ai_employees.github_full_name/stars/forks/open_issues/
-- synced_at are server-fetched (public GitHub API) but were browser-written
-- after the fetch, so a student could forge them through the API. Pin them
-- for any write made as `authenticated`/`anon` — only the server-side sync
-- route (github-sync-route.server.ts, via supabaseAdmin) can set them now.
-- If the student changes link_url (e.g. swaps in a different repo, or a
-- non-GitHub link), the stale stats reset rather than staying attached to a
-- now-unrelated link.
create or replace function public.guard_ai_employee_github_stats()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.github_full_name := null;
      new.github_stars := null;
      new.github_forks := null;
      new.github_open_issues := null;
      new.github_synced_at := null;
    elsif new.link_url is distinct from old.link_url then
      new.github_full_name := null;
      new.github_stars := null;
      new.github_forks := null;
      new.github_open_issues := null;
      new.github_synced_at := null;
    else
      new.github_full_name := old.github_full_name;
      new.github_stars := old.github_stars;
      new.github_forks := old.github_forks;
      new.github_open_issues := old.github_open_issues;
      new.github_synced_at := old.github_synced_at;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_ai_employee_github_stats() from public, anon, authenticated;

create trigger ai_employees_guard_github_stats
  before insert or update on public.ai_employees
  for each row execute function public.guard_ai_employee_github_stats();
