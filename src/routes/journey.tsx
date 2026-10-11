import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { projects } from "@/lib/data";
import { Card, PageHero, SampleTag, Section } from "@/components/site";
import { Journey } from "@/components/Journey";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "The Journey of Your Work · MetaTwin" },
      { name: "description", content: "MetaTwin records how a project develops — from idea to outcome — not just the finished result." },
      { property: "og:title", content: "The Journey of Your Work · MetaTwin" },
      { property: "og:description", content: "Idea, evidence, feedback, revision, outcome — recorded over time." },
    ],
  }),
  component: JourneyPage,
});

function JourneyPage() {
  const p = projects[0]!;
  return (
    <>
      <PageHero eyebrow="Development timeline" title="The Journey of Your Work">
        Idea → Initial Work → Evidence Added → Feedback → Revision → Demonstration → Outcome. MetaTwin records development over time, so feedback becomes visible improvement — and stronger evidence.
      </PageHero>
      <Section className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">Sample journey <SampleTag /></p>
          <h2 className="mb-8 text-2xl font-semibold">{p.title}</h2>
          <Journey steps={p.journey} />
        </div>
        <aside className="space-y-5">
          <Card className="border-electric/30">
            <h3 className="font-semibold">How feedback improved the work</h3>
            <p className="mt-3 text-sm text-muted-foreground">A July review flagged UV exposure. The v3 revision thickened walls and cut material by 18% — and that improvement is now part of the evidence for 3D Modelling.</p>
          </Card>
          <Link to="/projects/$id" params={{ id: p.id }} className="flex items-center gap-1 text-sm font-medium text-electric">Open full project <ArrowRight className="h-4 w-4" /></Link>
        </aside>
      </Section>
    </>
  );
}
