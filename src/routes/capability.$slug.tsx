import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileCheck2, AlertCircle } from "lucide-react";
import { capBySlug, projectById, statusMeta, type Status } from "@/lib/data";
import { Card, PageHero, SampleTag, Section, StatusBadge } from "@/components/site";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/capability/$slug")({
  loader: ({ params }) => {
    const cap = capBySlug(params.slug);
    if (!cap) throw notFound();
    return { cap };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.cap.name ?? "Capability"} · Evidence on MetaTwin` },
      { name: "description", content: loaderData?.cap.summary ?? "Capability evidence" },
      { property: "og:title", content: `${loaderData?.cap.name} · MetaTwin` },
      { property: "og:description", content: loaderData?.cap.summary ?? "" },
    ],
  }),
  notFoundComponent: () => <Section><p>Capability not found. <Link to="/profile" className="text-electric">Back to profile</Link></p></Section>,
  component: CapabilityPage,
});

function CapabilityPage() {
  const { cap } = Route.useLoaderData();
  return (
    <>
      <PageHero eyebrow={`Capability · ${cap.group}`} title={cap.name}>
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
        <aside>
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
