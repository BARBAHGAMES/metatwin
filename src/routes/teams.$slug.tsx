import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Trophy, Users } from "lucide-react";
import { fetchTeamPublicProfile, type PublicTeamProfile } from "@/lib/teams";
import { Card, HeroBackdrop, SampleAvatar, Section } from "@/components/site";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/teams/$slug")({
  loader: async ({ params }) => {
    const team = await fetchTeamPublicProfile(params.slug);
    if (!team) throw notFound();
    return { team };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.team;
    const title = t?.name ? `${t.name} · MetaTwin` : "MetaTwin team";
    const description = t?.description ?? "A team of students building and pitching together on MetaTwin.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  component: PublicTeamPage,
  notFoundComponent: TeamNotFound,
  errorComponent: TeamError,
});

function TeamError() {
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">We couldn't load this team</h1>
      <p className="mt-3 text-sm text-muted-foreground">Something went wrong on our side. Please try again in a moment.</p>
      <Button className="mt-6" onClick={() => window.location.reload()}>Try again</Button>
    </main>
  );
}

function TeamNotFound() {
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">This team isn't available</h1>
      <p className="mt-3 text-sm text-muted-foreground">The link may be wrong, or the team has gone private.</p>
      <Button asChild variant="hero" className="mt-6"><Link to="/">Back to MetaTwin</Link></Button>
    </main>
  );
}

function initialsOf(name: string | null): string {
  return (name ?? "?").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function PublicTeamPage() {
  const { team } = Route.useLoaderData() as { team: PublicTeamProfile };

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-5xl px-5 py-14 md:py-20">
          <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-electric"><Users className="h-3.5 w-3.5" /> MetaTwin team</p>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl">{team.name}</h1>
          {team.description && <p className="mt-3 max-w-2xl text-lg text-ink-muted">{team.description}</p>}
          <dl className="mt-8 flex flex-wrap gap-3 text-center">
            {([[team.member_count, "Members"], [team.projects.length, "Projects"]] as const).map(([v, l]) => (
              <div key={l} className="rounded-xl border border-ink-foreground/10 bg-ink-soft px-5 py-3">
                <dd className="font-display text-2xl font-semibold">{v}</dd>
                <dt className="text-xs text-ink-muted">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Section className="mx-auto grid max-w-5xl gap-10">
        {team.pitch_scores.length > 0 && (
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Trophy className="h-5 w-5" /> Pitch competition scores</h2>
            <ul className="mt-5 space-y-3">
              {team.pitch_scores.map((s, i) => (
                <li key={`${s.competition_name}-${s.event_date}-${i}`}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-display font-semibold">
                        {s.competition_name}{s.round_name && <span className="text-muted-foreground"> · {s.round_name}</span>}
                      </p>
                      <p className="text-2xl font-semibold">{s.total_score}<span className="text-sm text-muted-foreground">/100</span></p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Problem {s.problem_score} · Solution {s.solution_score} · Team {s.team_score} · Ask {s.ask_score}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-semibold">Members</h2>
          {team.members.length === 0 ? (
            <Card className="mt-5 border-dashed"><p className="text-sm text-muted-foreground">No public member profiles yet.</p></Card>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {team.members.map((m) => (
                <li key={m.handle}>
                  <Link to="/t/$handle" params={{ handle: m.handle }}>
                    <Card className="flex h-full items-center gap-3 transition hover:border-electric/40">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <SampleAvatar initials={initialsOf(m.name)} className="h-12 w-12 rounded-xl text-lg" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-display font-semibold">{m.name ?? `@${m.handle}`}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.role ?? m.headline ?? `@${m.handle}`}</p>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {team.member_count > team.members.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              {team.member_count - team.members.length} more member{team.member_count - team.members.length === 1 ? "" : "s"} on this team keep their own profile private.
            </p>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold">Projects</h2>
          {team.projects.length === 0 ? (
            <Card className="mt-5 border-dashed"><p className="text-sm text-muted-foreground">No projects listed yet.</p></Card>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {team.projects.map((p) => (
                <li key={p.id}>
                  <Card className="h-full">
                    <p className="font-display font-semibold">{p.title}</p>
                    {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-3 bg-muted/50">
          <p className="text-sm">Building something with others? Create your own team on MetaTwin.</p>
          <Button asChild variant="hero"><Link to="/signup">Build yours <ArrowRight /></Link></Button>
        </Card>
      </Section>
    </>
  );
}
