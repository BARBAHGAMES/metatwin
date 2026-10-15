// Shared bearer-token auth for *.server.ts routes acting on behalf of a
// signed-in twin: verifies the token against Supabase Auth and returns the
// caller's user id, or a ready-to-return 401 Response. Previously
// copy-pasted per route file (mpesa-route, github-connect-route,
// twin-ai-route inline) — factored out so a future fix to this check (e.g.
// the Bearer-prefix parsing, or a GoTrue error edge case) lands everywhere
// at once instead of needing to be found and re-applied in each copy.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function authenticateTwin(request: Request, message = "Sign in to continue."): Promise<string | Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: message }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: message }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return userData.user.id;
}
