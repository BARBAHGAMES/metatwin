// Backs the "Connect GitHub" / "Refresh" actions on the dashboard, and the
// aggregate signal surfaced on public profiles via get_public_profile and
// list_public_twins. Two entry points sharing one sync routine:
//   - /connect: client just finished supabase.auth.linkIdentity('github') and
//     sends the fresh provider_token here — we store it (for future refreshes
//     that don't need the student to re-authorize) and run the first sync.
//   - /refresh: no token from the client — we use the one already stored.
// GitHub's GraphQL endpoint doesn't support browser CORS, so this has to be a
// server route rather than a direct client-side fetch either way.
import type { GithubConnection } from "./api-paths";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function authenticateTwin(request: Request): Promise<string | Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Sign in to connect GitHub." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Sign in to connect GitHub." }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return userData.user.id;
}

type GithubGraphQLResponse = {
  data?: {
    viewer: {
      login: string;
      id: string;
      databaseId: number;
      avatarUrl: string;
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
        };
      };
      repositories: {
        totalCount: number;
        nodes: ({ primaryLanguage: { name: string } | null } | null)[];
      };
    };
  };
  errors?: { message: string }[];
};

function computeCurrentStreak(weeks: { contributionDays: { date: string; contributionCount: number }[] }[]): number {
  const days = weeks.flatMap((w) => w.contributionDays).sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i]!;
    if (day.contributionCount > 0) {
      streak++;
    } else if (day.date !== today) {
      // A contribution-free day breaks the streak — unless it's *today* and
      // the student just hasn't committed yet, which shouldn't zero out a
      // real streak that's still in progress.
      break;
    }
  }
  return streak;
}

function computeTopLanguages(nodes: ({ primaryLanguage: { name: string } | null } | null)[]): { language: string; pct: number }[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const lang = node?.primaryLanguage?.name;
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([language, count]) => ({ language, pct: Math.round((count / total) * 100) }));
}

type FetchStatsResult =
  | { ok: true; stats: GithubConnection & { github_user_id: number } }
  | { ok: false; error: string };

async function fetchGithubStats(accessToken: string): Promise<FetchStatsResult> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "metatwin-app",
    },
    body: JSON.stringify({
      query: `
        query {
          viewer {
            login
            id
            databaseId
            avatarUrl
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks { contributionDays { date contributionCount } }
              }
            }
            repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
              totalCount
              nodes { primaryLanguage { name } }
            }
          }
        }
      `,
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `GitHub API error ${res.status}` };
  }
  const json = (await res.json()) as GithubGraphQLResponse;
  if (json.errors?.length || !json.data) {
    return { ok: false, error: json.errors?.[0]?.message ?? "GitHub returned no data" };
  }
  const v = json.data.viewer;
  const calendar = v.contributionsCollection.contributionCalendar;

  return {
    ok: true,
    stats: {
      github_username: v.login,
      github_user_id: v.databaseId,
      avatar_url: v.avatarUrl,
      total_contributions_year: calendar.totalContributions,
      current_streak_days: computeCurrentStreak(calendar.weeks),
      top_languages: computeTopLanguages(v.repositories.nodes),
      public_repo_count: v.repositories.totalCount,
      connected_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
  };
}

export async function handleGithubConnect(request: Request): Promise<Response> {
  const twinIdOrResponse = await authenticateTwin(request);
  if (typeof twinIdOrResponse !== "string") return twinIdOrResponse;
  const twinId = twinIdOrResponse;

  let body: { provider_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const providerToken = typeof body.provider_token === "string" ? body.provider_token : "";
  if (!providerToken) {
    return new Response(JSON.stringify({ error: "Missing GitHub token — try connecting again." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const result = await fetchGithubStats(providerToken);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 502, headers: { "content-type": "application/json" } });
  }
  const { github_user_id, ...stats } = result.stats;

  const { error: dbError } = await supabaseAdmin
    .from("github_connections")
    .upsert({ twin_id: twinId, github_user_id, access_token: providerToken, ...stats }, { onConflict: "twin_id" });
  if (dbError) {
    return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify(stats satisfies GithubConnection), { status: 200, headers: { "content-type": "application/json" } });
}

export async function handleGithubRefresh(request: Request): Promise<Response> {
  const twinIdOrResponse = await authenticateTwin(request);
  if (typeof twinIdOrResponse !== "string") return twinIdOrResponse;
  const twinId = twinIdOrResponse;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("github_connections")
    .select("access_token, connected_at")
    .eq("twin_id", twinId)
    .maybeSingle();
  if (fetchError || !existing) {
    return new Response(JSON.stringify({ error: "No GitHub connection to refresh." }), { status: 404, headers: { "content-type": "application/json" } });
  }

  const result = await fetchGithubStats(existing.access_token);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 502, headers: { "content-type": "application/json" } });
  }
  // Excludes connected_at deliberately — a refresh updates activity stats,
  // not when the account was first connected.
  const { github_user_id, avatar_url, total_contributions_year, current_streak_days, top_languages, public_repo_count, last_synced_at, github_username } = result.stats;
  const freshStats = { github_username, avatar_url, total_contributions_year, current_streak_days, top_languages, public_repo_count, last_synced_at };
  const stats: GithubConnection = { ...freshStats, connected_at: existing.connected_at };

  const { error: dbError } = await supabaseAdmin
    .from("github_connections")
    .update({ github_user_id, ...freshStats })
    .eq("twin_id", twinId);
  if (dbError) {
    return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify(stats), { status: 200, headers: { "content-type": "application/json" } });
}
