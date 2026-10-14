import { supabase } from "@/integrations/supabase/client";
import type { Project as SampleProject } from "@/lib/data";
import type { PitchScores } from "@/lib/scores";
import type { ProjectStage } from "@/lib/project-stage";
import { fetchMyProjectGrades, type MyProjectGrade } from "@/lib/school-admin";

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
export type MyProject = {
  id: string;
  title: string;
  description: string | null;
  problem_statement: string | null;
  proposed_solution: string | null;
  artifact_url: string | null;
  github_repo: string | null;
  writeup_url: string | null;
  pitch_deck_url: string | null;
  pitch_video_url: string | null;
  created_at: string;
  scores_csv_url: string | null;
  pitch_scores: PitchScores | Record<string, never>;
  scores_synced_at: string | null;
  stage: ProjectStage;
  interviews_csv_url: string | null;
  interviews_count: number;
  interviews_synced_at: string | null;
  open_to_collaborators: boolean;
  completion_reason: string | null;
  completed_at: string | null;
  team_id: string | null;
};
export type IncomingCollaborationRequest = {
  id: string;
  project_id: string;
  project_title: string;
  status: string;
  message: string | null;
  created_at: string;
  requester_handle: string | null;
  requester_name: string | null;
  requester_headline: string | null;
};
export type SentCollaborationRequest = {
  id: string;
  project_id: string;
  project_title: string;
  status: string;
  message: string | null;
  created_at: string;
  owner_handle: string | null;
  owner_name: string | null;
};
export type OpenCollaborationProject = {
  project_id: string;
  title: string;
  problem_statement: string | null;
  owner_twin_id: string;
  owner_handle: string | null;
  owner_name: string | null;
  owner_headline: string | null;
  owner_institution: string | null;
};
export type ProjectUpdateRow = {
  id: string;
  kind: "iteration" | "pivot";
  title: string;
  description: string | null;
  created_at: string;
};
export type GithubRepoRow = {
  full_name: string;
  url: string | null;
  description: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  language: string | null;
  last_commit_at: string | null;
  weekly_commits: unknown;
};
export type PitchRow = {
  id: string;
  business_name: string;
  sector: string | null;
  pitched_on: string;
  outcome: string;
  notes: string | null;
};
export type PitchStatsRow = {
  total_pitches: number;
  positive: number;
  customers: number;
  conversion_pct: number | null;
};
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
      .select("id, title, description, problem_statement, proposed_solution, artifact_url, github_repo, writeup_url, pitch_deck_url, pitch_video_url, created_at, scores_csv_url, pitch_scores, scores_synced_at, stage, interviews_csv_url, interviews_count, interviews_synced_at, open_to_collaborators, completion_reason, completed_at, team_id")
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
  const [proj, ev, repo, pitches, pitchStats, allGrades, updates, incomingRequests] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, problem_statement, proposed_solution, artifact_url, github_repo, writeup_url, pitch_deck_url, pitch_video_url, created_at, scores_csv_url, pitch_scores, scores_synced_at, stage, interviews_csv_url, interviews_count, interviews_synced_at, open_to_collaborators, completion_reason, completed_at, team_id")
      .eq("twin_id", userId)
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("evidence")
      .select("id, title, link, note, created_at, project_id, competency_id")
      .eq("twin_id", userId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("github_repos")
      .select("full_name, url, description, stars, forks, open_issues, language, last_commit_at, weekly_commits")
      .eq("twin_id", userId)
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("pitches")
      .select("id, business_name, sector, pitched_on, outcome, notes")
      .eq("twin_id", userId)
      .eq("project_id", projectId)
      .order("pitched_on", { ascending: false }),
    supabase
      .from("pitch_stats")
      .select("total_pitches, positive, customers, conversion_pct")
      .eq("twin_id", userId)
      .eq("project_id", projectId)
      .maybeSingle(),
    fetchMyProjectGrades(),
    supabase
      .from("project_updates")
      .select("id, kind, title, description, created_at")
      .eq("twin_id", userId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    fetchMyIncomingCollaborationRequests(),
  ]);
  if (proj.error) throw new Error(proj.error.message);
  if (ev.error) throw new Error(ev.error.message);
  if (repo.error) throw new Error(repo.error.message);
  if (pitches.error) throw new Error(pitches.error.message);
  if (pitchStats.error) throw new Error(pitchStats.error.message);
  if (updates.error) throw new Error(updates.error.message);
  if (!proj.data) return null;
  const grades = allGrades.filter((g) => g.project_id === projectId).sort((a, b) => (a.graded_at < b.graded_at ? 1 : -1));
  return {
    project: proj.data as MyProject,
    evidence: (ev.data as EvidenceRow[] | null) ?? [],
    githubRepo: repo.data as GithubRepoRow | null,
    pitches: (pitches.data as PitchRow[] | null) ?? [],
    pitchStats: pitchStats.data as PitchStatsRow | null,
    grade: (grades[0] as MyProjectGrade | undefined) ?? null,
    grades: grades as MyProjectGrade[],
    updates: (updates.data as ProjectUpdateRow[] | null) ?? [],
    incomingRequests: incomingRequests.filter((r) => r.project_id === projectId),
  };
}

export async function fetchMyIncomingCollaborationRequests(): Promise<IncomingCollaborationRequest[]> {
  const { data, error } = await supabase.rpc("list_my_incoming_collaboration_requests");
  if (error) throw new Error(error.message);
  return (data as IncomingCollaborationRequest[] | null) ?? [];
}

export async function fetchMySentCollaborationRequests(): Promise<SentCollaborationRequest[]> {
  const { data, error } = await supabase.rpc("list_my_sent_collaboration_requests");
  if (error) throw new Error(error.message);
  return (data as SentCollaborationRequest[] | null) ?? [];
}

export async function fetchOpenCollaborationProjects(): Promise<OpenCollaborationProject[]> {
  const { data, error } = await supabase.rpc("list_open_collaboration_projects");
  if (error) throw new Error(error.message);
  return (data as OpenCollaborationProject[] | null) ?? [];
}

export async function recomputeProjectStage(projectId: string): Promise<void> {
  const { error } = await supabase.rpc("recompute_project_stage", { p_project_id: projectId });
  if (error) throw new Error(error.message);
}

export async function markProjectComplete(projectId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("mark_project_complete", { p_project_id: projectId, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function acceptCollaborationRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_collaboration_request", { p_request_id: requestId });
  if (error) throw new Error(error.message);
}

export async function sendCollaborationRequest(opts: {
  requesterTwinId: string;
  projectId: string;
  ownerTwinId: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.from("collaboration_requests").insert({
    requester_twin_id: opts.requesterTwinId,
    project_id: opts.projectId,
    owner_twin_id: opts.ownerTwinId,
    message: opts.message.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function withdrawCollaborationRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from("collaboration_requests").delete().eq("id", requestId);
  if (error) throw new Error(error.message);
}

export async function fetchMyOpportunityMatches(): Promise<OpportunityMatch[]> {
  const { data, error } = await supabase.rpc("get_my_opportunity_matches");
  if (error) throw new Error(error.message);
  return (data as OpportunityMatch[] | null) ?? [];
}

// A real project's journey, built only from dates we actually have: when the
// project was created, when each linked piece of evidence was added, and —
// where the caller has them — the student's own logged updates (iterations
// and pivots), pitches given, and grades received.
export function buildProjectTimeline(
  project: Pick<MyProject, "title" | "description" | "created_at">,
  evidence: Pick<EvidenceRow, "title" | "note" | "link" | "created_at">[],
  updates: Pick<ProjectUpdateRow, "kind" | "title" | "description" | "created_at">[] = [],
  grades: Pick<MyProjectGrade, "rating_label" | "graded_at">[] = [],
  pitches: Pick<PitchRow, "business_name" | "outcome" | "pitched_on">[] = [],
): SampleProject["journey"] {
  const hostOf = (link: string | null): string | undefined => {
    if (!link) return undefined;
    try {
      return new URL(link).hostname;
    } catch {
      return undefined;
    }
  };
  const OUTCOME_LABELS: Record<string, string> = { interested: "Interested", "follow-up": "Follow-up", customer: "Customer", no: "No" };
  const events = [
    { at: project.created_at, step: "Project started", text: project.description || project.title, material: undefined as string | undefined },
    ...evidence.map((e) => ({ at: e.created_at, step: "Evidence added", text: e.note ? `${e.title} — ${e.note}` : e.title, material: hostOf(e.link) })),
    ...updates.map((u) => ({
      at: u.created_at,
      step: u.kind === "pivot" ? "Pivot" : "Iteration",
      text: u.description ? `${u.title} — ${u.description}` : u.title,
      material: undefined as string | undefined,
    })),
    ...grades.map((g) => ({ at: g.graded_at, step: "Academic grade", text: g.rating_label, material: undefined as string | undefined })),
    ...pitches.map((p) => ({
      at: p.pitched_on,
      step: "Pitched",
      text: `${p.business_name} — ${OUTCOME_LABELS[p.outcome] ?? p.outcome}`,
      material: undefined as string | undefined,
    })),
  ];
  return events
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((e) => ({ step: e.step, date: formatDate(e.at), text: e.text, ...(e.material ? { material: e.material } : {}) }));
}
