// Minimal ambient declaration for Cloudflare's built-in `cloudflare:workers`
// module — avoids pulling in the full @cloudflare/workers-types package,
// which redeclares DOM globals (Request/Response/etc.) that conflict with
// this project's "DOM" lib. Only declares the one export this app uses.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
