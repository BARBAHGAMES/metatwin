drop function public.list_public_twins();

create function public.list_public_twins()
returns table (
  handle text,
  name text,
  headline text,
  institution text,
  photo_url text,
  github_username text,
  github_total_contributions_year integer
)
language sql
stable
security definer
set search_path = public
as $$
  select t.handle, t.name, t.headline, t.institution, t.photo_url,
         gh.github_username, gh.total_contributions_year
  from public.twins t
  left join public.github_connections gh on gh.twin_id = t.id
  where t.visibility = 'public' and t.is_adult and t.handle is not null
  order by t.updated_at desc;
$$;

revoke all on function public.list_public_twins() from public;
grant execute on function public.list_public_twins() to anon, authenticated;
