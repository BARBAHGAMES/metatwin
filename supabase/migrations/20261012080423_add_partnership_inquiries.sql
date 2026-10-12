create table public.partnership_inquiries (
  id uuid primary key default gen_random_uuid(),
  institution_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint partnership_inquiries_institution_name_length check (char_length(institution_name) between 1 and 200),
  constraint partnership_inquiries_contact_name_length check (char_length(contact_name) between 1 and 120),
  constraint partnership_inquiries_email_length check (char_length(email) between 3 and 254),
  constraint partnership_inquiries_phone_length check (phone is null or char_length(phone) <= 40),
  constraint partnership_inquiries_message_length check (message is null or char_length(message) <= 2000),
  constraint partnership_inquiries_status_values check (status in ('new', 'contacted', 'closed'))
);

create index partnership_inquiries_created_at_idx on public.partnership_inquiries (created_at desc);

alter table public.partnership_inquiries enable row level security;

-- No select/insert policies for anon or authenticated: the table itself
-- stays fully locked down (no direct client access at all, in either
-- direction). The only way in is the validated RPC below; the only way to
-- read these is via the Supabase dashboard (service role), matching this
-- product's current "contact details coming soon, manual follow-up" stage.

create or replace function public.submit_partnership_inquiry(
  p_institution_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_institution_name is null or char_length(trim(p_institution_name)) = 0 or char_length(p_institution_name) > 200 then
    raise exception 'institution name is required';
  end if;
  if p_contact_name is null or char_length(trim(p_contact_name)) = 0 or char_length(p_contact_name) > 120 then
    raise exception 'contact name is required';
  end if;
  if p_email is null or char_length(trim(p_email)) = 0 or char_length(p_email) > 254 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'a valid email is required';
  end if;
  if p_phone is not null and char_length(p_phone) > 40 then
    raise exception 'phone is too long';
  end if;
  if p_message is not null and char_length(p_message) > 2000 then
    raise exception 'message is too long';
  end if;

  insert into public.partnership_inquiries (institution_name, contact_name, email, phone, message)
  values (trim(p_institution_name), trim(p_contact_name), trim(p_email), nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_message, '')), ''));
end;
$$;

revoke all on function public.submit_partnership_inquiry(text, text, text, text, text) from public;
grant execute on function public.submit_partnership_inquiry(text, text, text, text, text) to anon, authenticated;
