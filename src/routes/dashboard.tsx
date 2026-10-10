import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderPlus, FilePlus2, Layers, ArrowRight, Info, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { aiEmployees } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, HeroBackdrop, Section, StatusBadge } from "@/components/site";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Status } from "@/lib/data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My MetaTwin · Dashboard" },
      { name: "description", content: "Manage your MetaTwin: capabilities, projects and evidence." },
    ],
  }),
  component: Dashboard,
});

type Twin = {
  id: string;
  name: string | null;
  institution: string | null;
  programme: string | null;
  year: number | null;
  headline: string | null;
  visibility: "private" | "public";
};

type Skill = { id: string; name: string; category: string | null };

type Competency = {
  id: string;
  skill_id: string;
  level: number;
  evidence_count: number;
  updated_at: string;
  skills: { name: string } | null;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

function competencyStatus(c: Competency): Status {
  return c.evidence_count > 0 ? "evidence" : "self";
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [twin, setTwin] = useState<Twin | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);

  const [projectDialog, setProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", description: "" });
  const [capabilityDialog, setCapabilityDialog] = useState(false);
  const [capabilitySkillId, setCapabilitySkillId] = useState("");
  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [evidenceCompetencyId, setEvidenceCompetencyId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  async function loadAll(userId: string) {
    const [twinRes, skillsRes, compsRes, projectsRes] = await Promise.all([
      supabase.from("twins").select("id, name, institution, programme, year, headline, visibility").eq("id", userId).maybeSingle(),
      supabase.from("skills").select("id, name, category").order("name"),
      supabase
        .from("competencies")
        .select("id, skill_id, level, evidence_count, updated_at, skills(name)")
        .eq("twin_id", userId)
        .order("updated_at", { ascending: false }),
      supabase.from("projects").select("id, title, description, created_at").eq("twin_id", userId).order("created_at", { ascending: false }),
    ]);
    if (twinRes.error) console.error("[dashboard] load twin failed:", twinRes.error.message);
    if (skillsRes.error) console.error("[dashboard] load skills failed:", skillsRes.error.message);
    if (compsRes.error) console.error("[dashboard] load competencies failed:", compsRes.error.message);
    if (projectsRes.error) console.error("[dashboard] load projects failed:", projectsRes.error.message);

    setTwin(
      (twinRes.data as Twin | null) ?? {
        id: userId,
        name: null,
        institution: null,
        programme: null,
        year: null,
        headline: null,
        visibility: "private",
      },
    );
    setSkills((skillsRes.data as Skill[] | null) ?? []);
    setCompetencies((compsRes.data as unknown as Competency[] | null) ?? []);
    setProjects((projectsRes.data as Project[] | null) ?? []);
    setFetching(false);
  }

  useEffect(() => {
    if (user) loadAll(user.id);
  }, [user]);

  async function addProject() {
    if (!user || !projectForm.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      twin_id: user.id,
      title: projectForm.title.trim(),
      description: projectForm.description.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project added.");
    setProjectForm({ title: "", description: "" });
    setProjectDialog(false);
    loadAll(user.id);
  }

  async function addCapability() {
    if (!user || !capabilitySkillId) return;
    setSaving(true);
    const { error } = await supabase.from("competencies").insert({
      twin_id: user.id,
      skill_id: capabilitySkillId,
      level: 1,
      evidence_count: 0,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Capability added — self-reported.");
    setCapabilitySkillId("");
    setCapabilityDialog(false);
    loadAll(user.id);
  }

  async function addEvidence() {
    if (!user || !evidenceCompetencyId) return;
    const target = competencies.find((c) => c.id === evidenceCompetencyId);
    if (!target) return;
    setSaving(true);
    const { error } = await supabase
      .from("competencies")
      .update({ evidence_count: target.evidence_count + 1, updated_at: new Date().toISOString() })
      .eq("id", evidenceCompetencyId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Evidence recorded.");
    setEvidenceCompetencyId("");
    setEvidenceDialog(false);
    loadAll(user.id);
  }

  if (authLoading || fetching || !twin) {
    return <main className="p-16 text-center text-muted-foreground">Loading...</main>;
  }

  const availableSkillsForCapability = skills.filter((s) => !competencies.some((c) => c.skill_id === s.id));
  const filledProfileFields = [twin.name, twin.institution, twin.programme, twin.headline].filter(Boolean).length;
  const completion = Math.round(
    (filledProfileFields / 4) * 40 + Math.min(competencies.length / 3, 1) * 30 + Math.min(projects.length / 2, 1) * 30,
  );

  const recentActivity = [
    ...competencies.map((c) => ({
      at: c.updated_at,
      text: `${c.skills?.name ?? "A capability"} — ${c.evidence_count > 0 ? "evidence added" : "self-reported"}`,
    })),
    ...projects.map((p) => ({ at: p.created_at, text: `Started project: ${p.title}` })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  return (
    <div className="bg-muted/40">
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-5 py-14 md:flex-row md:items-end md:justify-between md:py-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Owner view · Managing a MetaTwin</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-5xl">
              Welcome back{twin.name ? `, ${twin.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-2 text-ink-muted">Skills, evidence and your MetaTwin in one place.</p>
          </div>
          <Button asChild variant="heroOutline"><Link to="/profile">View my MetaTwin <ArrowRight /></Link></Button>
        </div>
      </section>
      <Section className="py-10 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-ink p-4 text-ink-foreground">
          <p className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4 text-electric" /> Your AI team: {aiEmployees.map((a) => `${a.name} (${a.role})`).join(" · ")}</p>
          <span className="text-xs text-ink-muted">{aiEmployees.filter((a) => a.status !== "Idle").length} working now</span>
        </div>

        {!twin.name && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-dashed bg-card p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" /> Add your name and headline from the profile fields below to get started.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <button onClick={() => setProjectDialog(true)} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition hover:border-electric/50">
            <FolderPlus className="h-5 w-5 shrink-0 text-electric" />Add a project
          </button>
          <button onClick={() => setCapabilityDialog(true)} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition hover:border-electric/50">
            <Layers className="h-5 w-5 shrink-0 text-electric" />Add a capability
          </button>
          <button
            onClick={() => (competencies.length === 0 ? toast.info("Add a capability first.") : setEvidenceDialog(true))}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition hover:border-electric/50"
          >
            <FilePlus2 className="h-5 w-5 shrink-0 text-electric" />Add evidence
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
            <p className="mt-1 font-display text-4xl font-semibold">{competencies.length}</p>
            {competencies.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {(["evidence", "self"] as Status[])
                  .filter((s) => competencies.some((c) => competencyStatus(c) === s))
                  .map((s) => (
                    <StatusBadge key={s} status={s} />
                  ))}
              </div>
            )}
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Projects</p>
            <p className="mt-1 font-display text-4xl font-semibold">{projects.length}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {projects.slice(0, 3).map((p) => (
                <li key={p.id} className="truncate rounded-lg bg-muted px-3 py-2">{p.title}</li>
              ))}
              {projects.length === 0 && <li className="text-xs text-muted-foreground">None yet</li>}
            </ul>
          </Card>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <h3 className="font-semibold">Your capabilities</h3>
            <ul className="mt-3 space-y-2">
              {competencies.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate">{c.skills?.name ?? "Unknown skill"}</span>
                  <StatusBadge status={competencyStatus(c)} />
                </li>
              ))}
              {competencies.length === 0 && <li className="text-xs text-muted-foreground">No capabilities added yet.</li>}
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold">Recent activity</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {recentActivity.map((a, i) => (
                <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-electric" />{a.text}</li>
              ))}
              {recentActivity.length === 0 && <li className="text-xs text-muted-foreground">Nothing yet — add a project or capability above.</li>}
            </ul>
          </Card>
        </div>

        <Card className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Profile</h3>
            <Button
              asChild
              variant="link"
              className="px-0"
            >
              <Link to="/profile">
                Preview public profile page <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <ProfileEditor twin={twin} onSaved={() => user && loadAll(user.id)} />
        </Card>
      </Section>

      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-title">Title</Label>
              <Input id="project-title" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="e.g. AquaLoop Greywater Filter" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Textarea id="project-description" rows={3} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="What is it, and what's your role?" />
            </div>
          </div>
          <DialogFooter><Button onClick={addProject} disabled={saving || !projectForm.title.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={capabilityDialog} onOpenChange={setCapabilityDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a capability</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="capability-select">Capability</Label>
            <select
              id="capability-select"
              value={capabilitySkillId}
              onChange={(e) => setCapabilitySkillId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Choose…</option>
              {availableSkillsForCapability.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {availableSkillsForCapability.length === 0 && (
              <p className="text-xs text-muted-foreground">You've added every capability in the current list.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">New capabilities start as Self-Reported — add evidence next to back it up.</p>
          <DialogFooter><Button onClick={addCapability} disabled={saving || !capabilitySkillId}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceDialog} onOpenChange={setEvidenceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add evidence</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="evidence-select">Supports capability</Label>
            <select
              id="evidence-select"
              value={evidenceCompetencyId}
              onChange={(e) => setEvidenceCompetencyId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Choose…</option>
              {competencies.map((c) => (
                <option key={c.id} value={c.id}>{c.skills?.name ?? "Unknown skill"}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Evidence file attachments aren't built yet — this records that evidence exists and moves the capability to Evidence Added.</p>
          <DialogFooter><Button onClick={addEvidence} disabled={saving || !evidenceCompetencyId}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileEditor({ twin, onSaved }: { twin: Twin; onSaved: () => void }) {
  const [form, setForm] = useState(twin);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("twins").upsert({ ...form, id: twin.id }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved.");
    onSaved();
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Headline</Label>
        <Input value={form.headline ?? ""} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Institution</Label>
        <Input value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Programme</Label>
        <Input value={form.programme ?? ""} onChange={(e) => setForm({ ...form, programme: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Year</Label>
        <Input
          type="number"
          value={form.year ?? ""}
          onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          checked={form.visibility === "public"}
          onChange={(e) => setForm({ ...form, visibility: e.target.checked ? "public" : "private" })}
        />
        Visible to employers
      </label>
      <div className="sm:col-span-2">
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
      </div>
    </div>
  );
}
