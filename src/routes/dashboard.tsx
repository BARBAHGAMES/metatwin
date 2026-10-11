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
import { AdultGate } from "@/components/AdultGate";
import { LINK_ERROR, isHttpUrl, safeHref } from "@/lib/url";
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
  is_adult: boolean;
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

type Evidence = {
  id: string;
  competency_id: string;
  title: string;
  link: string | null;
  note: string | null;
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
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [fetching, setFetching] = useState(true);

  const [projectDialog, setProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", description: "" });
  const [capabilityDialog, setCapabilityDialog] = useState(false);
  const [capabilitySkillId, setCapabilitySkillId] = useState("");
  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [evidenceCompetencyId, setEvidenceCompetencyId] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({ title: "", link: "", note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  async function loadAll(userId: string) {
    const [twinRes, skillsRes, compsRes, projectsRes, evidenceRes] = await Promise.all([
      supabase.from("twins").select("id, name, institution, programme, year, headline, visibility, is_adult").eq("id", userId).maybeSingle(),
      supabase.from("skills").select("id, name, category").order("name"),
      supabase
        .from("competencies")
        .select("id, skill_id, level, evidence_count, updated_at, skills(name)")
        .eq("twin_id", userId)
        .order("updated_at", { ascending: false }),
      supabase.from("projects").select("id, title, description, created_at").eq("twin_id", userId).order("created_at", { ascending: false }),
      supabase
        .from("evidence")
        .select("id, competency_id, title, link, note, created_at")
        .eq("twin_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    if (twinRes.error) console.error("[dashboard] load twin failed:", twinRes.error.message);
    if (skillsRes.error) console.error("[dashboard] load skills failed:", skillsRes.error.message);
    if (compsRes.error) console.error("[dashboard] load competencies failed:", compsRes.error.message);
    if (projectsRes.error) console.error("[dashboard] load projects failed:", projectsRes.error.message);
    if (evidenceRes.error) console.error("[dashboard] load evidence failed:", evidenceRes.error.message);

    setTwin(
      (twinRes.data as Twin | null) ?? {
        id: userId,
        name: null,
        institution: null,
        programme: null,
        year: null,
        headline: null,
        visibility: "private",
        is_adult: false,
      },
    );
    setSkills((skillsRes.data as Skill[] | null) ?? []);
    setCompetencies((compsRes.data as unknown as Competency[] | null) ?? []);
    setProjects((projectsRes.data as Project[] | null) ?? []);
    setEvidence((evidenceRes.data as Evidence[] | null) ?? []);
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
    if (!user || !evidenceCompetencyId || !evidenceForm.title.trim()) return;
    const link = evidenceForm.link.trim();
    if (link && !isHttpUrl(link)) {
      toast.error(LINK_ERROR);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("evidence").insert({
      twin_id: user.id,
      competency_id: evidenceCompetencyId,
      title: evidenceForm.title.trim(),
      link: link || null,
      note: evidenceForm.note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Evidence recorded.");
    setEvidenceCompetencyId("");
    setEvidenceForm({ title: "", link: "", note: "" });
    setEvidenceDialog(false);
    loadAll(user.id);
  }

  if (authLoading || fetching || !twin) {
    return <main className="p-16 text-center text-muted-foreground">Loading...</main>;
  }

  if (!twin.is_adult) {
    return <AdultGate onDeclared={() => user && loadAll(user.id)} />;
  }

  const availableSkillsForCapability = skills.filter((s) => !competencies.some((c) => c.skill_id === s.id));
  const filledProfileFields = [twin.name, twin.institution, twin.programme, twin.headline].filter(Boolean).length;
  const completion = Math.round(
    (filledProfileFields / 4) * 40 + Math.min(competencies.length / 3, 1) * 30 + Math.min(projects.length / 2, 1) * 30,
  );

  const recentActivity = [
    ...competencies
      .filter((c) => c.evidence_count === 0)
      .map((c) => ({ at: c.updated_at, text: `${c.skills?.name ?? "A capability"} — self-reported` })),
    ...projects.map((p) => ({ at: p.created_at, text: `Started project: ${p.title}` })),
    ...evidence.map((e) => {
      const skillName = competencies.find((c) => c.id === e.competency_id)?.skills?.name;
      return { at: e.created_at, text: `${e.title}${skillName ? ` — evidence for ${skillName}` : ""}` };
    }),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  return (
    <div className="bg-muted/40">
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-5 py-14 md:flex-row md:items-end md:justify-between md:py-16">
          <div className="hero-rise">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Owner view · Managing a MetaTwin</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-5xl">
              Welcome back{twin.name ? `, ${twin.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-2 text-ink-muted">Skills, evidence and your MetaTwin in one place.</p>
          </div>
          <Button asChild variant="heroOutline" className="hero-rise-delay-1"><Link to="/profile">View my MetaTwin <ArrowRight /></Link></Button>
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
          <button onClick={() => setProjectDialog(true)} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition-all duration-200 hover:border-electric/50 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
            <FolderPlus className="h-5 w-5 shrink-0 text-electric" />Add a project
          </button>
          <button onClick={() => setCapabilityDialog(true)} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition-all duration-200 hover:border-electric/50 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
            <Layers className="h-5 w-5 shrink-0 text-electric" />Add a capability
          </button>
          <button
            onClick={() => (competencies.length === 0 ? toast.info("Add a capability first.") : setEvidenceDialog(true))}
            className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition-all duration-200 hover:border-electric/50 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2"
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
              {competencies.map((c) => {
                const items = evidence.filter((e) => e.competency_id === c.id);
                return (
                  <li key={c.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{c.skills?.name ?? "Unknown skill"}</span>
                      <StatusBadge status={competencyStatus(c)} />
                    </div>
                    {items.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t pt-2">
                        {items.map((e) => {
                          const href = safeHref(e.link);
                          return href ? (
                            <li key={e.id}>
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-electric hover:underline">
                                {e.title}
                              </a>
                            </li>
                          ) : (
                            <li key={e.id} className="text-xs text-muted-foreground">{e.title}</li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
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
          <div className="space-y-3">
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
            <div className="space-y-1.5">
              <Label htmlFor="evidence-title">Title</Label>
              <Input
                id="evidence-title"
                value={evidenceForm.title}
                onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })}
                placeholder="e.g. AquaLoop v3 pilot results"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evidence-link">Link (optional)</Label>
              <Input
                id="evidence-link"
                type="url"
                value={evidenceForm.link}
                onChange={(e) => setEvidenceForm({ ...evidenceForm, link: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evidence-note">Note (optional)</Label>
              <Textarea
                id="evidence-note"
                rows={2}
                value={evidenceForm.note}
                onChange={(e) => setEvidenceForm({ ...evidenceForm, note: e.target.value })}
                placeholder="What does this show, and what was your role?"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">File attachments aren't built yet — link to where the evidence already lives (Drive, GitHub, a write-up, etc).</p>
          <DialogFooter><Button onClick={addEvidence} disabled={saving || !evidenceCompetencyId || !evidenceForm.title.trim()}>Save</Button></DialogFooter>
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
    // is_adult is server-controlled (declare_adult RPC) — never sent from here.
    const { error } = await supabase.from("twins").upsert(
      {
        id: twin.id,
        name: form.name,
        institution: form.institution,
        programme: form.programme,
        year: form.year,
        headline: form.headline,
        visibility: form.visibility,
      },
      { onConflict: "id" },
    );
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
