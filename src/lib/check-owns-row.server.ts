// Shared "does this row belong to the caller" check for *.server.ts routes
// that act on a project or AI-employee row by id. Previously copy-pasted
// per route (github-sync-route, pitch-feedback-sync-route) -- factored out
// so a future fix (a different error shape, an RLS-bypass edge case) lands
// once instead of needing to be found and reapplied in every copy.
//
// Validates the id looks like a UUID before ever querying: an arbitrary
// string (or a client-settable field, so can't be trusted) would otherwise
// hit Postgres's own type-cast error on `.eq("id", id)` and surface as a
// confusing 500 with a raw DB error message instead of a clean 400.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkOwnsRow(
  table: "projects" | "ai_employees",
  id: string,
  callerId: string,
  notFoundMessage: string,
  forbiddenMessage: string,
): Promise<Response | null> {
  if (!UUID_PATTERN.test(id)) {
    return new Response(JSON.stringify({ error: "Bad request: invalid id." }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const { data: row, error: lookupError } = await supabaseAdmin.from(table).select("id, twin_id").eq("id", id).maybeSingle();
  if (lookupError) {
    return new Response(JSON.stringify({ error: lookupError.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
  if (!row) {
    return new Response(JSON.stringify({ error: notFoundMessage }), { status: 404, headers: { "content-type": "application/json" } });
  }
  if (row.twin_id !== callerId) {
    return new Response(JSON.stringify({ error: forbiddenMessage }), { status: 403, headers: { "content-type": "application/json" } });
  }
  return null;
}
