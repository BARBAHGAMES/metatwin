import { useEffect, useState } from "react";
import { Github, Flame, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GITHUB_CONNECT_PATH, GITHUB_REFRESH_PATH, type GithubConnection } from "@/lib/api-paths";
import { Button } from "@/components/ui/button";

// "Connect GitHub" uses Supabase's existing GitHub OAuth identity
// (linkIdentity) rather than a separate OAuth App — same provider this app
// already uses for "Sign in with GitHub", just requesting read:user and
// attaching the resulting identity to the already-logged-in twin instead of
// starting a new session. The GitHub-side redirect lands back here with
// ?github=connecting, at which point the freshly-granted provider_token is
// in the Supabase session and gets handed to the server once to run the
// first sync and store it for future Refreshes.
const CONNECTING_PARAM = "github";
const CONNECTING_VALUE = "connecting";

function removeConnectingParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete(CONNECTING_PARAM);
  window.history.replaceState({}, "", url.toString());
}

export function GithubActivityCard() {
  const [connection, setConnection] = useState<GithubConnection | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState<"connect" | "refresh" | "disconnect" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finishConnecting() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const providerToken = session?.provider_token;
      if (!session || !providerToken) {
        toast.error("GitHub didn't return an access token — try connecting again.");
        removeConnectingParam();
        return;
      }
      setBusy("connect");
      try {
        const res = await fetch(GITHUB_CONNECT_PATH, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ provider_token: providerToken }),
        });
        const body = (await res.json()) as GithubConnection & { error?: string };
        if (!res.ok || body.error) {
          toast.error(body.error ?? "Couldn't connect GitHub — try again.");
        } else if (!cancelled) {
          setConnection(body);
          toast.success(`Connected GitHub as ${body.github_username}.`);
        }
      } catch {
        toast.error("Couldn't reach GitHub — try again.");
      } finally {
        removeConnectingParam();
        if (!cancelled) setBusy(null);
      }
    }

    async function loadExisting() {
      const { data, error } = await supabase.rpc("get_my_github_connection");
      if (cancelled) return;
      if (!error && data) setConnection(data as unknown as GithubConnection);
      else setConnection(null);
    }

    if (new URLSearchParams(window.location.search).get(CONNECTING_PARAM) === CONNECTING_VALUE) {
      finishConnecting();
    } else {
      loadExisting();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    const { error } = await supabase.auth.linkIdentity({
      provider: "github",
      // public_repo (not the broader "repo") alongside read:user: GitHub's
      // GraphQL repository listing needs it even for public-only repos, but
      // it still never grants access to private repos.
      options: { scopes: "read:user public_repo", redirectTo: `${window.location.origin}/dashboard?${CONNECTING_PARAM}=${CONNECTING_VALUE}` },
    });
    if (error) toast.error(error.message);
    // On success the browser navigates away to GitHub, so nothing more to do here.
  }

  async function refresh() {
    setBusy("refresh");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Sign in to refresh.");
        return;
      }
      const res = await fetch(GITHUB_REFRESH_PATH, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = (await res.json()) as GithubConnection & { error?: string };
      if (!res.ok || body.error) {
        toast.error(body.error ?? "Couldn't refresh — try again.");
        return;
      }
      setConnection(body);
      toast.success("GitHub activity refreshed.");
    } catch {
      toast.error("Couldn't reach GitHub — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      const { error } = await supabase.rpc("disconnect_github");
      if (error) {
        toast.error(error.message);
        return;
      }
      setConnection(null);
      toast.success("GitHub disconnected.");
    } finally {
      setBusy(null);
    }
  }

  if (connection === undefined) {
    return (
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">GitHub activity</h3>
      </div>
    );
  }

  if (!connection) {
    return (
      <div>
        <h3 className="font-semibold">GitHub activity</h3>
        <p className="mt-1 text-sm text-muted-foreground">Connect GitHub to show contribution activity on your profile — proof of consistent building, visible to anyone evaluating you.</p>
        <Button variant="outline" className="mt-4" onClick={connect} disabled={busy === "connect"}>
          <Github /> {busy === "connect" ? "Connecting…" : "Connect GitHub"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">GitHub activity</h3>
          <a href={`https://github.com/${connection.github_username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-electric hover:underline">
            @{connection.github_username} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={busy === "refresh"}>
            <RefreshCw className={busy === "refresh" ? "animate-spin" : ""} /> {busy === "refresh" ? "Refreshing…" : "Refresh"}
          </Button>
          <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy === "disconnect"} className="text-muted-foreground">
            Disconnect
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-2xl font-semibold">{connection.total_contributions_year}</p>
          <p className="text-xs text-muted-foreground">contributions (1y)</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="flex items-center gap-1 text-2xl font-semibold">{connection.current_streak_days}{connection.current_streak_days > 0 && <Flame className="h-4 w-4 text-electric" />}</p>
          <p className="text-xs text-muted-foreground">day streak</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-2xl font-semibold">{connection.public_repo_count}</p>
          <p className="text-xs text-muted-foreground">public repos</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="truncate text-[0.95rem] font-semibold sm:text-2xl" title={connection.top_languages[0]?.language}>{connection.top_languages[0]?.language ?? "—"}</p>
          <p className="text-xs text-muted-foreground">top language</p>
        </div>
      </div>
      {connection.top_languages.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {connection.top_languages.map((l) => (
            <span key={l.language} className="rounded-md bg-electric-soft px-2 py-0.5 text-xs text-accent-foreground">{l.language} · {l.pct}%</span>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Visible on your public profile as contribution activity, streak, languages and repo count — never private repo names or content.</p>
    </div>
  );
}
