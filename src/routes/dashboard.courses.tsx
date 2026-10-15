import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { addCourse, deleteCourse, fetchMyCourses, updateCourse, type MyCourse } from "@/lib/courses";
import { LIMITS } from "@/lib/limits";
import { safeHref } from "@/lib/url";
import { useDashboard } from "@/lib/dashboard-context";
import { Card } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadError } from "@/components/LoadError";
import { DeleteConfirmDialog, type DeleteTarget } from "@/components/DeleteConfirmDialog";

export const Route = createFileRoute("/dashboard/courses")({
  component: CoursesTab,
});

const emptyForm = { name: "", term: "", grade: "", certificateUrl: "" };

function CoursesTab() {
  const { userId } = useDashboard();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchMyCourses(userId)
      .then((c) => {
        if (cancelled) return;
        setCourses(c);
        setState("ready");
      })
      .catch((e) => {
        console.error("[dashboard courses] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  async function add() {
    if (!form.name.trim()) {
      toast.error("Add a course title.");
      return;
    }
    setAdding(true);
    try {
      await addCourse(userId, { name: form.name, grade: form.grade, term: form.term, certificateUrl: form.certificateUrl });
      setForm(emptyForm);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that course.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(c: MyCourse) {
    setEditingId(c.id);
    setEditForm({ name: c.name, term: c.term ?? "", grade: c.grade ?? "", certificateUrl: c.certificate_url ?? "" });
  }

  async function saveEdit() {
    if (!editingId || !editForm.name.trim()) return;
    setSavingEdit(true);
    try {
      await updateCourse(editingId, { name: editForm.name, grade: editForm.grade, term: editForm.term, certificateUrl: editForm.certificateUrl });
      setEditingId(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that course.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCourse(deleteTarget.id);
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete that course.");
    } finally {
      setDeleting(false);
    }
  }

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <p className="text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_1.5fr_auto]">
          <Input placeholder="Course title" maxLength={LIMITS.courseName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="School or provider" maxLength={LIMITS.courseTerm} value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
          <Input placeholder="Grade (optional)" maxLength={LIMITS.courseGrade} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <Input placeholder="Certificate link (optional)" value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })} />
          <Button onClick={add} disabled={adding || !form.name.trim()}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </Card>

      {courses.length === 0 ? (
        <Card className="border-dashed"><p className="text-sm text-muted-foreground">Nothing yet.</p></Card>
      ) : (
        <ul className="space-y-2">
          {courses.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="space-y-2 rounded-xl border bg-card p-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="Course title" maxLength={LIMITS.courseName} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <Input placeholder="School or provider" maxLength={LIMITS.courseTerm} value={editForm.term} onChange={(e) => setEditForm({ ...editForm, term: e.target.value })} />
                  <Input placeholder="Grade (optional)" maxLength={LIMITS.courseGrade} value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} />
                </div>
                <Input placeholder="Certificate link (optional)" value={editForm.certificateUrl} onChange={(e) => setEditForm({ ...editForm, certificateUrl: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? "Saving…" : "Save"}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={savingEdit}>Cancel</Button>
                </div>
              </li>
            ) : (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{[c.term, c.grade].filter(Boolean).join(" · ") || "No details yet"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {safeHref(c.certificate_url) && (
                    <a href={safeHref(c.certificate_url)!} target="_blank" rel="noopener noreferrer" aria-label="View certificate" className="rounded p-1.5 text-muted-foreground hover:text-electric">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button type="button" onClick={() => startEdit(c)} aria-label="Edit course" className="cursor-pointer rounded p-2.5 sm:p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDeleteTarget({ kind: "course", id: c.id, label: c.name })} aria-label="Delete course" className="cursor-pointer rounded p-2.5 sm:p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <DeleteConfirmDialog target={deleteTarget} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
