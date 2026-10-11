import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-explore.jpg";
import { useEffect, useState } from "react";
import { FileCheck2, Users, User } from "lucide-react";
import { capBySlug, projects, type Discipline, type Stage } from "@/lib/data";
import { Card, PageHero, Section } from "@/components/site";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/LoadError";
import { useAuth } from "@/lib/auth";
import { fetchMyProjects, formatDate, type EvidenceRow, type MyProject } from "@/lib/real-data";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Explore Capabilities · MetaTwin Projects" },
      { name: "description", content: "Browse sample projects and the capabilities and evidence behind them." },
      { property: "og:title", content: "Explore Capabilities · MetaTwin" },
      { property: "og:description", content: "Projects across design, software, engineering and sustainability — with evidence." },
    ],
  }),
  component: Projects,
});

const disciplines: Discipline[] = ["3D Design", "Software", "Business Innovation", "Engineering", "Sustainability", "Creative Problem-Solving"];
const stages: Stage[] = ["Idea", "In Progress", "Prototype", "Completed"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-electric/50 motion-safe:hover:-translate-y-0.5")}>
      {children}
    </button>
  );
}

function SampleProjects() {
  const [d, setD] = useState<Discipline | "All">("All");
  const [s, setS] = useState<Stage | "All">("All");
  const list = projects.filter((p) => (d === "All" || p.discipline === d) && (s === "All" || p.stage === s));
  return (
    <>
      <PageHero
        image={heroImg}
        imageClassName="sm:object-[62%_58%]"
        eyebrow="Explore Capabilities"
        title="Real work. Clear contribution. Visible evidence."
      >
        Every project shows what was built, who did what, and which capabilities it demonstrates. All examples are fictional.
      </PageHero>
      <Section className="py-10 md:py-12">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 w-20 text-xs font-semibold uppercase text-muted-foreground">Discipline</span>
            <Chip active={d === "All"} onClick={() => setD("All")}>All</Chip>
            {disciplines.map((x) => <Chip key={x} active={d === x} onClick={() => setD(x)}>{x}</Chip>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 w-20 text-xs font-semibold uppercase text-muted-foreground">Stage</span>
            <Chip active={s === "All"} onClick={() => setS("All")}>All</Chip>
            {stages.map((x) => <Chip key={x} active={s === x} onClick={() => setS(x)}>{x}</Chip>)}
          </div>
        </div>
        <Reveal stagger={0.06} className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="group flex flex-col rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-electric/50">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono uppercase tracking-wider text-electric">{p.discipline}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5">{p.stage}</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold group-hover:text-electric">{p.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-4 flex items-start gap-2 text-xs">
                {p.team.type === "Team" ? <Users className="h-4 w-4 shrink-0 text-muted-foreground" /> : <User className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span><strong>{p.team.type}{p.team.type === "Team" ? ` of ${p.team.size}` : ""}:</strong> {p.team.myRole}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.capabilities.slice(0, 3).map((c) => <span key={c} className="rounded-md bg-electric-soft px-2 py-0.5 text-xs text-accent-foreground">{capBySlug(c)?.name}</span>)}
              </div>
              <p className="mt-4 flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground"><FileCheck2 className="h-4 w-4 text-electric" /> {p.evidenceCount} evidence items</p>
            </Link>
          ))}
          {list.length === 0 && <p className="text-muted-foreground">No projects match these filters.</p>}
        </Reveal>
      </Section>
    </>
  );
}

function Projects() {
  const { user, loading } = useAuth();
  // While auth is resolving, render the examples so server and first client render match.
  if (!user || loading) return <SampleProjects />;
  return <SignedInProjects userId={user.id} />;
}

function SignedInProjects({ userId }: { userId: string }) {
  const [showExamples, setShowExamples] = useState(false);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchMyProjects(userId)
      .then((d) => {
        if (cancelled) return;
        setProjects(d.projects);
        setEvidence(d.evidence);
        setState("ready");
      })
      .catch((e) => {
        console.error("[projects] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  if (showExamples) {
    return (
      <>
        <div className="mx-auto max-w-7xl px-5 pt-6">
          <button onClick={() => setShowExamples(false)} className="cursor-pointer text-sm text-electric hover:underline">← Back to my projects</button>
        </div>
        <SampleProjects />
      </>
    );
  }
  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <main className="p-16 text-center text-muted-foreground">Loading...</main>;

  return (
    <>
      <PageHero
        image={heroImg}
        imageClassName="sm:object-[62%_58%]"
        eyebrow="My projects"
        title="The work you've documented."
      >
        Each project shows when it started and the evidence you've attached along the way.
      </PageHero>
      <Section className="py-10 md:py-12">
        {projects.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 border-dashed">
            <p className="text-sm text-muted-foreground">You haven't added any projects yet.</p>
            <Button asChild variant="hero"><Link to="/dashboard">Add a project from your dashboard</Link></Button>
          </Card>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const count = evidence.filter((e) => e.project_id === p.id).length;
              return (
                <li key={p.id}>
                  <Link to="/projects/$id" params={{ id: p.id }} className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-electric/50">
                    <p className="font-mono text-xs uppercase tracking-wider text-electric">Started {formatDate(p.created_at)}</p>
                    <h3 className="mt-3 text-xl font-semibold group-hover:text-electric">{p.title}</h3>
                    {p.description && <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>}
                    <p className="mt-4 flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
                      <FileCheck2 className="h-4 w-4 text-electric" /> {count} linked evidence {count === 1 ? "item" : "items"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-8 text-xs text-muted-foreground">
          Want to see what a fully documented project looks like?{" "}
          <button onClick={() => setShowExamples(true)} className="cursor-pointer text-electric hover:underline">Browse fictional examples</button>.
        </p>
      </Section>
    </>
  );
}
