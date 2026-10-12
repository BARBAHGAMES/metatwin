import { useState } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OPPORTUNITIES_SCOUT_PATH } from "@/lib/api-paths";
import { Button } from "@/components/ui/button";

type Idea = { title: string; type: string; why: string; next_step: string; gap: string };

export function OpportunitiesScout() {
  const [items, setItems] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        toast.error("Sign in to use this.");
        return;
      }
      const res = await fetch(OPPORTUNITIES_SCOUT_PATH, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as { items?: Idea[]; error?: string };
      if (!res.ok || body.error) {
        toast.error(body.error ?? "Try again.");
        return;
      }
      setItems(body.items ?? []);
    } catch {
      toast.error("Could not reach the AI scout. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5">
        <div>
          <p className="font-semibold">AI opportunities scout</p>
          <p className="text-sm text-muted-foreground">Suggestions based on your skills, evidence and projects. Not live job listings — a starting point.</p>
        </div>
        <Button variant="hero" onClick={go} disabled={busy}><Compass /> {busy ? "Scouting…" : items.length ? "Scout again" : "Find opportunities"}</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <span className="rounded-full bg-electric/10 px-2 py-0.5 font-mono text-xs text-electric">{it.type}</span>
            <p className="mt-2 font-semibold">{it.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{it.why}</p>
            <p className="mt-3 text-sm"><span className="font-medium">Next step:</span> {it.next_step}</p>
            {it.gap && <p className="mt-1 text-sm"><span className="font-medium">Add proof:</span> {it.gap}</p>}
          </div>
        ))}
      </div>
      {items.length > 0 && <p className="text-xs text-muted-foreground">Suggestions are AI-generated ideas, not live job listings or guaranteed outcomes.</p>}
    </div>
  );
}
