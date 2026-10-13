import { Link } from "@tanstack/react-router";
import { Trophy, Users2 } from "lucide-react";
import type { MyTeam } from "@/lib/teams";
import { safeHref } from "@/lib/url";
import { Card, Section } from "@/components/site";
import { PitchDeckButton, PitchVideoButton } from "@/components/PitchMedia";

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// The signed-in "my team" view — distinct from the public /teams/$slug page.
// Shows every teammate (private members included, since fellow members
// already know each other) and every team-tagged project regardless of its
// owner's own profile visibility, matching get_team_public_profile()'s
// "team opt-in is independent" principle extended to this member-only view.
export function TeamDashboardView({ team }: { team: MyTeam }) {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <div className="relative mx-auto max-w-7xl px-5 py-12 md:py-16">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs text-ink-muted">Team</p>
            {team.is_creator && (
              <Link
                to="/dashboard"
                className="text-xs text-ink-muted underline-offset-4 hover:text-ink-foreground hover:underline"
              >
                Manage team →
              </Link>
            )}
          </div>
          <div className="hero-rise mt-8 grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
            {team.avatar_url ? (
              <img
                src={team.avatar_url}
                alt=""
                className="h-40 w-40 rounded-3xl object-cover shadow-glow ring-2 ring-electric/40 md:h-52 md:w-52"
              />
            ) : (
              <div className="grid h-40 w-40 place-items-center rounded-3xl bg-electric/15 text-4xl font-semibold text-electric shadow-glow ring-2 ring-electric/40 md:h-52 md:w-52">
                {initialsOf(team.name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] md:text-6xl">
                {team.name}
              </h1>
              {team.description && (
                <p className="mt-2 max-w-2xl text-lg text-ink-muted">{team.description}</p>
              )}
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="font-display text-xl font-semibold">{team.members.length}</p>
                  <p className="text-xs text-ink-muted">Builders</p>
                </div>
                <div>
                  <p className="font-display text-xl font-semibold">{team.projects.length}</p>
                  <p className="text-xs text-ink-muted">Projects</p>
                </div>
                <div>
                  <p className="font-display text-xl font-semibold capitalize">{team.visibility}</p>
                  <p className="text-xs text-ink-muted">Visibility</p>
                </div>
              </div>
              {team.visibility === "public" && team.slug && (
                <Link
                  to="/teams/$slug"
                  params={{ slug: team.slug }}
                  className="mt-4 inline-block text-sm text-electric hover:underline"
                >
                  View public team page →
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <Section className="grid gap-10">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Users2 className="h-5 w-5" /> The team
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {team.members.map((m) => (
              <li key={m.twin_id}>
                <Card className="h-full">
                  <p className="font-medium">{m.name ?? m.handle ?? "Teammate"}</p>
                  <p className="text-xs text-muted-foreground">{m.role ?? "Builder"}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>

        {team.projects.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold">Team projects</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {team.projects.map((p) => {
                const artifact = safeHref(p.artifact_url);
                const writeup = safeHref(p.writeup_url);
                const deck = safeHref(p.pitch_deck_url);
                const video = safeHref(p.pitch_video_url);
                return (
                  <li key={p.id}>
                    <Card className="h-full">
                      <p className="font-display font-semibold">{p.title}</p>
                      {p.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {artifact && (
                          <a
                            href={artifact}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-electric hover:underline"
                          >
                            View work
                          </a>
                        )}
                        {writeup && (
                          <a
                            href={writeup}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-electric hover:underline"
                          >
                            Write-up
                          </a>
                        )}
                        {deck && (
                          <PitchDeckButton
                            url={deck}
                            label="Pitch deck"
                            className="flex items-center gap-1 text-electric hover:underline"
                          />
                        )}
                        {video && (
                          <PitchVideoButton
                            url={video}
                            label="Pitch video"
                            className="flex items-center gap-1 text-electric hover:underline"
                          />
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {team.pitch_scores.length > 0 && (
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <Trophy className="h-5 w-5" /> Pitch competition scores
            </h2>
            <ul className="mt-5 space-y-3">
              {team.pitch_scores.map((s) => (
                <li key={s.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-display font-semibold">
                        {s.competition_name}
                        {s.round_name && (
                          <span className="text-muted-foreground"> · {s.round_name}</span>
                        )}
                      </p>
                      <p className="text-2xl font-semibold">
                        {s.total_score}
                        <span className="text-sm text-muted-foreground">/100</span>
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Problem {s.problem_score} · Solution {s.solution_score} · Team {s.team_score}{" "}
                      · Ask {s.ask_score}
                    </p>
                    {s.judge_comment && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        "{s.judge_comment}"{s.judge_name && <span> — {s.judge_name}</span>}
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
