-- One GitHub account per twin, connected via Supabase's existing GitHub
-- OAuth identity (linkIdentity, not a separate OAuth App). access_token is
-- the provider token captured once at connect time, used server-side only
-- for periodic re-sync — this table is never readable by anon/authenticated
-- directly (no RLS policies at all), the same lockdown pattern as
-- partnership_inquiries. Only a SECURITY DEFINER RPC (get_my_github_connection)
-- or get_public_profile ever read from it, and both explicitly omit the token.
create table public.github_connections (
  twin_id uuid primary key references public.twins (id) on delete cascade,
  github_username text not null,
  github_user_id bigint not null,
  avatar_url text,
  access_token text not null,
  total_contributions_year integer not null default 0,
  current_streak_days integer not null default 0,
  top_languages jsonb not null default '[]'::jsonb,
  public_repo_count integer not null default 0,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  constraint github_connections_username_length check (char_length(github_username) between 1 and 120)
);

create unique index github_connections_github_user_id_idx on public.github_connections (github_user_id);

alter table public.github_connections enable row level security;
-- Intentionally no policies: locked down entirely, server/RPC access only.

create or replace function public.get_my_github_connection()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'github_username', github_username,
    'avatar_url', avatar_url,
    'total_contributions_year', total_contributions_year,
    'current_streak_days', current_streak_days,
    'top_languages', top_languages,
    'public_repo_count', public_repo_count,
    'connected_at', connected_at,
    'last_synced_at', last_synced_at
  )
  from public.github_connections
  where twin_id = (select auth.uid());
$$;

revoke all on function public.get_my_github_connection() from public;
grant execute on function public.get_my_github_connection() to authenticated;

create or replace function public.disconnect_github()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.github_connections where twin_id = (select auth.uid());
$$;

revoke all on function public.disconnect_github() from public;
grant execute on function public.disconnect_github() to authenticated;
