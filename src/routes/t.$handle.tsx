import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, GitFork, Github, MapPin, Rocket, Star } from "lucide-react";
import { fetchPublicProfile, type PublicCapability, type PublicProfile } from "@/lib/public-profile";
import { safeHref } from "@/lib/url";
import { Card, HeroBackdrop, SampleAvatar, Section, StatusBadge } from "@/components/site";
import { Button } from "@/components/ui/button";
import { TwinChat } from "@/components/TwinChat";

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
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">We couldn't load this MetaTwin</h1>
      <p className="mt-3 text-sm text-muted-foreground">Something went wrong on our side. Please try again in a moment.</p>
      <Button className="mt-6" onClick={() => window.location.reload()}>Try again</Button>
    </main>
  );
}

function ProfileNotFound() {
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">This MetaTwin isn't available</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The link may be wrong, or the student has made their profile private.
      </p>
      <Button asChild variant="hero" className="mt-6"><Link to="/">Back to MetaTwin</Link></Button>
    </main>
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
                const githubHref = safeHref(p.github?.url ?? null);
                return (
                  <li key={p.id}>
                    <Card className="h-full">
                      <p className="font-display font-semibold">{p.title}</p>
                      {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {href && <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-electric hover:underline">View work</a>}
                        {writeup && <a href={writeup} target="_blank" rel="noopener noreferrer nofollow" className="text-electric hover:underline">Write-up</a>}
                        {deck && <a href={deck} target="_blank" rel="noopener noreferrer nofollow" className="text-electric hover:underline">Pitch deck</a>}
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
