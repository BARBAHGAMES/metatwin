-- Creates the student's one-per-user twins row automatically on signup, so
-- it exists as soon as auth.users does (the dashboard upserts into it, but
-- having the row created here means the new-user webhook that fires the
-- welcome email isn't racing the client's first save).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.twins (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
