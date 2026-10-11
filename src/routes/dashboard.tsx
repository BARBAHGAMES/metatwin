import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderPlus, FilePlus2, Layers, ArrowRight, Info, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { aiEmployees } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, HeroBackdrop, PreviewTag, Section, StatusBadge } from "@/components/site";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdultGate } from "@/components/AdultGate";
import { LINK_ERROR, isHttpUrl, safeHref } from "@/lib/url";
import { LIMITS, validateStudyYear } from "@/lib/limits";
import { LoadError } from "@/components/LoadError";
import { fetchMyOpportunityMatches, type OpportunityMatch } from "@/lib/real-data";
import { HANDLE_HELP, normalizeHandle, publicProfilePath, validateHandle } from "@/lib/public-profile";
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
  handle: string | null;
  public_show_evidence_details: boolean;
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
  const [loadError, setLoadError] = useState(false);

  const [projectDialog, setProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", description: "" });
  const [capabilityDialog, setCapabilityDialog] = useState(false);
  const [capabilitySkillId, setCapabilitySkillId] = useState("");
  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [evidenceCompetencyId, setEvidenceCompetencyId] = useState("");
  const [evidenceProjectId, setEvidenceProjectId] = useState("");
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [matchesState, setMatchesState] = useState<"loading" | "error" | "ready">("loading");
  const [matchesReload, setMatchesReload] = useState(0);
  const [evidenceForm, setEvidenceForm] = useState({ title: "", link: "", note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  async function loadAll(userId: string) {
    const [twinRes, skillsRes, compsRes, projectsRes, evidenceRes] = await Promise.all([
      supabase.from("twins").select("id, name, institution, programme, year, headline, visibility, is_adult, handle, public_show_evidence_details").eq("id", userId).maybeSingle(),
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

    // A failed load must not render as an empty account (it reads as lost data).
    if ([twinRes, skillsRes, compsRes, projectsRes, evidenceRes].some((r) => r.error)) {
      setLoadError(true);
      setFetching(false);
      return;
    }
    setLoadError(false);

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
        handle: null,
        public_show_evidence_details: false,
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

  // Opportunity matches are scored on the server from the student's own
  // capabilities, so refresh them when the capability count changes.
  const isAdult = twin?.is_adult ?? false;
  const capabilityCount = competencies.length;
  const evidenceSignature = competencies.map((c) => c.evidence_count).join(",");
  useEffect(() => {
    if (!user || !isAdult) return;
    let cancelled = false;
    setMatchesState("loading");
    fetchMyOpportunityMatches()
      .then((m) => {
        if (cancelled) return;
        setMatches(m);
        setMatchesState("ready");
      })
      .catch((e) => {
        console.error("[dashboard] load opportunity matches failed:", e);
        if (!cancelled) setMatchesState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [user, isAdult, capabilityCount, evidenceSignature, matchesReload]);

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
      project_id: evidenceProjectId || null,
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
    setEvidenceProjectId("");
    setEvidenceForm({ title: "", link: "", note: "" });
    setEvidenceDialog(false);
    loadAll(user.id);
  }

  if (loadError) {
    return (
      <LoadError
        onRetry={() => {
          if (!user) return;
          setFetching(true);
          loadAll(user.id);
        }}
      />
    );
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-ink p-4 text-ink-foreground">
          <p className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4 text-electric" /> AI team concept: {aiEmployees.map((a) => `${a.name} (${a.role})`).join(" · ")}</p>
          <div className="flex items-center gap-2">
            <PreviewTag />
            <span className="text-xs text-ink-muted">Illustration only — no AI is working on your behalf yet.</span>
          </div>
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
          <h3 className="font-semibold">Opportunities for you</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Matches compare the skills an opportunity asks for with your capabilities. Evidence-backed skills count fully; self-reported
            ones count half. A match is a starting point, not a prediction.
          </p>
          {matchesState === "loading" && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
          {matchesState === "error" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">We couldn't load opportunities.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setMatchesReload((k) => k + 1)}>Try again</Button>
            </div>
          )}
          {matchesState === "ready" && matches.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              No opportunities have been added yet. When partners add them, the ones that fit your capabilities will appear here.
            </p>
          )}
          {matchesState === "ready" && matches.length > 0 && (
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
        </Card>

        <Card className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Profile</h3>
            <Button
              asChild
              variant="link"
              className="px-0"
            >
              <Link to="/profile">
                Preview my profile page <ArrowRight className="h-3.5 w-3.5" />
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
              <Input id="project-title" maxLength={LIMITS.projectTitle} value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="e.g. AquaLoop Greywater Filter" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Textarea id="project-description" rows={3} maxLength={LIMITS.projectDescription} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="What is it, and what's your role?" />
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
            {projects.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="evidence-project">Related project (optional)</Label>
                <select
                  id="evidence-project"
                  value={evidenceProjectId}
                  onChange={(e) => setEvidenceProjectId(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="evidence-title">Title</Label>
              <Input
                id="evidence-title"
                maxLength={LIMITS.evidenceTitle}
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
                maxLength={LIMITS.evidenceNote}
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
  const publicBase = typeof window === "undefined" ? "" : window.location.origin;

  async function save() {
    const yearError = validateStudyYear(form.year);
    if (yearError) {
      toast.error(yearError);
      return;
    }
    const handle = normalizeHandle(form.handle ?? "");
    const isPublic = form.visibility === "public";
    if (handle || isPublic) {
      const handleError = validateHandle(handle);
      if (handleError) {
        toast.error(isPublic && !handle ? "Choose a handle to make your profile public." : handleError);
        return;
      }
    }
    if (isPublic && !form.name?.trim()) {
      toast.error("Add your name before making your profile public.");
      return;
    }
    setSaving(true);
    // is_adult is server-controlled (declare_adult RPC) — never sent from here.
    const payload = {
      name: form.name,
      institution: form.institution,
      programme: form.programme,
      year: form.year,
      headline: form.headline,
      visibility: form.visibility,
      handle: handle || null,
      public_show_evidence_details: form.public_show_evidence_details,
    };
    // A plain UPDATE, not upsert: upsert compiles to INSERT ... ON CONFLICT DO
    // UPDATE, and Postgres fires guard_twin_protected_columns()'s BEFORE INSERT
    // branch (which force-resets is_adult/birth_year) and validates
    // twins_public_requires_adult against that tentative row BEFORE the
    // conflict/update path even runs — so going public always failed for every
    // existing adult user. The twins row always exists by the time this form
    // renders (handle_new_user creates it on signup); insert only as a fallback.
    const { data: updated, error: updateError } = await supabase
      .from("twins")
      .update(payload)
      .eq("id", twin.id)
      .select("id");
    let error = updateError;
    if (!error && (!updated || updated.length === 0)) {
      ({ error } = await supabase.from("twins").insert({ id: twin.id, ...payload }));
    }
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "That handle is already taken. Try another." : error.message);
      return;
    }
    toast.success("Profile saved.");
    onSaved();
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input maxLength={LIMITS.name} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Headline</Label>
        <Input maxLength={LIMITS.headline} value={form.headline ?? ""} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Institution</Label>
        <Input maxLength={LIMITS.institution} value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Programme</Label>
        <Input maxLength={LIMITS.programme} value={form.programme ?? ""} onChange={(e) => setForm({ ...form, programme: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Year</Label>
        <Input
          type="number"
          min={LIMITS.studyYearMin}
          max={LIMITS.studyYearMax}
          value={form.year ?? ""}
          onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
      <div className="space-y-4 rounded-xl border bg-muted/30 p-4 sm:col-span-2">
        <div>
          <h4 className="font-semibold">Public profile</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. Your profile is private unless you turn this on. When public, anyone with your link can view it.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-handle">Your link</Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">{publicBase}/t/</span>
            <Input
              id="profile-handle"
              maxLength={30}
              value={form.handle ?? ""}
              onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })}
              placeholder="your-name"
            />
          </div>
          <p className="text-xs text-muted-foreground">{HANDLE_HELP}</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.visibility === "public"}
            onChange={(e) => setForm({ ...form, visibility: e.target.checked ? "public" : "private" })}
          />
          <span>Make my profile public</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.public_show_evidence_details}
            onChange={(e) => setForm({ ...form, public_show_evidence_details: e.target.checked })}
          />
          <span>Also show my evidence links, evidence notes and project links</span>
        </label>
        <p className="text-xs text-muted-foreground">
          The public page shows your name, headline, institution, programme, capabilities, evidence titles and projects. It never
          shows your email, birth year or year of study.
        </p>
        {twin.visibility === "public" && twin.handle && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-3 text-sm">
            <span className="min-w-0 truncate font-mono text-xs">{publicBase}{publicProfilePath(twin.handle)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(`${publicBase}${publicProfilePath(twin.handle!)}`)
                  .then(() => toast.success("Link copied."))
                  .catch(() => toast.error("Couldn't copy — select the link and copy it manually."));
              }}
            >
              Copy link
            </Button>
            <Button asChild type="button" variant="link" size="sm" className="px-0">
              <a href={publicProfilePath(twin.handle)} target="_blank" rel="noopener noreferrer">View public page</a>
            </Button>
          </div>
        )}
      </div>
      <div className="sm:col-span-2">
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
      </div>
    </div>
  );
}
