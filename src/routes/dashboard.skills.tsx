import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, StatusBadge } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/limits";
import { LINK_ERROR, isHttpUrl, safeHref } from "@/lib/url";
import { useDashboard } from "@/lib/dashboard-context";
import { DeleteConfirmDialog, type DeleteTarget } from "@/components/DeleteConfirmDialog";
import { LoadError } from "@/components/LoadError";
import type { Status } from "@/lib/data";

export const Route = createFileRoute("/dashboard/skills")({
  component: SkillsTab,
});

type Skill = { id: string; name: string; category: string | null };
type Competency = { id: string; skill_id: string; level: number; evidence_count: number; skills: { name: string } | null };
type Evidence = { id: string; competency_id: string; project_id: string | null; title: string; link: string | null; note: string | null };
type EvidenceReview = { id: string; evidence_id: string; reviewer_name: string; reviewer_role: string | null; comment: string | null; submitted_at: string };
type Project = { id: string; title: string };

function competencyStatus(c: Competency, evidence: Evidence[], reviews: EvidenceReview[]): Status {
  const evidenceIds = evidence.filter((e) => e.competency_id === c.id).map((e) => e.id);
  if (reviews.some((r) => evidenceIds.includes(r.evidence_id))) return "reviewed";
  return c.evidence_count > 0 ? "evidence" : "self";
}

function SkillsTab() {
  const { userId } = useDashboard();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [reviews, setReviews] = useState<EvidenceReview[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [newSkillId, setNewSkillId] = useState("");
  const [newLevel, setNewLevel] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editingCompetencyId, setEditingCompetencyId] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState(1);

  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [evidenceCompetencyId, setEvidenceCompetencyId] = useState("");
  const [evidenceProjectId, setEvidenceProjectId] = useState("");
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({ title: "", link: "", note: "" });
  const [saving, setSaving] = useState(false);

  const [reviewDialogEvidenceId, setReviewDialogEvidenceId] = useState<string | null>(null);
  const [reviewerForm, setReviewerForm] = useState({ name: "", role: "" });
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [invitingReviewer, setInvitingReviewer] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    Promise.all([
      supabase.from("skills").select("id, name, category").order("name"),
      supabase.from("competencies").select("id, skill_id, level, evidence_count, skills(name)").eq("twin_id", userId).order("updated_at", { ascending: false }),
      supabase.from("evidence").select("id, competency_id, project_id, title, link, note").eq("twin_id", userId).order("created_at", { ascending: false }),
      supabase.from("evidence_reviews").select("id, evidence_id, reviewer_name, reviewer_role, comment, submitted_at").eq("twin_id", userId),
      supabase.from("projects").select("id, title").eq("twin_id", userId).order("created_at", { ascending: false }),
    ])
      .then(([skillsRes, compsRes, evidenceRes, reviewsRes, projectsRes]) => {
        if (cancelled) return;
        if ([skillsRes, compsRes, evidenceRes, reviewsRes, projectsRes].some((r) => r.error)) {
          setState("error");
          return;
        }
        setSkills((skillsRes.data as Skill[] | null) ?? []);
        setCompetencies((compsRes.data as unknown as Competency[] | null) ?? []);
        setEvidence((evidenceRes.data as Evidence[] | null) ?? []);
        setReviews((reviewsRes.data as EvidenceReview[] | null) ?? []);
        setProjects((projectsRes.data as Project[] | null) ?? []);
        setState("ready");
      })
      .catch((e) => {
        console.error("[dashboard skills] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const availableSkills = skills.filter((s) => !competencies.some((c) => c.skill_id === s.id));

  async function addCompetency() {
    if (!newSkillId) return;
    setAdding(true);
    const { error } = await supabase.from("competencies").insert({ twin_id: userId, skill_id: newSkillId, level: newLevel });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Skill added — self-reported.");
    setNewSkillId("");
    setNewLevel(1);
    setReloadKey((k) => k + 1);
  }

  async function saveLevel(competencyId: string) {
    const { error } = await supabase.from("competencies").update({ level: editLevel }).eq("id", competencyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingCompetencyId(null);
    setReloadKey((k) => k + 1);
  }

  function openAddEvidenceDialog(competencyId: string) {
    setEditingEvidenceId(null);
    setEvidenceCompetencyId(competencyId);
    setEvidenceProjectId("");
    setEvidenceForm({ title: "", link: "", note: "" });
    setEvidenceDialog(true);
  }

  function openEditEvidenceDialog(e: Evidence) {
    setEditingEvidenceId(e.id);
    setEvidenceCompetencyId(e.competency_id);
    setEvidenceProjectId(e.project_id ?? "");
    setEvidenceForm({ title: e.title, link: e.link ?? "", note: e.note ?? "" });
    setEvidenceDialog(true);
  }

  async function saveEvidence() {
    if (!evidenceCompetencyId || !evidenceForm.title.trim()) return;
    const link = evidenceForm.link.trim();
    if (link && !isHttpUrl(link)) {
      toast.error(LINK_ERROR);
      return;
    }
    setSaving(true);
    if (editingEvidenceId) {
      const { error } = await supabase
        .from("evidence")
        .update({ title: evidenceForm.title.trim(), link: link || null, note: evidenceForm.note.trim() || null })
        .eq("id", editingEvidenceId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Evidence updated.");
      setEvidenceDialog(false);
      setReloadKey((k) => k + 1);
      return;
    }
    const { error } = await supabase.from("evidence").insert({
      twin_id: userId,
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
    setEvidenceDialog(false);
    setReloadKey((k) => k + 1);
  }

  function openReviewDialog(evidenceId: string) {
    setReviewDialogEvidenceId(evidenceId);
    setReviewerForm({ name: "", role: "" });
    setReviewLink(null);
  }

  async function inviteReviewer() {
    if (!reviewDialogEvidenceId || !reviewerForm.name.trim()) return;
    setInvitingReviewer(true);
    // Generated client-side — RLS only lets the owner SELECT a submitted
    // review, so an insert().select() round-trip on a fresh invite would fail.
    const token = crypto.randomUUID();
    const { error } = await supabase.from("evidence_reviews").insert({
      twin_id: userId,
      evidence_id: reviewDialogEvidenceId,
      reviewer_name: reviewerForm.name.trim(),
      reviewer_role: reviewerForm.role.trim() || null,
      token,
    });
    setInvitingReviewer(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReviewLink(`${window.location.origin}/review/${token}`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const table = deleteTarget.kind === "capability" ? "competencies" : "evidence";
    const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${deleteTarget.kind === "capability" ? "Skill" : "Evidence"} deleted.`);
    setDeleteTarget(null);
    setReloadKey((k) => k + 1);
  }

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <p className="text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <select value={newSkillId} onChange={(e) => setNewSkillId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Skill…</option>
            {availableSkills.map((s) => <option key={s.id} value={s.id}>{s.name}{s.category ? ` — ${s.category}` : ""}</option>)}
          </select>
          <select value={newLevel} onChange={(e) => setNewLevel(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
          </select>
          <Button onClick={addCompetency} disabled={adding || !newSkillId}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {availableSkills.length === 0 && skills.length > 0 && <p className="mt-2 text-xs text-muted-foreground">You've added every skill in the current catalog.</p>}
      </Card>

      {competencies.length === 0 ? (
        <Card className="border-dashed"><p className="text-sm text-muted-foreground">Nothing yet.</p></Card>
      ) : (
        <ul className="space-y-2">
          {competencies.map((c) => {
            const items = evidence.filter((e) => e.competency_id === c.id);
            return (
              <li key={c.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 font-medium">{c.skills?.name ?? "Unknown skill"}</span>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusBadge status={competencyStatus(c, evidence, reviews)} />
                    {editingCompetencyId === c.id ? (
                      <>
                        <select value={editLevel} onChange={(e) => setEditLevel(Number(e.target.value))} className="h-8 rounded-md border bg-background px-2 text-xs">
                          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
                        </select>
                        <Button size="sm" onClick={() => saveLevel(c.id)}>Save</Button>
                      </>
                    ) : (
                      <button type="button" onClick={() => { setEditingCompetencyId(c.id); setEditLevel(c.level); }} aria-label="Edit skill level" className="cursor-pointer rounded p-2.5 sm:p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => setDeleteTarget({ kind: "capability", id: c.id, label: c.skills?.name ?? "this skill" })} aria-label="Delete skill" className="cursor-pointer rounded p-2.5 sm:p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {items.length > 0 && (
                  <ul className="mt-2 space-y-2 border-t pt-2">
                    {items.map((e) => {
                      const href = safeHref(e.link);
                      const review = reviews.find((r) => r.evidence_id === e.id);
                      return (
                        <li key={e.id}>
                          <div className="flex items-center justify-between gap-2">
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-electric hover:underline">{e.title}</a>
                            ) : (
                              <span className="truncate text-xs text-muted-foreground">{e.title}</span>
                            )}
                            <div className="flex shrink-0 items-center gap-2">
                              {!review && <button type="button" onClick={() => openReviewDialog(e.id)} className="cursor-pointer text-xs text-electric hover:underline -my-2 py-2 sm:my-0 sm:py-0">Invite a reviewer</button>}
                              <button type="button" onClick={() => openEditEvidenceDialog(e)} aria-label="Edit evidence" className="cursor-pointer rounded p-2.5 sm:p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Pencil className="h-3 w-3" /></button>
                              <button type="button" onClick={() => setDeleteTarget({ kind: "evidence", id: e.id, label: e.title })} aria-label="Delete evidence" className="cursor-pointer rounded p-2.5 sm:p-0.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                          {review && (
                            <div className="mt-1 rounded-md bg-status-reviewed-bg p-2 text-xs text-status-reviewed">
                              <p className="font-medium">Review · {review.reviewer_name}{review.reviewer_role ? ` · ${review.reviewer_role}` : ""}</p>
                              {review.comment && <p className="mt-0.5 text-muted-foreground">{review.comment}</p>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button type="button" onClick={() => openAddEvidenceDialog(c.id)} className="mt-2 flex cursor-pointer items-center gap-1 py-2 text-xs text-electric hover:underline sm:py-0">
                  <FilePlus2 className="h-3 w-3" /> Add evidence
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={evidenceDialog} onOpenChange={setEvidenceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEvidenceId ? "Edit evidence" : "Add evidence"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {projects.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="evidence-project">Related project (optional)</Label>
                <select id="evidence-project" value={evidenceProjectId} onChange={(e) => setEvidenceProjectId(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="evidence-title">Title</Label>
              <Input id="evidence-title" maxLength={LIMITS.evidenceTitle} value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })} placeholder="e.g. AquaLoop v3 pilot results" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evidence-link">Link (optional)</Label>
              <Input id="evidence-link" type="url" value={evidenceForm.link} onChange={(e) => setEvidenceForm({ ...evidenceForm, link: e.target.value })} placeholder="Paste a link to a Google Doc, Drive file, GitHub repo…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evidence-note">Note (optional)</Label>
              <Textarea id="evidence-note" maxLength={LIMITS.evidenceNote} rows={2} value={evidenceForm.note} onChange={(e) => setEvidenceForm({ ...evidenceForm, note: e.target.value })} placeholder="What does this show, and what was your role?" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">File attachments aren't built yet — link to where the evidence already lives (Drive, GitHub, a write-up, etc).</p>
          <DialogFooter><Button onClick={saveEvidence} disabled={saving || !evidenceForm.title.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewDialogEvidenceId} onOpenChange={(open) => !open && setReviewDialogEvidenceId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a reviewer</DialogTitle></DialogHeader>
          {reviewLink ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Send this link to {reviewerForm.name} — it's single-use and expires in 14 days. They don't need an account.</p>
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{reviewLink}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(reviewLink)
                      .then(() => toast.success("Link copied."))
                      .catch(() => toast.error("Couldn't copy — select the link and copy it manually."));
                  }}
                >
                  Copy link
                </Button>
              </div>
              <DialogFooter><Button onClick={() => setReviewDialogEvidenceId(null)}>Done</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reviewer-name">Reviewer's name</Label>
                <Input id="reviewer-name" maxLength={120} value={reviewerForm.name} onChange={(e) => setReviewerForm({ ...reviewerForm, name: e.target.value })} placeholder="e.g. Dr. Imani Wekesa" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reviewer-role">Their role (optional)</Label>
                <Input id="reviewer-role" maxLength={120} value={reviewerForm.role} onChange={(e) => setReviewerForm({ ...reviewerForm, role: e.target.value })} placeholder="e.g. Industrial Design Lecturer" />
              </div>
              <p className="text-xs text-muted-foreground">You'll get a link to send them yourself — by email, WhatsApp, whatever works. A "Reviewed" status only appears once they've actually looked at this specific evidence.</p>
              <DialogFooter><Button onClick={inviteReviewer} disabled={invitingReviewer || !reviewerForm.name.trim()}>{invitingReviewer ? "Creating…" : "Create link"}</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        target={deleteTarget}
        evidenceCount={deleteTarget?.kind === "capability" ? evidence.filter((e) => e.competency_id === deleteTarget.id).length : undefined}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
