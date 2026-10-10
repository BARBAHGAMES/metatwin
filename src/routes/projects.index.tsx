import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileCheck2, Users, User } from "lucide-react";
import { capBySlug, projects, type Discipline, type Stage } from "@/lib/data";
import { PageHero, Section } from "@/components/site";
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
    <button onClick={onClick} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-electric/50")}>
      {children}
    </button>
  );
}

function Projects() {
  const [d, setD] = useState<Discipline | "All">("All");
  const [s, setS] = useState<Stage | "All">("All");
  const list = projects.filter((p) => (d === "All" || p.discipline === d) && (s === "All" || p.stage === s));
  return (
    <>
      <PageHero eyebrow="Explore Capabilities" title="Real work. Clear contribution. Visible evidence.">
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
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </Section>
    </>
  );
}
