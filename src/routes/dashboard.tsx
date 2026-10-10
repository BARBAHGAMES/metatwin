import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, FilePlus2, RefreshCw, Flag, MessageSquare, ArrowRight, Info } from "lucide-react";
import { capabilities, person } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, HeroBackdrop, SampleTag, Section, StatusBadge } from "@/components/site";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My MetaTwin · Dashboard Preview" },
      { name: "description", content: "Preview the MetaTwin dashboard: manage capabilities, projects, evidence and milestones." },
      { property: "og:title", content: "My MetaTwin · Dashboard Preview" },
      { property: "og:description", content: "A focused dashboard for growing your evidence-based record." },
    ],
  }),
  component: Dashboard,
});

type Action = "project" | "evidence" | "capability" | "milestone";
const actionMeta: Record<Action, { label: string; icon: typeof FolderPlus; field: string }> = {
  project: { label: "Add a project", icon: FolderPlus, field: "Project title" },
  evidence: { label: "Add evidence", icon: FilePlus2, field: "Evidence title" },
  capability: { label: "Update a capability", icon: RefreshCw, field: "Capability name" },
  milestone: { label: "Record a milestone", icon: Flag, field: "Milestone description" },
};

function Dashboard() {
  const [inProgress, setInProgress] = useState(["FieldNote", "Repair Café Toolkit"]);
  const [recentEvidence, setRecentEvidence] = useState(["Pilot results — AquaLoop", "Flow test spreadsheet", "FieldNote walkthrough video"]);
  const [milestones, setMilestones] = useState(["3D Modelling reviewed", "AquaLoop v3 revision"]);
  const [caps, setCaps] = useState(capabilities.length);
  const [completion, setCompletion] = useState(72);
  const [open, setOpen] = useState<Action | null>(null);
  const [val, setVal] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const submit = () => {
    if (!open || !val.trim()) return;
    if (open === "project") setInProgress((x) => [val, ...x]);
    if (open === "evidence") setRecentEvidence((x) => [val, ...x].slice(0, 5));
    if (open === "milestone") setMilestones((x) => [val, ...x].slice(0, 5));
    if (open === "capability") setCaps((c) => c + 1);
    setCompletion((c) => Math.min(100, c + 4));
    toast.success(`${actionMeta[open].label}: "${val}"`, { description: "Demo only — stored in this browser session." });
    setVal("");
    setOpen(null);
  };

  return (
    <div className="bg-muted/40">
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-5 py-14 md:flex-row md:items-end md:justify-between md:py-16">
          <div>
            <SampleTag />
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-electric">My MetaTwin</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-5xl">Welcome back, {person.name.split(" ")[0]}.</h1>
            <p className="mt-2 text-ink-muted">Here's how your MetaTwin is developing.</p>
          </div>
          <Button asChild variant="heroOutline"><Link to="/profile">View public profile <ArrowRight /></Link></Button>
        </div>
      </section>
      <Section className="py-10 md:py-12">


        <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed bg-card p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" /> Prototype: changes you make here are demonstrations and reset when you refresh. Nothing is saved or synced externally.
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          {(Object.keys(actionMeta) as Action[]).map((a) => {
            const { icon: I, label } = actionMeta[a];
            return (
              <button key={a} onClick={() => setOpen(a)} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition hover:border-electric/50">
                <I className="h-5 w-5 shrink-0 text-electric" />{label}
              </button>
            );
          })}
          <button onClick={() => setFeedbackOpen(true)} className="flex items-center gap-3 rounded-xl bg-ink p-4 text-left text-sm font-medium text-ink-foreground">
            <MessageSquare className="h-5 w-5 shrink-0 text-electric" />View feedback
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <Card>
            <p className="text-sm text-muted-foreground">Profile completion</p>
            <p className="mt-1 font-display text-4xl font-semibold">{completion}%</p>
            <Progress value={completion} className="mt-4" />
            <p className="mt-3 text-xs text-muted-foreground">Completeness of your record — not a measure of ability.</p>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Capabilities documented</p>
            <p className="mt-1 font-display text-4xl font-semibold">{caps}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status="reviewed" /><StatusBadge status="evidence" /><StatusBadge status="self" />
            </div>
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Feedback awaiting response</p>
            <p className="mt-1 font-display text-4xl font-semibold">1</p>
            <p className="mt-3 text-sm">Grace Njeri on FieldNote photo capture</p>
          </Card>
          <Card>
            <h3 className="font-semibold">Projects in progress</h3>
            <ul className="mt-3 space-y-2 text-sm">{inProgress.map((x, i) => <li key={i} className="rounded-lg bg-muted px-3 py-2">{x}</li>)}</ul>
          </Card>
          <Card>
            <h3 className="font-semibold">Evidence added recently</h3>
            <ul className="mt-3 space-y-2 text-sm">{recentEvidence.map((x, i) => <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-electric" />{x}</li>)}</ul>
          </Card>
          <Card>
            <h3 className="font-semibold">Recent milestones</h3>
            <ul className="mt-3 space-y-2 text-sm">{milestones.map((x, i) => <li key={i} className="flex items-center gap-2"><Flag className="h-3.5 w-3.5 text-electric" />{x}</li>)}</ul>
          </Card>
        </div>

        <Card className="mt-5">
          <h3 className="font-semibold">Suggested next steps</h3>
          <ul className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <li className="rounded-lg border p-3">Attach evidence to <strong>Team Facilitation</strong> — currently self-reported.</li>
            <li className="rounded-lg border p-3">Respond to Grace's feedback and log the FieldNote revision.</li>
            <li className="rounded-lg border p-3">Request a review of your <strong>React App Development</strong> evidence.</li>
          </ul>
        </Card>
      </Section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open && actionMeta[open].label}</DialogTitle></DialogHeader>
          <Input autoFocus placeholder={open ? actionMeta[open].field : ""} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <p className="text-xs text-muted-foreground">Demo only. In the initial rollout, this would be captured via a Google Form [link to be provided].</p>
          <DialogFooter><Button onClick={submit}>Save (demo)</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Feedback</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border p-3"><p>"Visit form is fast. Photo capture needs a compression option."</p><p className="mt-1 text-xs text-muted-foreground">Grace Njeri · FieldNote · Awaiting response</p></div>
            <div className="rounded-lg border p-3"><p>"Clip mechanism is the strongest part. Reconsider wall thickness for UV exposure."</p><p className="mt-1 text-xs text-muted-foreground">Dr. Imani Wekesa · AquaLoop · Addressed in v3</p></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
