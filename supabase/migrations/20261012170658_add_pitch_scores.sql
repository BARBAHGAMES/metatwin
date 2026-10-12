-- Pitch-competition scores, ingested from a Google Form via Apps Script ->
-- a dedicated webhook route (not a client-writable table: RLS enabled, zero
-- policies, same pattern as github_connections/teams). Exactly one of
-- twin_id/team_id is set, matching the earlier decision that teams show up
-- together on their own page/dashboard rather than duplicated onto each
-- member's individual score history.
create table public.pitch_scores (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid references public.twins(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  competition_name text not null,
  round_name text,
  event_date date not null default current_date,
  problem_score smallint not null,
  solution_score smallint not null,
  team_score smallint not null,
  ask_score smallint not null,
  total_score smallint generated always as (problem_score + solution_score + team_score + ask_score) stored,
  judge_name text,
  judge_comment text,
  form_response_id text not null,
  created_at timestamptz not null default now(),
  constraint pitch_scores_subject_exactly_one check (
    (case when twin_id is not null then 1 else 0 end)
    + (case when team_id is not null then 1 else 0 end) = 1
  ),
  constraint pitch_scores_competition_name_length check (char_length(competition_name) between 1 and 160),
  constraint pitch_scores_round_name_length check (round_name is null or char_length(round_name) <= 60),
  constraint pitch_scores_judge_name_length check (judge_name is null or char_length(judge_name) <= 120),
  constraint pitch_scores_judge_comment_length check (judge_comment is null or char_length(judge_comment) <= 2000),
  constraint pitch_scores_problem_score_range check (problem_score between 0 and 25),
  constraint pitch_scores_solution_score_range check (solution_score between 0 and 25),
  constraint pitch_scores_team_score_range check (team_score between 0 and 25),
  constraint pitch_scores_ask_score_range check (ask_score between 0 and 25),
  constraint pitch_scores_form_response_id_unique unique (form_response_id)
);

create index pitch_scores_twin_id_idx on public.pitch_scores(twin_id);
create index pitch_scores_team_id_idx on public.pitch_scores(team_id);

alter table public.pitch_scores enable row level security;
-- Zero policies: no client (anon or authenticated) can read or write this
-- table directly. Writes come only from the webhook route using the
-- service-role client; reads go only through the RPCs below.
