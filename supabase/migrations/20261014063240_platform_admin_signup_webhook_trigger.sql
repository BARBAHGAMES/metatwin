-- Mirrors notify_school_admin_signup_webhook() exactly: pg_net POST on new
-- platform_admins row, shared metatwin_webhook_secret from Vault.
create or replace function public.notify_platform_admin_signup_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net, auth
as $$
declare
  v_secret text;
  v_email text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'metatwin_webhook_secret';

  select email into v_email from auth.users where id = new.id;

  perform net.http_post(
    url := 'https://metatwin.metaglobetechnologies.co.ke/api/webhooks/platform-admin-signup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('record', jsonb_build_object(
      'full_name', new.full_name,
      'email', v_email,
      'requested_at', new.requested_at
    ))
  );
  return new;
end;
$$;

revoke all on function public.notify_platform_admin_signup_webhook() from public, anon, authenticated;

create trigger on_platform_admin_created_notify_webhook
  after insert on public.platform_admins
  for each row execute function public.notify_platform_admin_signup_webhook();
