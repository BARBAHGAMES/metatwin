// Capability evidence statuses. Kept separate from data.ts (the fictional
// sample dataset) so shared UI like StatusBadge (site.tsx, on every page)
// doesn't pull the whole sample dataset into the bundle every page loads.
export type Status = "self" | "evidence" | "reviewed";

export const statusMeta: Record<Status, { label: string; desc: string }> = {
  self: { label: "Self-Reported", desc: "The individual states they have this capability." },
  evidence: { label: "Evidence Added", desc: "Supporting work has been attached." },
  reviewed: { label: "Reviewed", desc: "An identified reviewer has examined the specified evidence." },
};
