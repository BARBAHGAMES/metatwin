import { NEW_USER_WEBHOOK_PATH, GITHUB_SYNC_PATH, TWIN_CHAT_PATH, OPPORTUNITIES_SCOUT_PATH } from "./lib/api-paths";
import { handleNewUserWebhook } from "./lib/new-user-webhook-route.server";
import { handleGitHubSync } from "./lib/github-sync-route.server";
import { handleTwinChat, handleOpportunitiesScout, type CloudflareEnv } from "./lib/twin-ai-route.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; " +
    "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co;",
};

function withSecurityHeaders(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  const wrapped = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!wrapped.headers.has(name)) wrapped.headers.set(name, value);
  }
  return wrapped;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    if (url.pathname === NEW_USER_WEBHOOK_PATH && request.method === "POST") {
      try {
        return await handleNewUserWebhook(request);
      } catch (error) {
        console.error("[new-user-webhook route]", error);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (url.pathname === GITHUB_SYNC_PATH && request.method === "POST") {
      try {
        return await handleGitHubSync(request);
      } catch (error) {
        console.error("[github-sync route]", error);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (url.pathname === TWIN_CHAT_PATH && request.method === "POST") {
      try {
        return await handleTwinChat(request, env as CloudflareEnv);
      } catch (error) {
        console.error("[twin-chat route]", error);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (url.pathname === OPPORTUNITIES_SCOUT_PATH && request.method === "POST") {
      try {
        return await handleOpportunitiesScout(request, env as CloudflareEnv);
      } catch (error) {
        console.error("[opportunities-scout route]", error);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(response);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(new Response("Something went wrong.", { status: 500 }));
    }
  },
};
