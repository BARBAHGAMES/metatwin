create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  description text,
  avatar_url text,
  visibility text not null default 'private',
  created_by uuid not null references public.twins (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_name_length check (char_length(name) between 1 and 120),
  constraint teams_description_length check (description is null or char_length(description) <= 1000),
  constraint teams_visibility_values check (visibility in ('public', 'private')),
  -- Mirrors twins_handle_format exactly, plus "teams"/"talent" reserved since
  -- /teams is now a route prefix and /talent already is one.
  constraint teams_slug_format check (
    slug is null or (
      slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
      and slug <> all (array['admin','api','www','metatwin','support','help','login','signup','dashboard','profile','about','pricing','talent','teams','null','undefined'])
    )
  ),
  constraint teams_public_requires_slug check (visibility = 'private' or slug is not null)
);

create index teams_created_by_idx on public.teams (created_by);

-- A twin can belong to multiple teams across their time on the platform —
-- left_at (nullable) keeps history instead of deleting the row when someone
-- moves on, rather than forcing one-team-at-a-time membership.
create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  twin_id uuid not null references public.twins (id) on delete cascade,
  role text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (team_id, twin_id),
  constraint team_members_role_length check (role is null or char_length(role) <= 60)
);

create index team_members_twin_id_idx on public.team_members (twin_id);
create index team_members_active_idx on public.team_members (team_id) where left_at is null;

-- A project stays owned by the twin who created it — this just lets it also
-- be attributed to a team, so it shows on both the member's own profile and
-- the team's.
alter table public.projects add column team_id uuid references public.teams (id) on delete set null;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
-- No policies on either table — RPC-only access (create_team,
-- add_team_member, leave_team, remove_team_member, get_my_teams,
-- get_team_public_profile), same lockdown pattern as github_connections.
