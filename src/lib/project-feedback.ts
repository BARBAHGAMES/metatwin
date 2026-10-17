// Client wrappers for the visitor-feedback functions (20261015200100_add_project_feedback).
// None of these return reviewer contact details except adminListProjectFeedback,
// which the database only answers for a verified platform admin.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Fns = Database["public"]["Functions"];
export type MyProjectFeedback = Fns["get_my_project_feedback"]["Returns"][number];
export type InstitutionFeedback = Fns["get_my_institution_feedback"]["Returns"][number];
export type AdminProjectFeedback = Fns["admin_list_project_feedback"]["Returns"][number];

export type FeedbackSnapshot = { title?: string; problem_statement?: string | null; proposed_solution?: string | null; pitch_deck_url?: string | null; stage?: string };

export async function fetchMyProjectFeedback(projectId?: string): Promise<MyProjectFeedback[]> {
  const { data, error } = await supabase.rpc("get_my_project_feedback", projectId ? { p_project_id: projectId } : {});
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setProjectFeedbackHidden(feedbackId: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_project_feedback_hidden", { p_feedback_id: feedbackId, p_hidden: hidden });
  if (error) throw new Error(error.message);
}

export async function reportProjectFeedback(feedbackId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("report_project_feedback", { p_feedback_id: feedbackId, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function fetchInstitutionFeedback(): Promise<InstitutionFeedback[]> {
  const { data, error } = await supabase.rpc("get_my_institution_feedback");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminListProjectFeedback(): Promise<AdminProjectFeedback[]> {
  const { data, error } = await supabase.rpc("admin_list_project_feedback");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminDeleteProjectFeedback(feedbackId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_project_feedback", { p_feedback_id: feedbackId });
  if (error) throw new Error(error.message);
}

/** True when the project's problem/solution changed after this feedback was given. */
export function aboutEarlierVersion(
  snapshot: unknown,
  current: { problem_statement: string | null; proposed_solution: string | null },
): boolean {
  const s = (snapshot ?? {}) as FeedbackSnapshot;
  const norm = (v: string | null | undefined) => (v ?? "").trim();
  return norm(s.problem_statement) !== norm(current.problem_statement) || norm(s.proposed_solution) !== norm(current.proposed_solution);
}

export function averageRating(items: { rating: number }[]): number | null {
  if (!items.length) return null;
  return Math.round((items.reduce((a, f) => a + f.rating, 0) / items.length) * 10) / 10;
}

// "New" = confirmed after the student last opened their feedback (per device).
const SEEN_KEY = "metatwin:feedback-seen-at";
export function feedbackSeenAt(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
}
export function markFeedbackSeen(): void {
  if (typeof window !== "undefined") window.localStorage.setItem(SEEN_KEY, String(Date.now()));
}
export function countNewFeedback(items: { confirmed_at: string | null; hidden_by_owner: boolean }[], seenAt = feedbackSeenAt()): number {
  return items.filter((f) => !f.hidden_by_owner && f.confirmed_at && new Date(f.confirmed_at).getTime() > seenAt).length;
}

export type DeckViews = { project_id: string; total: number; last_7_days: number; last_viewed_at: string | null; countries: { country: string; views: number }[] };

export async function fetchMyDeckViews(projectId: string): Promise<DeckViews | null> {
  const { data, error } = await supabase.rpc("get_my_deck_views", { p_project_id: projectId });
  if (error) throw new Error(error.message);
  const row = (data as unknown as DeckViews[] | null)?.[0];
  return row ? { ...row, total: Number(row.total), last_7_days: Number(row.last_7_days) } : null;
}
