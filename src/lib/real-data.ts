import { supabase } from "@/integrations/supabase/client";
import type { Project as SampleProject } from "@/lib/data";

// Real (database-backed) data for the signed-in student's own pages. All of
// these reads go through the normal client, so RLS scopes them to the owner.

export type SkillRow = { id: string; name: string; slug: string; category: string | null };
export type EvidenceRow = {
  id: string;
  title: string;
  link: string | null;
  note: string | null;
  created_at: string;
  project_id: string | null;
  competency_id: string;
};
export type MyProject = { id: string; title: string; description: string | null; artifact_url: string | null; created_at: string };
export type OpportunityMatch = {
  id: string;
  title: string;
  org_name: string | null;
  description: string | null;
  url: string | null;
  score: number | null;
  matched_skills: string[];
  missing_skills: string[];
  required_count: number;
  evidence_backed_count: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID_RE.test(value);

// Hand-formatted (UTC) rather than Intl: month abbreviations differ between
// runtimes ("Sept" vs "Sep"), which would cause server/client text mismatches.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// Public read (skills are readable by everyone). Used by route loaders, which
// run on the server too, so failures degrade to "no real skills" rather than 500.
export async function fetchSkills(): Promise<SkillRow[]> {
  try {
    const { data, error } = await supabase.from("skills").select("id, name, slug, category").order("name");
    if (error) return [];
    return (data as SkillRow[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function fetchMyCapability(userId: string, skillId: string) {
  const comp = await supabase
    .from("competencies")
    .select("id, level, evidence_count, updated_at")
    .eq("twin_id", userId)
    .eq("skill_id", skillId)
    .maybeSingle();
  if (comp.error) throw new Error(comp.error.message);
  if (!comp.data) return null;
  const ev = await supabase
    .from("evidence")
    .select("id, title, link, note, created_at, project_id, competency_id")
    .eq("twin_id", userId)
    .eq("competency_id", comp.data.id)
    .order("created_at", { ascending: false });
  if (ev.error) throw new Error(ev.error.message);
  return { competency: comp.data, evidence: (ev.data as EvidenceRow[] | null) ?? [] };
}

export async function fetchMyProjects(userId: string) {
  const [proj, ev] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, artifact_url, created_at")
      .eq("twin_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("evidence")
      .select("id, title, link, note, created_at, project_id, competency_id")
      .eq("twin_id", userId)
      .order("created_at", { ascending: true }),
  ]);
  if (proj.error) throw new Error(proj.error.message);
  if (ev.error) throw new Error(ev.error.message);
  return { projects: (proj.data as MyProject[] | null) ?? [], evidence: (ev.data as EvidenceRow[] | null) ?? [] };
}

export async function fetchMyProject(userId: string, projectId: string) {
  const [proj, ev] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, artifact_url, created_at")
      .eq("twin_id", userId)
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("evidence")
      .select("id, title, link, note, created_at, project_id, competency_id")
      .eq("twin_id", userId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ]);
  if (proj.error) throw new Error(proj.error.message);
  if (ev.error) throw new Error(ev.error.message);
  if (!proj.data) return null;
  return { project: proj.data as MyProject, evidence: (ev.data as EvidenceRow[] | null) ?? [] };
}

export async function fetchMyOpportunityMatches(): Promise<OpportunityMatch[]> {
  const { data, error } = await supabase.rpc("get_my_opportunity_matches");
  if (error) throw new Error(error.message);
  return (data as OpportunityMatch[] | null) ?? [];
}

// A real project's journey, built only from dates we actually have: when the
// project was created and when each linked piece of evidence was added.
export function buildProjectTimeline(
  project: Pick<MyProject, "title" | "description" | "created_at">,
  evidence: Pick<EvidenceRow, "title" | "note" | "link" | "created_at">[],
): SampleProject["journey"] {
  const hostOf = (link: string | null): string | undefined => {
    if (!link) return undefined;
    try {
      return new URL(link).hostname;
    } catch {
      return undefined;
    }
  };
  const events = [
    { at: project.created_at, step: "Project started", text: project.description || project.title, material: undefined as string | undefined },
    ...evidence.map((e) => ({ at: e.created_at, step: "Evidence added", text: e.note ? `${e.title} — ${e.note}` : e.title, material: hostOf(e.link) })),
  ];
  return events
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((e) => ({ step: e.step, date: formatDate(e.at), text: e.text, ...(e.material ? { material: e.material } : {}) }));
}
