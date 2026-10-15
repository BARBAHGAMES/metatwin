import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, FileText, GraduationCap, Pencil, PlayCircle, Plus, Rocket, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/limits";
import { STAGE_LABELS, type ProjectStage } from "@/lib/project-stage";
import { safeHref } from "@/lib/url";
import { fetchMyProjectGrades, type MyProjectGrade } from "@/lib/school-admin";
import { useDashboard } from "@/lib/dashboard-context";
import { DeleteConfirmDialog, type DeleteTarget } from "@/components/DeleteConfirmDialog";
import { LoadError } from "@/components/LoadError";

export const Route = createFileRoute("/dashboard/projects")({
  component: ProjectsTab,
});

type Project = {
  id: string;
  title: string;
  description: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
  created_at: string;
  pitch_deck_url: string | null;
  pitch_video_url: string | null;
  stage: ProjectStage;
};
type PitchStatsRow = { project_id: string; total_pitches: number };

function ProjectsTab() {
  const { userId } = useDashboard();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [projects, setProjects] = useState<Project[]>([]);
  const [pitchStats, setPitchStats] = useState<PitchStatsRow[]>([]);
  const [grades, setGrades] = useState<MyProjectGrade[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", problemStatement: "", proposedSolution: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    Promise.all([
      supabase
        .from("projects")
        .select("id, title, description, problem_statement, proposed_solution, created_at, pitch_deck_url, pitch_video_url, stage")
        .eq("twin_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("pitch_stats").select("project_id, total_pitches").eq("twin_id", userId),
      fetchMyProjectGrades(),
    ])
      .then(([projectsRes, pitchStatsRes, gradesRes]) => {
        if (cancelled) return;
        if (projectsRes.error || pitchStatsRes.error) {
          setState("error");
          return;
        }
        setProjects((projectsRes.data as Project[] | null) ?? []);
        setPitchStats((pitchStatsRes.data as PitchStatsRow[] | null) ?? []);
        setGrades(gradesRes);
        setState("ready");
      })
      .catch((e) => {
        console.error("[dashboard projects] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  async function addProject() {
    if (!newTitle.trim()) return;
    setAdding(true);
    const { data, error } = await supabase.from("projects").insert({ twin_id: userId, title: newTitle.trim() }).select("id").single();
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project added — let's attach a pitch deck or video.");
    setNewTitle("");
    if (data) navigate({ to: "/projects/$id", params: { id: data.id } });
  }

  function openEdit(p: Project) {
    setEditingId(p.id);
    setEditForm({ title: p.title, description: p.description ?? "", problemStatement: p.problem_statement ?? "", proposedSolution: p.proposed_solution ?? "" });
    setEditDialog(true);
  }

  async function saveEdit() {
    if (!editingId || !editForm.title.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        problem_statement: editForm.problemStatement.trim() || null,
        proposed_solution: editForm.proposedSolution.trim() || null,
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project updated.");
    setEditDialog(false);
    setReloadKey((k) => k + 1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("projects").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project deleted.");
    setDeleteTarget(null);
    setReloadKey((k) => k + 1);
  }

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <p className="text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Input
          placeholder="New project title"
          value={newTitle}
          maxLength={LIMITS.projectTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addProject()}
        />
        <Button onClick={addProject} disabled={adding || !newTitle.trim()}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed"><p className="text-sm text-muted-foreground">No projects yet — add one above to get started.</p></Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const stats = pitchStats.find((s) => s.project_id === p.id);
            const grade = grades.find((g) => g.project_id === p.id);
            const hasDeck = !!safeHref(p.pitch_deck_url);
            const hasVideo = !!safeHref(p.pitch_video_url);
            return (
              <li key={p.id} className="flex items-start gap-2 rounded-xl border bg-card p-4 transition-all duration-200 hover:border-electric/50">
                <Link to="/projects/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{p.title}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{STAGE_LABELS[p.stage]}</span>
                  </div>
                  {p.description && <p className="mt-1 truncate text-sm text-muted-foreground">{p.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={`flex items-center gap-1 ${hasDeck ? "text-electric" : "text-muted-foreground"}`}><FileText className="h-3 w-3" /> {hasDeck ? "Deck added" : "No deck yet"}</span>
                    <span className={`flex items-center gap-1 ${hasVideo ? "text-electric" : "text-muted-foreground"}`}><PlayCircle className="h-3 w-3" /> {hasVideo ? "Video added" : "No video yet"}</span>
                    <span className={`flex items-center gap-1 ${stats && stats.total_pitches > 0 ? "text-electric" : "text-muted-foreground"}`}>
                      <Rocket className="h-3 w-3" /> {stats?.total_pitches ?? 0} business{stats?.total_pitches === 1 ? "" : "es"} pitched
                    </span>
                    {grade && <span className="flex items-center gap-1 text-electric"><GraduationCap className="h-3 w-3" /> {grade.rating_label}</span>}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => openEdit(p)} aria-label="Edit project" className="cursor-pointer rounded p-2.5 sm:p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDeleteTarget({ kind: "project", id: p.id, label: p.title })} aria-label="Delete project" className="cursor-pointer rounded p-2.5 sm:p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Trash2 className="h-4 w-4" /></button>
                  <Link to="/projects/$id" params={{ id: p.id }} aria-label="Open project" className="rounded p-1.5 text-muted-foreground hover:text-foreground"><ArrowRight className="h-4 w-4" /></Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-title">Title</Label>
              <Input id="project-title" maxLength={LIMITS.projectTitle} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Textarea id="project-description" rows={3} maxLength={LIMITS.projectDescription} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="What is it, and what's your role?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-problem">Problem statement</Label>
              <Textarea id="project-problem" rows={3} maxLength={LIMITS.projectProblemStatement} value={editForm.problemStatement} onChange={(e) => setEditForm({ ...editForm, problemStatement: e.target.value })} placeholder="What problem were you solving?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-solution">Proposed solution</Label>
              <Textarea id="project-solution" rows={3} maxLength={LIMITS.projectProposedSolution} value={editForm.proposedSolution} onChange={(e) => setEditForm({ ...editForm, proposedSolution: e.target.value })} placeholder="How does your project solve it?" />
            </div>
          </div>
          <DialogFooter><Button onClick={saveEdit} disabled={saving || !editForm.title.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog target={deleteTarget} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
