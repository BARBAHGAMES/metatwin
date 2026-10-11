import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-journey.jpg";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { projects } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { buildProjectTimeline, fetchMyProjects, type EvidenceRow, type MyProject } from "@/lib/real-data";
import { Card, PageHero, SampleTag, Section } from "@/components/site";
import { Journey } from "@/components/Journey";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/LoadError";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "The Journey of Your Work · MetaTwin" },
      { name: "description", content: "MetaTwin records how a project develops — from idea to outcome — not just the finished result." },
      { property: "og:title", content: "The Journey of Your Work · MetaTwin" },
      { property: "og:description", content: "Idea, evidence, feedback, revision, outcome — recorded over time." },
    ],
  }),
  component: JourneyRoute,
});

function SampleJourney() {
  const p = projects[0]!;
  return (
    <>
      <PageHero
        image={heroImg}
        imageClassName="hero-drift-soft object-center opacity-100"
        className="md:[&>div:last-child]:py-32"
        eyebrow="Development timeline"
        title="The Journey of Your Work"
      >
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

function JourneyRoute() {
  const { user, loading } = useAuth();
  // While auth is resolving, render the sample so server and first client render match.
  if (!user || loading) return <SampleJourney />;
  return <MyJourney userId={user.id} />;
}

function MyJourney({ userId }: { userId: string }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [projectList, setProjectList] = useState<MyProject[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchMyProjects(userId)
      .then((d) => {
        if (cancelled) return;
        setProjectList(d.projects);
        setEvidence(d.evidence);
        setState("ready");
      })
      .catch((e) => {
        console.error("[journey] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <main className="p-16 text-center text-muted-foreground">Loading...</main>;

  return (
    <>
      <PageHero
        image={heroImg}
        imageClassName="hero-drift-soft object-center opacity-100"
        className="md:[&>div:last-child]:py-32"
        eyebrow="Development timeline"
        title="The journey of your work"
      >
        MetaTwin records how each project develops over time, so progress becomes visible evidence. These timelines are built from the dates you actually added projects and evidence.
      </PageHero>
      <Section className="space-y-14">
        {projectList.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 border-dashed">
            <p className="text-sm text-muted-foreground">No projects yet, so there's no journey to show. Add a project, then attach evidence as you go.</p>
            <Button asChild variant="hero"><Link to="/dashboard">Add a project</Link></Button>
          </Card>
        ) : (
          projectList.map((p) => (
            <div key={p.id} className="min-w-0">
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl font-semibold">{p.title}</h2>
                <Link to="/projects/$id" params={{ id: p.id }} className="flex items-center gap-1 text-sm font-medium text-electric">
                  Open project <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <Journey steps={buildProjectTimeline(p, evidence.filter((e) => e.project_id === p.id))} />
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          <Link to="/projects/$id" params={{ id: "aqualoop-filter" }} className="text-electric">See a fictional example</Link> of a full project journey.
        </p>
      </Section>
    </>
  );
}
