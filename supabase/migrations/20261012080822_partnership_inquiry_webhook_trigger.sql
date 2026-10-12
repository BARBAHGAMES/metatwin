-- Fires the /api/webhooks/partnership-inquiry route on every new row, so the
-- internal notification email sends without a manual Database Webhook
-- dashboard setup. Same bearer secret (Supabase Vault, 'metatwin_webhook_secret')
-- and pg_net pattern as notify_new_user_webhook.
create or replace function public.notify_partnership_inquiry_webhook()
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
    url := 'https://metatwin.metaglobetechnologies.co.ke/api/webhooks/partnership-inquiry',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('record', jsonb_build_object(
      'institution_name', new.institution_name,
      'contact_name', new.contact_name,
      'email', new.email,
      'phone', new.phone,
      'message', new.message,
      'created_at', new.created_at
    ))
  );
  return new;
end;
$$;

revoke all on function public.notify_partnership_inquiry_webhook() from public, anon, authenticated;

create trigger on_partnership_inquiry_created_notify_webhook
  after insert on public.partnership_inquiries
  for each row execute function public.notify_partnership_inquiry_webhook();
