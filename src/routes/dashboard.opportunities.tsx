import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/site";
import { Button } from "@/components/ui/button";
import { OpportunitiesScout } from "@/components/OpportunitiesScout";
import { fetchMyOpportunityMatches, type OpportunityMatch } from "@/lib/real-data";
import { safeHref } from "@/lib/url";

export const Route = createFileRoute("/dashboard/opportunities")({
  component: OpportunitiesTab,
});

function OpportunitiesTab() {
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error" | "ready">("idle");

  function load() {
    setState("loading");
    fetchMyOpportunityMatches()
      .then((m) => {
        setMatches(m);
        setState("ready");
      })
      .catch((e) => {
        console.error("[dashboard opportunities] load failed:", e);
        setState("error");
      });
  }

  useEffect(load, []);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Your MetaTwin scouts for you</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Matches based on your skills, courses, projects and AI team. The more proof you add, the better the matches.
          </p>
        </div>
        <Button variant="hero" onClick={load} disabled={state === "loading"}><Search className="h-4 w-4" /> {state === "loading" ? "Searching…" : "Find opportunities"}</Button>
      </div>

      {state === "error" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">We couldn't load opportunities.</span>
          <Button type="button" variant="outline" size="sm" onClick={load}>Try again</Button>
        </div>
      )}
      {state === "ready" && matches.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          No opportunities have been added yet. When partners add them, the ones that fit your capabilities will appear here.
        </p>
      )}
      {state === "ready" && matches.length > 0 && (
        <ul className="mt-4 space-y-3">
          {matches.map((m) => {
            const href = safeHref(m.url);
            return (
              <li key={m.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    {m.org_name && <p className="text-xs text-muted-foreground">{m.org_name}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-electric-soft px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    {m.score === null ? "No skills listed" : `${m.score}% match`}
                  </span>
                </div>
                {m.description && <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>}
                {(m.matched_skills.length > 0 || m.missing_skills.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {m.matched_skills.map((n) => <span key={`y-${n}`} className="rounded-md bg-status-evidence-bg px-2 py-0.5 text-status-evidence">✓ {n}</span>)}
                    {m.missing_skills.map((n) => <span key={`n-${n}`} className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">+ {n}</span>)}
                  </div>
                )}
                {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-electric hover:underline">View opportunity</a>}
              </li>
            );
          })}
        </ul>
      )}
      <OpportunitiesScout />
    </Card>
  );
}
