import { Bot, ShieldCheck, Zap } from "lucide-react";
import { aiEmployees, type AIEmployee } from "@/lib/data";
import { cn } from "@/lib/utils";

const dot: Record<AIEmployee["status"], string> = {
  Active: "bg-status-reviewed",
  "On a task": "bg-electric animate-pulse",
  Idle: "bg-ink-muted",
};

export function AITeam({ owner }: { owner: string }) {
  const first = owner.split(" ")[0];
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-ink text-ink-foreground">
      <div className="grid-lines absolute inset-0" aria-hidden />
      <div className="relative p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-electric/40 bg-electric/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-electric">
              <Bot className="h-3.5 w-3.5" /> AI workforce
            </p>
            <h2 className="mt-3 text-2xl font-semibold md:text-3xl">{first}'s AI Employees</h2>
            <p className="mt-2 max-w-xl text-sm text-ink-muted">
              Hire {first}, and you get proven capability <strong className="text-ink-foreground">plus a team of {aiEmployees.length} AI employees</strong> — directed and supervised by {first}.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
            {[["1", "Human lead"], [String(aiEmployees.length), "AI employees"], ["24/7", "Capacity"]].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-ink-foreground/10 bg-ink-soft px-4 py-3">
                <p className="font-display text-xl font-semibold text-gradient-electric">{v}</p>
                <p className="text-[11px] text-ink-muted">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {aiEmployees.map((a) => (
            <div key={a.name} className="rounded-2xl border border-ink-foreground/10 bg-ink-soft p-5 transition hover:border-electric/40">
              <div className="flex items-start gap-3">
                <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-electric font-display font-semibold">
                  {a.name[0]}
                  <span className={cn("absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-ink-soft", dot[a.status])} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold">{a.name} <span className="ml-1 rounded bg-electric/15 px-1.5 py-0.5 font-mono text-[10px] text-electric">AI</span></p>
                    <span className="text-[11px] text-ink-muted">{a.status}</span>
                  </div>
                  <p className="text-sm text-ink-muted">{a.role}</p>
                </div>
              </div>
              <p className="mt-3 text-sm">{a.focus}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{a.tools.map((t) => <span key={t} className="rounded-md bg-ink px-2 py-0.5 text-[11px] text-ink-muted">{t}</span>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {a.stats.map((s) => <div key={s.label} className="rounded-lg bg-ink px-3 py-2"><p className="font-mono text-sm">{s.value}</p><p className="text-[11px] text-ink-muted">{s.label}</p></div>)}
              </div>
              <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-muted"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-electric" />{a.recent}</p>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-muted"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-reviewed" />{a.supervisedBy}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-ink-muted">AI work is shown separately and never counted as {first}'s personal evidence. Stats are fictional sample data.</p>
      </div>
    </section>
  );
}
