import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileCheck2, MessageSquare } from "lucide-react";
import { capBySlug, projectById } from "@/lib/data";
import { Card, PageHero, SampleTag, Section, StatusBadge } from "@/components/site";
import { Journey } from "@/components/Journey";
import { Reveal } from "@/components/Reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/projects/$id")({
  loader: ({ params }) => {
    const project = projectById(params.id);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.project.title ?? "Project"} · MetaTwin` },
      { name: "description", content: loaderData?.project.description ?? "" },
      { property: "og:title", content: `${loaderData?.project.title} · MetaTwin` },
      { property: "og:description", content: loaderData?.project.description ?? "" },
    ],
  }),
  notFoundComponent: () => <Section><p>Project not found. <Link to="/projects" className="text-electric">All projects</Link></p></Section>,
  component: ProjectPage,
});

function ProjectPage() {
  const { project: p } = Route.useLoaderData();
  return (
    <>
      <PageHero eyebrow={`${p.discipline} · ${p.stage}`} title={p.title}>
        <p>{p.description}</p>
        <div className="mt-4"><SampleTag /></div>
      </PageHero>
      <Section className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All projects</Link>
          <div className="grid gap-5 md:grid-cols-2">
            <Card><p className="text-xs font-semibold uppercase text-muted-foreground">Problem</p><p className="mt-2">{p.problem}</p></Card>
            <Card><p className="text-xs font-semibold uppercase text-muted-foreground">Proposed solution</p><p className="mt-2">{p.solution}</p></Card>
          </div>
          <Card className="border-electric/30">
            <p className="text-xs font-semibold uppercase text-electric">Victorious's individual role</p>
            <p className="mt-2">{p.team.myRole}</p>
            {p.team.collective && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Collective team output ({p.team.size} people)</p>
                <p className="mt-2 text-muted-foreground">{p.team.collective}</p>
              </div>
            )}
          </Card>
          <div>
            <h2 className="text-2xl font-semibold">Work samples</h2>
            <Reveal stagger={0.06} className="mt-4 grid gap-3 sm:grid-cols-2">
              {p.samples.map((s) => (
                <div key={s.title} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow duration-200 hover:shadow-card">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-electric-soft text-electric"><FileCheck2 className="h-5 w-5" /></div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.kind}</p></div>
                </div>
              ))}
            </Reveal>
          </div>
          <Accordion type="multiple" defaultValue={["feedback"]} className="rounded-xl border bg-card px-5">
            <AccordionItem value="feedback">
              <AccordionTrigger>Feedback received ({p.feedback.length})</AccordionTrigger>
              <AccordionContent className="space-y-4">
                {p.feedback.length === 0 && <p className="text-muted-foreground">No feedback yet.</p>}
                {p.feedback.map((f) => (
                  <div key={f.text} className="flex gap-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                    <div><p>"{f.text}"</p><p className="mt-1 text-xs text-muted-foreground">{f.from} · {f.role} · {f.date}</p></div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="iterations">
              <AccordionTrigger>Iterations and improvements ({p.iterations.length})</AccordionTrigger>
              <AccordionContent>
                <ol className="space-y-2">{p.iterations.map((it) => <li key={it.version}><span className="font-mono text-xs text-electric">{it.version}</span> — {it.change}</li>)}</ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="outcome" className="border-b-0">
              <AccordionTrigger>Outcomes and next steps</AccordionTrigger>
              <AccordionContent className="space-y-2"><p><strong>Outcome:</strong> {p.outcome}</p><p><strong>Next:</strong> {p.next}</p></AccordionContent>
            </AccordionItem>
          </Accordion>
          <div>
            <h2 className="text-2xl font-semibold">The Journey of This Work</h2>
            <div className="mt-6"><Journey steps={p.journey} /></div>
          </div>
        </div>
        <aside>
          <Card>
            <h3 className="font-semibold">Competencies demonstrated</h3>
            <ul className="mt-4 space-y-3">
              {p.capabilities.map((c) => {
                const cap = capBySlug(c)!;
                return (
                  <li key={c}>
                    <Link to="/capability/$slug" params={{ slug: c }} className="flex items-center justify-between gap-2 text-sm hover:text-electric">
                      <span className="truncate">{cap.name}</span><StatusBadge status={cap.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </Section>
    </>
  );
}
