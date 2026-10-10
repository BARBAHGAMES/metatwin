import { capabilities, person, projects } from "@/lib/data";
import { SampleAvatar, StatusBadge } from "@/components/site";
import { MessageSquare, Sparkles, Target, FileCheck2 } from "lucide-react";

export function ProfileMockup() {
  const caps = capabilities.slice(0, 4);
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-electric opacity-25 blur-3xl" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-ink-foreground/10 bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center gap-1.5 border-b bg-muted px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">metatwin.app/alex-morgan</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SampleAvatar initials={person.initials} className="h-12 w-12 rounded-xl text-sm" />
              <div className="min-w-0">
                <p className="font-display font-semibold">{person.name}</p>
                <p className="truncate text-xs text-muted-foreground">{person.headline}</p>
                <p className="mt-0.5 text-[11px] font-medium text-electric">Human + 4 AI employees</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Capability map</p>
              <ul className="space-y-2">
                {caps.map((c) => (
                  <li key={c.slug} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="truncate text-sm">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold"><MessageSquare className="h-3.5 w-3.5 text-electric" /> Review · Dr. Imani Wekesa</p>
              <p className="mt-1 text-xs text-muted-foreground">"Clear progression between revisions. Tolerancing is well documented."</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Featured project</p>
              <div className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{projects[0]!.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">Lead 3D modeller · team of 3</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {["Model", "Renders", "Tests"].map((x) => (
                    <div key={x} className="grid aspect-square place-items-center rounded-md bg-electric-soft text-[10px] font-medium text-accent-foreground">
                      <FileCheck2 className="mb-0.5 h-4 w-4" />{x}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Milestones</p>
              <ol className="space-y-2 border-l pl-3">
                {["Pilot results added", "3D Modelling reviewed", "AquaLoop v3 revision"].map((m, i) => (
                  <li key={m} className="relative text-xs">
                    <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-electric" style={{ opacity: 1 - i * 0.3 }} />
                    {m}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-lg bg-ink p-3 text-ink-foreground">
              <p className="flex items-center gap-1.5 text-xs font-semibold"><Target className="h-3.5 w-3.5 text-electric" /> Opportunity alignment</p>
              <p className="mt-1 text-xs text-ink-muted">Circular-economy design internship · 3 capabilities with evidence</p>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs shadow-card sm:flex">
        <Sparkles className="h-4 w-4 text-electric" /> New evidence added · 2h ago
      </div>
    </div>
  );
}
