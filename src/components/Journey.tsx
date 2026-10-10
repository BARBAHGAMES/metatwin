import { Paperclip } from "lucide-react";
import type { Project } from "@/lib/data";
import { Reveal } from "@/components/Reveal";

export function Journey({ steps }: { steps: Project["journey"] }) {
  return (
    <Reveal as="ol" stagger={0.1} className="relative space-y-0">
      {steps.map((s, i) => (
        <li key={i} className="relative grid grid-cols-[88px_24px_minmax(0,1fr)] gap-3 pb-8 last:pb-0 md:grid-cols-[110px_24px_minmax(0,1fr)]">
          <p className="pt-0.5 text-right font-mono text-xs text-muted-foreground">{s.date}</p>
          <div className="relative flex justify-center">
            {i < steps.length - 1 && <span className="absolute top-5 bottom-[-2rem] w-px bg-gradient-electric opacity-40" />}
            <span className="relative z-10 mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-electric text-[9px] font-semibold text-primary-foreground">{i + 1}</span>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="font-display font-semibold">{s.step}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            {s.material && <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-electric-soft px-2 py-0.5 text-xs text-accent-foreground"><Paperclip className="h-3 w-3" />{s.material}</p>}
          </div>
        </li>
      ))}
    </Reveal>
  );
}
