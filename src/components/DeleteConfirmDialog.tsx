import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type DeleteTarget = { kind: "project" | "capability" | "evidence" | "course"; id: string; label: string };

const KIND_LABEL: Record<DeleteTarget["kind"], string> = {
  project: "Project",
  capability: "Capability",
  evidence: "Evidence",
  course: "Course",
};

// Shared across the Projects and Skills tabs (and Courses) — the cascade
// warnings mirror the real FK behavior on each table, not just plausible-sounding copy.
export function DeleteConfirmDialog({
  target,
  evidenceCount,
  deleting,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget | null;
  evidenceCount?: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete {target ? KIND_LABEL[target.kind].toLowerCase() : ""}?</DialogTitle></DialogHeader>
        {target && (
          <p className="text-sm text-muted-foreground">
            {target.kind === "project" && (
              <>Deleting <strong>{target.label}</strong> also deletes its logged business pitches, GitHub sync, and academic grade (if any). Evidence linked to it stays on your MetaTwin, just unlinked from this project.</>
            )}
            {target.kind === "capability" && (
              <>Deleting <strong>{target.label}</strong> also permanently deletes the {evidenceCount ?? 0} evidence item{evidenceCount === 1 ? "" : "s"} attached to it — that's real proof content, not just a link.</>
            )}
            {target.kind === "evidence" && <>This evidence item will be permanently removed.</>}
            {target.kind === "course" && <>This course will be permanently removed.</>}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
