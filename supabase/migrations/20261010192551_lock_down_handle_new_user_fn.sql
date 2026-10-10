-- get_advisors(security) flagged handle_new_user() as callable by anon and
-- authenticated via /rest/v1/rpc/handle_new_user — PostgREST exposes every
-- public-schema function by default. It only needs to run as the trigger's
-- security definer, never as a direct RPC call.
revoke all on function public.handle_new_user() from public, anon, authenticated;
