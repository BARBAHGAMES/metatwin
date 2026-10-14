create table public.collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_twin_id uuid not null references public.twins (id) on delete cascade,
  requester_twin_id uuid not null references public.twins (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint collaboration_requests_message_length check (message is null or char_length(message) <= 500),
  constraint collaboration_requests_not_self check (owner_twin_id <> requester_twin_id),
  constraint collaboration_requests_project_owner_fkey
    foreign key (project_id, owner_twin_id) references public.projects (id, twin_id) on delete cascade,
  unique (project_id, requester_twin_id)
);

create index collaboration_requests_owner_idx on public.collaboration_requests (owner_twin_id);
create index collaboration_requests_requester_idx on public.collaboration_requests (requester_twin_id);
create index collaboration_requests_project_idx on public.collaboration_requests (project_id);

alter table public.collaboration_requests enable row level security;

create policy "collaboration_requests: requester select" on public.collaboration_requests
  for select to authenticated using ((select auth.uid()) = requester_twin_id);
create policy "collaboration_requests: owner select" on public.collaboration_requests
  for select to authenticated using ((select auth.uid()) = owner_twin_id);
create policy "collaboration_requests: requester insert" on public.collaboration_requests
  for insert to authenticated with check ((select auth.uid()) = requester_twin_id);
create policy "collaboration_requests: requester withdraw" on public.collaboration_requests
  for delete to authenticated using ((select auth.uid()) = requester_twin_id and status = 'pending');
create policy "collaboration_requests: owner decline" on public.collaboration_requests
  for update to authenticated
  using ((select auth.uid()) = owner_twin_id and status = 'pending')
  with check ((select auth.uid()) = owner_twin_id and status = 'declined');

grant select, insert, delete on public.collaboration_requests to authenticated;
grant update (status, responded_at) on public.collaboration_requests to authenticated;
