-- get_advisors(security) flagged pg_net as installed in the public schema.
-- Its functions live in the fixed "net" schema regardless (net.http_post),
-- so this only relocates the extension's own catalog entry.
drop extension if exists pg_net;
create extension if not exists pg_net schema extensions;
