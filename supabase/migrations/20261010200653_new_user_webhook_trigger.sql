-- Fires the /api/webhooks/new-user route on every auth.users signup, so the
-- welcome email sends without a manual Database Webhook dashboard setup.
-- The bearer secret lives in Supabase Vault (vault.create_secret, run
-- directly against the live DB — never committed to a migration file or
-- git), looked up by name here rather than embedded in this function.
create extension if not exists pg_net;

create or replace function public.notify_new_user_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'metatwin_webhook_secret';

  perform net.http_post(
    url := 'https://metatwin.metaglobetechnologies.co.ke/api/webhooks/new-user',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('record', jsonb_build_object('email', new.email))
  );
  return new;
end;
$$;

revoke all on function public.notify_new_user_webhook() from public, anon, authenticated;

create trigger on_auth_user_created_notify_webhook
  after insert on auth.users
  for each row execute function public.notify_new_user_webhook();
