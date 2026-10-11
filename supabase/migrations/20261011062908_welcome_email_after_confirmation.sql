-- P0-4: send the welcome email only for CONFIRMED addresses.
-- Before: the trigger fired on every auth.users INSERT, so typing a stranger's
-- address into signup made us email them (from the shared sending domain).
-- Now it fires when email_confirmed_at goes from null to set, or when a user is
-- inserted already confirmed (OAuth / admin-created). The function also can
-- never block signup or confirmation: a missing secret or a failed pg_net
-- call just logs a warning.

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

  if v_secret is null then
    raise warning 'metatwin_webhook_secret missing from Vault; welcome email skipped';
    return new;
  end if;

  perform net.http_post(
    url := 'https://metatwin.metaglobetechnologies.co.ke/api/webhooks/new-user',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('record', jsonb_build_object('email', new.email))
  );
  return new;
exception when others then
  raise warning 'notify_new_user_webhook failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.notify_new_user_webhook() from public, anon, authenticated;

drop trigger on_auth_user_created_notify_webhook on auth.users;

create trigger on_auth_user_confirmed_notify_webhook
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.notify_new_user_webhook();

create trigger on_auth_user_inserted_confirmed_notify_webhook
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.notify_new_user_webhook();
