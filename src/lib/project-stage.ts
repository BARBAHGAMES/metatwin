export type ProjectStage = "idea" | "in_progress" | "prototype" | "completed";

export const STAGE_LABELS: Record<ProjectStage, string> = {
  idea: "Idea",
  in_progress: "In Progress",
  prototype: "Prototype",
  completed: "Completed",
};

export const COMPLETION_REASONS = [
  { value: "abandoned", label: "The team abandoned it" },
  { value: "graduated", label: "The team graduated" },
  { value: "business_adopted", label: "A business adopted it" },
] as const;

export function completionReasonLabel(reason: string | null): string | null {
  return COMPLETION_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

// Mirrors recompute_project_stage's own thresholds: 10 interviews to enter In
// Progress, 40 total (plus a video pitch link, checked separately) for Prototype.
export function nextInterviewTarget(stage: ProjectStage): number | null {
  if (stage === "idea") return 10;
  if (stage === "in_progress") return 40;
  return null;
}
