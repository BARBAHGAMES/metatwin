import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Bot, ExternalLink, Flame, GitFork, Github, GraduationCap, MapPin, MessageSquare, Rocket, Star, Users2, Trophy } from "lucide-react";
import { buildPublicProjectJourney, fetchPublicProfile, type PublicCapability, type PublicProfile } from "@/lib/public-profile";
import { STAGE_LABELS, type ProjectStage } from "@/lib/project-stage";
import { safeHref } from "@/lib/url";
import { Card, HeroBackdrop, SampleAvatar, Section, StatusBadge } from "@/components/site";
import { Button } from "@/components/ui/button";
import { TwinChat } from "@/components/TwinChat";
import { PitchDeckButton, PitchVideoButton } from "@/components/PitchMedia";
import { Journey } from "@/components/Journey";
import { ProblemSolutionCards } from "@/components/ProjectExtras";
import { VisitorFeedbackButton } from "@/components/VisitorFeedbackDialog";
import { DECK_VIEW_PATH } from "@/lib/api-paths";
import { supabase } from "@/integrations/supabase/client";

// Fire-and-forget: tell the server a visitor opened this deck (counted once per
// visitor per day). Signed-in visitors send their token so the student's own
// opens aren't counted.
async function recordDeckView(handle: string, projectId: string) {
  try {
    const body = JSON.stringify({ handle, project_id: projectId });
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token && navigator.sendBeacon?.(DECK_VIEW_PATH, new Blob([body], { type: "application/json" }))) return;
    await fetch(DECK_VIEW_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body,
      keepalive: true,
    });
  } catch {
    // never block opening the deck
  }
}

export const Route = createFileRoute("/t/$handle")({
  loader: async ({ params }) => {
    const profile = await fetchPublicProfile(params.handle);
    if (!profile) throw notFound();
    return { profile };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.profile;
    const title = p?.name ? `${p.name} · MetaTwin` : "MetaTwin profile";
    const description = p?.headline ?? "A student's MetaTwin: capabilities, projects and evidence.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        // Profiles are shareable by link, not something we ask search engines to index.
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  component: PublicProfilePage,
  notFoundComponent: ProfileNotFound,
  errorComponent: ProfileError,
});

function ProfileError() {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">We couldn't load this MetaTwin</h1>
      <p className="mt-3 text-sm text-muted-foreground">Something went wrong on our side. Please try again in a moment.</p>
      <Button className="mt-6" onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}

function ProfileNotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">This MetaTwin isn't available</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The link may be wrong, or the student has made their profile private.
      </p>
      <Button asChild variant="hero" className="mt-6"><Link to="/">Back to MetaTwin</Link></Button>
    </div>
  );
}

function initialsOf(name: string | null): string {
  return (name ?? "?").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function capabilityStatus(c: PublicCapability): "self" | "evidence" | "reviewed" {
  if (c.evidence.some((e) => e.reviewed)) return "reviewed";
  return c.evidence_count > 0 ? "evidence" : "self";
}

function PublicProfilePage() {
  const { profile } = Route.useLoaderData() as { profile: PublicProfile };
  const firstName = profile.name?.trim().split(/\s+/)[0] || "the student";
  const withEvidence = profile.capabilities.filter((c) => c.evidence_count > 0).length;

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-5xl px-5 py-14 md:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">MetaTwin</p>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-center">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="" className="h-28 w-28 rounded-3xl object-cover shadow-glow ring-2 ring-electric/40" />
            ) : (
              <SampleAvatar initials={initialsOf(profile.name)} className="h-28 w-28 rounded-3xl text-4xl shadow-glow ring-2 ring-electric/40" />
            )}
            <div className="min-w-0">
              <h1 className="text-4xl font-bold md:text-5xl">{profile.name || "MetaTwin student"}</h1>
              {profile.headline && <p className="mt-2 text-lg text-ink-muted">{profile.headline}</p>}
              {(profile.institution || profile.programme) && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin className="h-4 w-4" />
                  {[profile.institution, profile.programme].filter(Boolean).join(" · ")}
                </p>
              )}
              {profile.teams.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.teams.map((t) => (
                    <Link
                      key={t.slug}
                      to="/teams/$slug"
                      params={{ slug: t.slug }}
                      className="flex items-center gap-1 rounded-full border border-ink-foreground/15 bg-ink-soft px-3 py-1 text-xs text-ink-muted hover:text-ink-foreground"
                    >
                      <Users2 className="h-3 w-3" /> {t.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          <dl className="mt-8 flex flex-wrap gap-3 text-center">
            {([
              [profile.capabilities.length, "Capabilities"],
              [withEvidence, "With evidence"],
              [profile.projects.length, "Projects"],
            ] as const).map(([v, l]) => (
              <div key={l} className="rounded-xl border border-ink-foreground/10 bg-ink-soft px-5 py-3">
                <dd className="font-display text-2xl font-semibold">{v}</dd>
                <dt className="text-xs text-ink-muted">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Section className="mx-auto grid max-w-5xl gap-10">
        {profile.github_activity && (
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Github className="h-5 w-5" /> GitHub activity</h2>
            <Card className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <a href={`https://github.com/${profile.github_activity.username}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm font-medium text-electric hover:underline">
                  @{profile.github_activity.username} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-2xl font-semibold">{profile.github_activity.total_contributions_year}</p>
                  <p className="text-xs text-muted-foreground">contributions (1y)</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="flex items-center gap-1 text-2xl font-semibold">
                    {profile.github_activity.current_streak_days}
                    {profile.github_activity.current_streak_days > 0 && <Flame className="h-4 w-4 text-electric" />}
                  </p>
                  <p className="text-xs text-muted-foreground">day streak</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-2xl font-semibold">{profile.github_activity.public_repo_count}</p>
                  <p className="text-xs text-muted-foreground">public repos</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="truncate text-[0.95rem] font-semibold sm:text-2xl" title={profile.github_activity.top_languages[0]?.language}>{profile.github_activity.top_languages[0]?.language ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">top language</p>
                </div>
              </div>
              {profile.github_activity.top_languages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.github_activity.top_languages.map((l) => (
                    <span key={l.language} className="rounded-md bg-electric-soft px-2 py-0.5 text-xs text-accent-foreground">{l.language} · {l.pct}%</span>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {profile.pitch_scores.length > 0 && (
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Trophy className="h-5 w-5" /> Pitch competition scores</h2>
            <ul className="mt-5 space-y-3">
              {profile.pitch_scores.map((s, i) => (
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

        {profile.ai_employees.length > 0 && (
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Bot className="h-5 w-5" /> AI employees</h2>
            <p className="mt-1 text-sm text-muted-foreground">Shown separately — AI work never counts as {profile.name?.split(" ")[0] ?? "the student"}'s own evidence.</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {profile.ai_employees.map((e) => {
                const href = safeHref(e.link_url);
                return (
                  <li key={e.id}>
                    <Card className="h-full">
                      <p className="font-display font-semibold">{e.name} <span className="ml-1 rounded bg-electric-soft px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground">AI</span></p>
                      <p className="text-xs text-muted-foreground">{[e.role, e.platform].filter(Boolean).join(" · ")}</p>
                      {e.description && <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>}
                      {href && <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 flex items-center gap-1 text-sm text-electric hover:underline">View <ExternalLink className="h-3.5 w-3.5" /></a>}
                      {e.github_full_name && (
                        <div className="mt-2 flex items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {e.github_stars}</span>
                          <span className="flex items-center gap-1"><GitFork className="h-3 w-3" /> {e.github_forks}</span>
                          <span>{e.github_open_issues} open issues</span>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-semibold">Capabilities</h2>
          {profile.capabilities.length === 0 ? (
            <Card className="mt-5 border-dashed"><p className="text-sm text-muted-foreground">No capabilities listed yet.</p></Card>
          ) : (
            <ul className="mt-5 space-y-3">
              {profile.capabilities.map((c) => (
                <li key={c.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-display font-semibold">{c.skill}</p>
                        {c.category && <p className="text-xs text-muted-foreground">{c.category}</p>}
                      </div>
                      <StatusBadge status={capabilityStatus(c)} />
                    </div>
                    {c.evidence.length > 0 && (
                      <ul className="mt-3 space-y-2 border-t pt-3 text-sm">
                        {c.evidence.map((e) => {
                          const href = safeHref(e.link);
                          return (
                            <li key={e.id}>
                              {href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-electric hover:underline">{e.title}</a>
                              ) : (
                                <span>{e.title}</span>
                              )}
                              {e.note && <p className="mt-0.5 text-xs text-muted-foreground">{e.note}</p>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold">Projects</h2>
          {profile.projects.length === 0 ? (
            <Card className="mt-5 border-dashed"><p className="text-sm text-muted-foreground">No projects listed yet.</p></Card>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {profile.projects.map((p) => {
                const href = safeHref(p.artifact_url);
                const writeup = safeHref(p.writeup_url);
                const deck = safeHref(p.pitch_deck_url);
                const video = safeHref(p.pitch_video_url);
                const githubHref = safeHref(p.github?.url ?? null);
                return (
                  <li key={p.id}>
                    <Card className="h-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display font-semibold">{p.title}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{STAGE_LABELS[p.stage as ProjectStage]}</span>
                        {p.grade && (
                          <span className="flex items-center gap-1 rounded-full bg-electric-soft px-2 py-0.5 text-xs text-accent-foreground">
                            <GraduationCap className="h-3 w-3" /> {p.grade.rating_label} ({p.grade.rating_score}/4)
                          </span>
                        )}
                        {p.team && (
                          <Link
                            to="/teams/$slug"
                            params={{ slug: p.team.slug }}
                            className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Users2 className="h-3 w-3" /> {p.team.name}
                          </Link>
                        )}
                      </div>
                      {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                      {(p.problem_statement || p.proposed_solution) && (
                        <div className="mt-3">
                          <ProblemSolutionCards problemStatement={p.problem_statement} proposedSolution={p.proposed_solution} />
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {href && <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="py-2 text-electric hover:underline sm:py-0">View work</a>}
                        {writeup && <a href={writeup} target="_blank" rel="noopener noreferrer nofollow" className="py-2 text-electric hover:underline sm:py-0">Write-up</a>}
                        {deck && <PitchDeckButton url={deck} label="Pitch deck" onOpen={() => void recordDeckView(profile.handle, p.id)} className="flex items-center gap-1 py-2 text-electric hover:underline sm:py-0" />}
                        {video && <PitchVideoButton url={video} label="Pitch video" className="flex items-center gap-1 py-2 text-electric hover:underline sm:py-0" />}
                      </div>
                      {p.github && (
                        <a href={githubHref ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <Github className="h-3.5 w-3.5" /> {p.github.full_name}
                          <span className="ml-1 flex items-center gap-0.5"><Star className="h-3 w-3" />{p.github.stars}</span>
                          <span className="flex items-center gap-0.5"><GitFork className="h-3 w-3" />{p.github.forks}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {p.pitch_stats && p.pitch_stats.total_pitches > 0 && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Rocket className="h-3.5 w-3.5" /> {p.pitch_stats.total_pitches} pitches logged · {p.pitch_stats.conversion_pct ?? 0}% positive (reported by the student)
                        </p>
                      )}
                      {p.pitch_feedback && p.pitch_feedback.responses > 0 && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {p.pitch_feedback.overall != null && <>{p.pitch_feedback.overall.toFixed(1)}/10 · </>}
                          {p.pitch_feedback.responses} response{p.pitch_feedback.responses === 1 ? "" : "s"} (reported by the student)
                        </p>
                      )}
                      {(p.project_updates?.length ?? 0) > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Journey</p>
                          <div className="mt-3"><Journey steps={buildPublicProjectJourney(p)} /></div>
                        </div>
                      )}
                      <div className="mt-4 border-t pt-4">
                        <VisitorFeedbackButton handle={profile.handle} projectId={p.id} projectTitle={p.title} studentFirstName={firstName} />
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <TwinChat handle={profile.handle} name={profile.name?.split(" ")[0] ?? "this student"} />

        <p className="text-xs text-muted-foreground">
          Capabilities and evidence on this page were added by the student. "Evidence added" means the student attached supporting
          material; it has not been independently reviewed or verified. "Reviewed" means an invited reviewer submitted a comment on
          that specific item.
        </p>

        <Card className="flex flex-wrap items-center justify-between gap-3 bg-muted/50">
          <p className="text-sm">Students: build your own MetaTwin — a living record of what you can do, backed by evidence.</p>
          <Button asChild variant="hero"><Link to="/signup">Build yours <ArrowRight /></Link></Button>
        </Card>
      </Section>
    </>
  );
}
