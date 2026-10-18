import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileCheck2, AlertCircle } from "lucide-react";
import { capBySlug, projectById, statusMeta, type Capability, type Status } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { fetchMyCapability, fetchSkills, formatDate, type SkillRow } from "@/lib/real-data";
import { safeHref } from "@/lib/url";
import { LoadError } from "@/components/LoadError";
import { Button } from "@/components/ui/button";
import { Card, PageHero, SampleTag, Section, StatusBadge } from "@/components/site";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/capability/$slug")({
  // ?example=1 forces the fictional showcase even for a signed-in student.
  validateSearch: (search: Record<string, unknown>): { example?: true } =>
    search.example === true || search.example === "true" || search.example === "1" ? { example: true } : {},
  // A slug is valid if it is a sample capability (marketing showcase) or a real
  // skill in the database. Signed-in students see their own evidence for real
  // skills; everyone else sees the fictional sample.
  loader: async ({ params }) => {
    const sample = capBySlug(params.slug) ?? null;
    const skill = (await fetchSkills()).find((s) => s.slug === params.slug) ?? null;
    if (!sample && !skill) throw notFound();
    return { sample, skill };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.sample?.name ?? loaderData?.skill?.name ?? "Capability";
    const description = loaderData?.sample?.summary ?? "A capability and the evidence behind it.";
    return {
      meta: [
        { title: `${name} · Evidence on MetaTwin` },
        { name: "description", content: description },
        { property: "og:title", content: `${name} · MetaTwin` },
        { property: "og:description", content: description },
      ],
    };
  },
  notFoundComponent: () => <Section><p>Capability not found. <Link to="/profile" className="text-electric">Back to profile</Link></p></Section>,
  component: CapabilityPage,
});

function CapabilityPage() {
  const { sample, skill } = Route.useLoaderData();
  const { user, loading } = useAuth();
  const { example } = Route.useSearch();
  // While auth is resolving, render the sample so server and first client render match.
  if (user && !loading && skill && !example) return <RealCapability skill={skill} userId={user.id} />;
  if (sample) return <SampleCapability cap={sample} />;
  return (
    <Section>
      <p>
        {skill?.name ?? "This capability"} is tracked on real MetaTwins. <Link to="/login" className="text-electric">Log in</Link> to see your own evidence.
      </p>
    </Section>
  );
}

function RealCapability({ skill, userId }: { skill: SkillRow; userId: string }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchMyCapability>>>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchMyCapability(userId, skill.id)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState("ready");
      })
      .catch((e) => {
        console.error("[capability] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, skill.id, reloadKey]);

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <div className="p-16 text-center text-muted-foreground" role="status">Loading...</div>;

  const status: Status | null = data ? (data.competency.evidence_count > 0 ? "evidence" : "self") : null;
  return (
    <>
      <PageHero image={null} eyebrow={`Your capability${skill.category ? ` · ${skill.category}` : ""}`} title={skill.name}>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {status ? <StatusBadge status={status} /> : <span className="text-sm text-ink-muted">Not added yet</span>}
        </div>
      </PageHero>
      <Section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to my dashboard</Link>
          {!data ? (
            <Card className="flex flex-col items-start gap-3 border-dashed">
              <p className="text-sm text-muted-foreground">You haven't added {skill.name} to your MetaTwin yet.</p>
              <Button asChild variant="hero"><Link to="/dashboard">Add it from your dashboard</Link></Button>
            </Card>
          ) : (
            <div>
              <h2 className="text-2xl font-semibold">Your supporting evidence</h2>
              {data.evidence.length === 0 ? (
                <Card className="mt-4 flex items-start gap-3 border-dashed">
                  <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No evidence attached yet. This capability is self-reported — it reflects what you state, not what has been demonstrated. Add evidence from your dashboard.</p>
                </Card>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.evidence.map((e) => {
                    const href = safeHref(e.link);
                    return (
                      <li key={e.id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-start gap-3">
                          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                          <div className="min-w-0 flex-1">
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-electric hover:underline">{e.title}</a>
                            ) : (
                              <span className="font-medium">{e.title}</span>
                            )}
                            <p className="text-xs text-muted-foreground">Added {formatDate(e.created_at)}</p>
                            {e.note && <p className="mt-2 text-sm text-muted-foreground">{e.note}</p>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <aside className="min-w-0">
          <Card>
            <h3 className="font-semibold">What the statuses mean</h3>
            <ul className="mt-4 space-y-4">
              {(["self", "evidence"] as Status[]).map((st) => (
                <li key={st}><StatusBadge status={st} /><p className="mt-1.5 text-xs text-muted-foreground">{statusMeta[st].desc}</p></li>
              ))}
            </ul>
          </Card>
          <p className="mt-4 text-xs text-muted-foreground">
            <Link to="/capability/$slug" params={{ slug: "3d-modelling" }} search={{ example: true }} className="text-electric">See a fictional example</Link> of a fully evidenced capability.
          </p>
        </aside>
      </Section>
    </>
  );
}

function SampleCapability({ cap }: { cap: Capability }) {
  return (
    <>
      <PageHero image={null} eyebrow={`Capability · ${cap.group}`} title={cap.name}>
        <p>{cap.summary}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3"><StatusBadge status={cap.status} /><SampleTag /></div>
      </PageHero>
      <Section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <Link to="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Victorious Kibaki's profile</Link>
          <div>
            <h2 className="text-2xl font-semibold">Supporting evidence</h2>
            {cap.evidence.length === 0 ? (
              <Card className="mt-4 flex items-start gap-3 border-dashed">
                <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No evidence attached yet. This capability is self-reported — it reflects what Victorious states, not what has been demonstrated.</p>
              </Card>
            ) : (
              <Reveal stagger={0.06} className="mt-4 space-y-3">
                {cap.evidence.map((e) => (
                  <Collapsible key={e.title} className="rounded-xl border bg-card">
                    <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-inset">
                      <FileCheck2 className="h-5 w-5 shrink-0 text-electric" />
                      <span className="min-w-0 flex-1"><span className="block font-medium">{e.title}</span><span className="text-xs text-muted-foreground">{e.type}</span></span>
                      <span className="text-xs text-electric">Details</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t px-4 py-3 text-sm text-muted-foreground">{e.note}</CollapsibleContent>
                  </Collapsible>
                ))}
              </Reveal>
            )}
          </div>
          {cap.review && (
            <Card className="border-status-reviewed/30 bg-status-reviewed-bg">
              <p className="text-xs font-semibold uppercase tracking-wider text-status-reviewed">Review</p>
              <blockquote className="mt-3 font-display text-lg">"{cap.review.quote}"</blockquote>
              <p className="mt-3 text-sm">{cap.review.reviewer} · {cap.review.role} · {cap.review.date}</p>
              <p className="mt-2 text-sm text-muted-foreground"><strong>Scope:</strong> {cap.review.scope} A review covers only the evidence named — it is not a certification of the capability overall.</p>
            </Card>
          )}
          <div>
            <h2 className="text-2xl font-semibold">Used in projects</h2>
            <Reveal stagger={0.06} className="mt-4 grid gap-3 sm:grid-cols-2">
              {cap.projects.map((id) => {
                const p = projectById(id)!;
                return (
                  <Link key={id} to="/projects/$id" params={{ id }} className="rounded-xl border bg-card p-4 transition-all duration-200 hover:border-electric/50 hover:shadow-card motion-safe:hover:-translate-y-0.5">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.discipline} · {p.stage}</p>
                  </Link>
                );
              })}
            </Reveal>
          </div>
        </div>
        <aside className="min-w-0">
          <Card>
            <h3 className="font-semibold">What the statuses mean</h3>
            <ul className="mt-4 space-y-4">
              {(Object.keys(statusMeta) as Status[]).map((s) => (
                <li key={s}><StatusBadge status={s} /><p className="mt-1.5 text-xs text-muted-foreground">{statusMeta[s].desc}</p></li>
              ))}
            </ul>
          </Card>
        </aside>
      </Section>
    </>
  );
}
