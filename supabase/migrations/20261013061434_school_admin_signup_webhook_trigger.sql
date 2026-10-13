-- Fires on every new school_admins row (always starts 'pending') so Andrew
-- gets emailed to go verify it manually — same bearer secret/pg_net pattern
-- as notify_partnership_inquiry_webhook. Reads the signup email from
-- auth.users (school_admins itself doesn't store it, same as twins).
create or replace function public.notify_school_admin_signup_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net, auth
as $$
declare
  v_secret text;
  v_email text;
  v_university_name text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'metatwin_webhook_secret';

  select email into v_email from auth.users where id = new.id;
  select name into v_university_name from public.universities where id = new.university_id;

  perform net.http_post(
    url := 'https://metatwin.metaglobetechnologies.co.ke/api/webhooks/school-admin-signup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('record', jsonb_build_object(
      'full_name', new.full_name,
      'email', v_email,
      'phone', new.phone,
      'university_name', v_university_name,
      'requested_at', new.requested_at
    ))
  );
  return new;
end;
$$;

revoke all on function public.notify_school_admin_signup_webhook() from public, anon, authenticated;

create trigger on_school_admin_created_notify_webhook
  after insert on public.school_admins
  for each row execute function public.notify_school_admin_signup_webhook();
