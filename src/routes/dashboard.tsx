import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import heroImg from "@/assets/hero-dashboard.jpg";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderPlus, FilePlus2, Layers, ArrowRight, Info, Camera, UserRound, FileText, PlayCircle, Rocket, GraduationCap, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, HeroBackdrop, Section, StatusBadge } from "@/components/site";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdultGate } from "@/components/AdultGate";
import { DeactivatedGate } from "@/components/DeactivatedGate";
import { PaywallGate } from "@/components/PaywallGate";
import { hasActivePlan, fetchHasTeamPlanAccess } from "@/lib/plan";
import { LINK_ERROR, isHttpUrl, safeHref } from "@/lib/url";
import { LIMITS, validateStudyYear } from "@/lib/limits";
import { GENDER_OPTIONS, MBTI_TYPES } from "@/lib/profile-traits";
import { LoadError } from "@/components/LoadError";
import { fetchMyOpportunityMatches, type OpportunityMatch } from "@/lib/real-data";
import { HANDLE_HELP, normalizeHandle, publicProfilePath, validateHandle } from "@/lib/public-profile";
import { uploadAvatar } from "@/lib/avatar";
import { OpportunitiesScout } from "@/components/OpportunitiesScout";
import { GithubActivityCard } from "@/components/GithubActivityCard";
import { TeamsCard } from "@/components/TeamsCard";
import { PitchScoresCard } from "@/components/PitchScoresCard";
import { AiEmployeesCard } from "@/components/AiEmployeesCard";
import { fetchMyProjectGrades, type MyProjectGrade } from "@/lib/school-admin";
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
  first_name: string | null;
  institution: string | null;
  programme: string | null;
  year: number | null;
  headline: string | null;
  visibility: "private" | "public";
  is_adult: boolean;
  is_active: boolean;
  plan_status: string;
  plan_paid_until: string | null;
  handle: string | null;
  public_show_evidence_details: boolean;
  photo_url: string | null;
  gender: string | null;
  gender_self_described: string | null;
  mbti_type: string | null;
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
  problem_statement: string | null;
  proposed_solution: string | null;
  created_at: string;
  pitch_deck_url: string | null;
  pitch_video_url: string | null;
  github_repo: string | null;
};

type PitchStatsRow = { project_id: string; total_pitches: number; conversion_pct: number | null };

type Evidence = {
  id: string;
  competency_id: string;
  title: string;
  link: string | null;
  note: string | null;
  created_at: string;
};

type EvidenceReview = {
  id: string;
  evidence_id: string;
  reviewer_name: string;
  reviewer_role: string | null;
  comment: string | null;
  submitted_at: string;
};

function competencyStatus(c: Competency, evidence: Evidence[], reviews: EvidenceReview[]): Status {
  const evidenceIds = evidence.filter((e) => e.competency_id === c.id).map((e) => e.id);
  if (reviews.some((r) => evidenceIds.includes(r.evidence_id))) return "reviewed";
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
  const [reviews, setReviews] = useState<EvidenceReview[]>([]);
  const [pitchStats, setPitchStats] = useState<PitchStatsRow[]>([]);
  const [projectGrades, setProjectGrades] = useState<MyProjectGrade[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [teamPlanAccess, setTeamPlanAccess] = useState(false);

  const [projectDialog, setProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", description: "", problemStatement: "", proposedSolution: "" });
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [capabilityDialog, setCapabilityDialog] = useState(false);
  const [capabilitySkillId, setCapabilitySkillId] = useState("");
  const [capabilityLevel, setCapabilityLevel] = useState(1);
  const [editingCompetencyId, setEditingCompetencyId] = useState<string | null>(null);
  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [evidenceCompetencyId, setEvidenceCompetencyId] = useState("");
  const [evidenceProjectId, setEvidenceProjectId] = useState("");
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [matchesState, setMatchesState] = useState<"loading" | "error" | "ready">("loading");
  const [matchesReload, setMatchesReload] = useState(0);
  const [evidenceForm, setEvidenceForm] = useState({ title: "", link: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [reviewDialogEvidenceId, setReviewDialogEvidenceId] = useState<string | null>(null);
  const [reviewerForm, setReviewerForm] = useState({ name: "", role: "" });
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [invitingReviewer, setInvitingReviewer] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: "project" | "capability" | "evidence"; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  async function loadAll(userId: string) {
    fetchHasTeamPlanAccess().then(setTeamPlanAccess);
    const [twinRes, skillsRes, compsRes, projectsRes, evidenceRes, reviewsRes, pitchStatsRes] = await Promise.all([
      supabase.from("twins").select("id, name, first_name, institution, programme, year, headline, visibility, is_adult, is_active, plan_status, plan_paid_until, handle, public_show_evidence_details, photo_url, gender, gender_self_described, mbti_type").eq("id", userId).maybeSingle(),
      supabase.from("skills").select("id, name, category").order("name"),
      supabase
        .from("competencies")
        .select("id, skill_id, level, evidence_count, updated_at, skills(name)")
        .eq("twin_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, title, description, problem_statement, proposed_solution, created_at, pitch_deck_url, pitch_video_url, github_repo")
        .eq("twin_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("evidence")
        .select("id, competency_id, title, link, note, created_at")
        .eq("twin_id", userId)
        .order("created_at", { ascending: false }),
      // RLS only ever returns rows with submitted_at set for the owner — see
      // "evidence_reviews: owner select submitted" policy.
      supabase
        .from("evidence_reviews")
        .select("id, evidence_id, reviewer_name, reviewer_role, comment, submitted_at")
        .eq("twin_id", userId),
      supabase.from("pitch_stats").select("project_id, total_pitches, conversion_pct").eq("twin_id", userId),
    ]);
    if (twinRes.error) console.error("[dashboard] load twin failed:", twinRes.error.message);
    if (skillsRes.error) console.error("[dashboard] load skills failed:", skillsRes.error.message);
    if (compsRes.error) console.error("[dashboard] load competencies failed:", compsRes.error.message);
    if (projectsRes.error) console.error("[dashboard] load projects failed:", projectsRes.error.message);
    if (evidenceRes.error) console.error("[dashboard] load evidence failed:", evidenceRes.error.message);
    if (reviewsRes.error) console.error("[dashboard] load evidence reviews failed:", reviewsRes.error.message);
    if (pitchStatsRes.error) console.error("[dashboard] load pitch stats failed:", pitchStatsRes.error.message);

    // A failed load must not render as an empty account (it reads as lost data).
    if ([twinRes, skillsRes, compsRes, projectsRes, evidenceRes, reviewsRes].some((r) => r.error)) {
      setLoadError(true);
      setFetching(false);
      return;
    }
    setLoadError(false);
    setPitchStats((pitchStatsRes.data as PitchStatsRow[] | null) ?? []);
    fetchMyProjectGrades()
      .then(setProjectGrades)
      .catch((err) => console.error("[dashboard] load project grades failed:", err));

    setTwin(
      (twinRes.data as Twin | null) ?? {
        id: userId,
        name: null,
        first_name: null,
        institution: null,
        programme: null,
        year: null,
        headline: null,
        visibility: "private",
        is_adult: false,
        is_active: true,
        plan_status: "unpaid",
        plan_paid_until: null,
        handle: null,
        public_show_evidence_details: false,
        photo_url: null,
        gender: null,
        gender_self_described: null,
        mbti_type: null,
      },
    );
    setSkills((skillsRes.data as Skill[] | null) ?? []);
    setCompetencies((compsRes.data as unknown as Competency[] | null) ?? []);
    setProjects((projectsRes.data as Project[] | null) ?? []);
    setEvidence((evidenceRes.data as Evidence[] | null) ?? []);
    setReviews((reviewsRes.data as EvidenceReview[] | null) ?? []);
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

  function openAddProjectDialog() {
    setEditingProjectId(null);
    setProjectForm({ title: "", description: "", problemStatement: "", proposedSolution: "" });
    setProjectDialog(true);
  }

  function openEditProjectDialog(p: Project) {
    setEditingProjectId(p.id);
    setProjectForm({
      title: p.title,
      description: p.description ?? "",
      problemStatement: p.problem_statement ?? "",
      proposedSolution: p.proposed_solution ?? "",
    });
    setProjectDialog(true);
  }

  async function saveProject() {
    if (!user || !projectForm.title.trim()) return;
    setSaving(true);
    const payload = {
      title: projectForm.title.trim(),
      description: projectForm.description.trim() || null,
      problem_statement: projectForm.problemStatement.trim() || null,
      proposed_solution: projectForm.proposedSolution.trim() || null,
    };
    if (editingProjectId) {
      const { error } = await supabase.from("projects").update(payload).eq("id", editingProjectId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Project updated.");
      setProjectDialog(false);
      loadAll(user.id);
      return;
    }
    const { data, error } = await supabase.from("projects").insert({ twin_id: user.id, ...payload }).select("id").single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project added — let's attach a pitch deck or video.");
    setProjectForm({ title: "", description: "", problemStatement: "", proposedSolution: "" });
    setProjectDialog(false);
    if (data) navigate({ to: "/projects/$id", params: { id: data.id } });
  }

  function openAddCapabilityDialog() {
    setEditingCompetencyId(null);
    setCapabilitySkillId("");
    setCapabilityLevel(1);
    setCapabilityDialog(true);
  }

  function openEditCapabilityDialog(c: Competency) {
    setEditingCompetencyId(c.id);
    setCapabilitySkillId(c.skill_id);
    setCapabilityLevel(c.level);
    setCapabilityDialog(true);
  }

  async function saveCapability() {
    if (!user || !capabilitySkillId) return;
    setSaving(true);
    if (editingCompetencyId) {
      const { error } = await supabase.from("competencies").update({ level: capabilityLevel }).eq("id", editingCompetencyId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Capability updated.");
      setCapabilityDialog(false);
      loadAll(user.id);
      return;
    }
    const { error } = await supabase.from("competencies").insert({
      twin_id: user.id,
      skill_id: capabilitySkillId,
      level: capabilityLevel,
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

  function openAddEvidenceDialog() {
    setEditingEvidenceId(null);
    setEvidenceCompetencyId("");
    setEvidenceProjectId("");
    setEvidenceForm({ title: "", link: "", note: "" });
    setEvidenceDialog(true);
  }

  function openEditEvidenceDialog(e: Evidence) {
    setEditingEvidenceId(e.id);
    setEvidenceCompetencyId(e.competency_id);
    setEvidenceProjectId("");
    setEvidenceForm({ title: e.title, link: e.link ?? "", note: e.note ?? "" });
    setEvidenceDialog(true);
  }

  async function saveEvidence() {
    if (!user || !evidenceCompetencyId || !evidenceForm.title.trim()) return;
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
      loadAll(user.id);
      return;
    }
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

  async function confirmDelete() {
    if (!user || !deleteConfirm) return;
    setDeleting(true);
    const table = deleteConfirm.kind === "project" ? "projects" : deleteConfirm.kind === "capability" ? "competencies" : "evidence";
    const { error } = await supabase.from(table).delete().eq("id", deleteConfirm.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${deleteConfirm.kind === "project" ? "Project" : deleteConfirm.kind === "capability" ? "Capability" : "Evidence"} deleted.`);
    setDeleteConfirm(null);
    loadAll(user.id);
  }

  function openReviewDialog(evidenceId: string) {
    setReviewDialogEvidenceId(evidenceId);
    setReviewerForm({ name: "", role: "" });
    setReviewLink(null);
  }

  async function inviteReviewer() {
    if (!user || !reviewDialogEvidenceId || !reviewerForm.name.trim()) return;
    setInvitingReviewer(true);
    // Generate the token client-side rather than reading it back via .select() —
    // RLS only lets the owner SELECT a submitted review, so an insert().select()
    // round-trip on a fresh (unsubmitted) invite would fail the RLS check.
    const token = crypto.randomUUID();
    const { error } = await supabase.from("evidence_reviews").insert({
      twin_id: user.id,
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

  if (!twin.is_active) {
    return <DeactivatedGate />;
  }

  if (!twin.is_adult) {
    return <AdultGate onDeclared={() => user && loadAll(user.id)} />;
  }

  if (!hasActivePlan(twin) && !teamPlanAccess) {
    return <PaywallGate onPaid={() => user && loadAll(user.id)} />;
  }

  if (!twin.first_name) {
    navigate({ to: "/build" });
    return <main className="p-16 text-center text-muted-foreground">Taking you to set up your MetaTwin…</main>;
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
        <HeroBackdrop image={heroImg} />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-5 py-14 md:flex-row md:items-end md:justify-between md:py-16">
          <div className="hero-rise">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Owner view · Managing a MetaTwin</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">
              Welcome back{twin.name ? `, ${twin.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-2 text-ink-muted">Skills, evidence and your MetaTwin in one place.</p>
          </div>
          <Button asChild variant="heroOutline" className="hero-rise-delay-1"><Link to="/profile">View my MetaTwin <ArrowRight /></Link></Button>
        </div>
      </section>
      <Section className="py-10 md:py-12">
        {!twin.name && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-dashed bg-card p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" /> Add your name and headline from the profile fields below to get started.
          </div>
        )}

        <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Build your MetaTwin</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <button onClick={openAddProjectDialog} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition-all duration-200 hover:border-electric/50 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
            <FolderPlus className="h-5 w-5 shrink-0 text-electric" />Add a project
          </button>
          <button onClick={openAddCapabilityDialog} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left text-sm font-medium shadow-card transition-all duration-200 hover:border-electric/50 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
            <Layers className="h-5 w-5 shrink-0 text-electric" />Add a capability
          </button>
          <button
            onClick={() => (competencies.length === 0 ? toast.info("Add a capability first.") : openAddEvidenceDialog())}
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
                {(["reviewed", "evidence", "self"] as Status[])
                  .filter((s) => competencies.some((c) => competencyStatus(c, evidence, reviews) === s))
                  .map((s) => (
                    <StatusBadge key={s} status={s} />
                  ))}
              </div>
            )}
          </Card>
          <Card>
            <p className="text-sm text-muted-foreground">Projects</p>
            <p className="mt-1 font-display text-4xl font-semibold">{projects.length}</p>
            <p className="mt-3 text-xs text-muted-foreground">See the full list, and what each one's still missing, below.</p>
          </Card>
        </div>

        <Card className="mt-5">
          <h3 className="font-semibold">Your projects</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Open a project to attach its pitch deck, pitch video, log businesses you've pitched to, or sync GitHub stats.
          </p>
          {projects.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No projects yet — add one above to get started.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {projects.map((p) => {
                const stats = pitchStats.find((s) => s.project_id === p.id);
                const grade = projectGrades.find((g) => g.project_id === p.id);
                const hasDeck = !!safeHref(p.pitch_deck_url);
                const hasVideo = !!safeHref(p.pitch_video_url);
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl border bg-card transition-all duration-200 hover:border-electric/50">
                    <Link to="/projects/$id" params={{ id: p.id }} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className={`flex items-center gap-1 ${hasDeck ? "text-electric" : "text-muted-foreground"}`}><FileText className="h-3 w-3" /> {hasDeck ? "Deck added" : "No deck yet"}</span>
                          <span className={`flex items-center gap-1 ${hasVideo ? "text-electric" : "text-muted-foreground"}`}><PlayCircle className="h-3 w-3" /> {hasVideo ? "Video added" : "No video yet"}</span>
                          <span className={`flex items-center gap-1 ${stats && stats.total_pitches > 0 ? "text-electric" : "text-muted-foreground"}`}>
                            <Rocket className="h-3 w-3" /> {stats?.total_pitches ?? 0} business{stats?.total_pitches === 1 ? "" : "es"} pitched
                          </span>
                          {grade && <span className="flex items-center gap-1 text-electric"><GraduationCap className="h-3 w-3" /> {grade.rating_label}</span>}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                    <div className="flex shrink-0 items-center gap-1 pr-3">
                      <button
                        type="button"
                        onClick={() => openEditProjectDialog(p)}
                        aria-label="Edit project"
                        className="cursor-pointer rounded p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ kind: "project", id: p.id, label: p.title })}
                        aria-label="Delete project"
                        className="cursor-pointer rounded p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card className="min-w-0">
            <h3 className="font-semibold">Your capabilities</h3>
            <ul className="mt-3 space-y-2">
              {competencies.map((c) => {
                const items = evidence.filter((e) => e.competency_id === c.id);
                return (
                  <li key={c.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{c.skills?.name ?? "Unknown skill"}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={competencyStatus(c, evidence, reviews)} />
                        <button type="button" onClick={() => openEditCapabilityDialog(c)} aria-label="Edit capability" className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm({ kind: "capability", id: c.id, label: c.skills?.name ?? "this capability" })} aria-label="Delete capability" className="cursor-pointer rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
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
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-electric hover:underline">
                                    {e.title}
                                  </a>
                                ) : (
                                  <span className="truncate text-xs text-muted-foreground">{e.title}</span>
                                )}
                                <div className="flex shrink-0 items-center gap-2">
                                  {!review && (
                                    <button
                                      type="button"
                                      onClick={() => openReviewDialog(e.id)}
                                      className="cursor-pointer text-xs text-electric hover:underline"
                                    >
                                      Invite a reviewer
                                    </button>
                                  )}
                                  <button type="button" onClick={() => openEditEvidenceDialog(e)} aria-label="Edit evidence" className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button type="button" onClick={() => setDeleteConfirm({ kind: "evidence", id: e.id, label: e.title })} aria-label="Delete evidence" className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
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
                  </li>
                );
              })}
              {competencies.length === 0 && <li className="text-xs text-muted-foreground">No capabilities added yet.</li>}
            </ul>
          </Card>
          <Card className="min-w-0">
            <h3 className="font-semibold">Recent activity</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {recentActivity.map((a, i) => (
                <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-electric" />{a.text}</li>
              ))}
              {recentActivity.length === 0 && <li className="text-xs text-muted-foreground">Nothing yet — add a project or capability above.</li>}
            </ul>
          </Card>
        </div>

        <p className="mt-10 font-mono text-xs uppercase tracking-[0.2em] text-electric">Proof &amp; opportunities</p>
        <Card className="mt-3">
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
          <OpportunitiesScout />
        </Card>

        <Card className="mt-5">
          <GithubActivityCard />
        </Card>

        <p className="mt-10 font-mono text-xs uppercase tracking-[0.2em] text-electric">Team &amp; AI</p>
        <Card className="mt-3">
          <TeamsCard />
        </Card>

        <Card className="mt-5">
          {user && <AiEmployeesCard userId={user.id} />}
        </Card>

        <PitchScoresCard />

        <p className="mt-10 font-mono text-xs uppercase tracking-[0.2em] text-electric">Profile &amp; public page</p>
        <Card className="mt-3">
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
          <DialogHeader><DialogTitle>{editingProjectId ? "Edit project" : "Add a project"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-title">Title</Label>
              <Input id="project-title" maxLength={LIMITS.projectTitle} value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="e.g. AquaLoop Greywater Filter" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Textarea id="project-description" rows={3} maxLength={LIMITS.projectDescription} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="What is it, and what's your role?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-problem">Problem statement</Label>
              <Textarea id="project-problem" rows={3} maxLength={LIMITS.projectProblemStatement} value={projectForm.problemStatement} onChange={(e) => setProjectForm({ ...projectForm, problemStatement: e.target.value })} placeholder="What problem were you solving?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-solution">Proposed solution</Label>
              <Textarea id="project-solution" rows={3} maxLength={LIMITS.projectProposedSolution} value={projectForm.proposedSolution} onChange={(e) => setProjectForm({ ...projectForm, proposedSolution: e.target.value })} placeholder="How does your project solve it?" />
            </div>
          </div>
          <DialogFooter><Button onClick={saveProject} disabled={saving || !projectForm.title.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={capabilityDialog} onOpenChange={setCapabilityDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCompetencyId ? "Edit capability" : "Add a capability"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="capability-select">Capability</Label>
            {editingCompetencyId ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {competencies.find((c) => c.id === editingCompetencyId)?.skills?.name ?? "Unknown skill"}
              </p>
            ) : (
              <>
                <select
                  id="capability-select"
                  value={capabilitySkillId}
                  onChange={(e) => setCapabilitySkillId(e.target.value)}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Choose…</option>
                  {availableSkillsForCapability.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {availableSkillsForCapability.length === 0 && (
                  <p className="text-xs text-muted-foreground">You've added every capability in the current list.</p>
                )}
              </>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="capability-level">Level (1-5, self-rated)</Label>
            <select
              id="capability-level"
              value={capabilityLevel}
              onChange={(e) => setCapabilityLevel(Number(e.target.value))}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Capabilities start as Self-Reported — add evidence next to back it up.</p>
          <DialogFooter><Button onClick={saveCapability} disabled={saving || !capabilitySkillId}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceDialog} onOpenChange={setEvidenceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEvidenceId ? "Edit evidence" : "Add evidence"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="evidence-select">Supports capability</Label>
              <select
                id="evidence-select"
                value={evidenceCompetencyId}
                onChange={(e) => setEvidenceCompetencyId(e.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
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
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
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
                placeholder="Paste a link to a Google Doc, Drive file, GitHub repo…"
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
          <DialogFooter><Button onClick={saveEvidence} disabled={saving || !evidenceCompetencyId || !evidenceForm.title.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {deleteConfirm?.kind}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteConfirm?.kind === "project" && (
              <>Deleting <strong>{deleteConfirm.label}</strong> also deletes its logged business pitches, GitHub sync, and academic grade (if any). Evidence linked to it stays on your MetaTwin, just unlinked from this project.</>
            )}
            {deleteConfirm?.kind === "capability" && (() => {
              const count = evidence.filter((e) => e.competency_id === deleteConfirm.id).length;
              return (
                <>Deleting <strong>{deleteConfirm.label}</strong> also permanently deletes the {count} evidence item{count === 1 ? "" : "s"} attached to it — that's real proof content, not just a link.</>
              );
            })()}
            {deleteConfirm?.kind === "evidence" && <>This evidence item will be permanently removed.</>}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
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
    </div>
  );
}

function MbtiCard({ twinId, mbtiType, onSaved }: { twinId: string; mbtiType: string | null; onSaved: () => void }) {
  const [code, setCode] = useState(mbtiType ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!code) {
      toast.error("Pick your MBTI type first.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("assessments").insert({ twin_id: twinId, trait_type: "mbti", trait_value: code });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("MBTI saved.");
    onSaved();
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>MBTI type</Label>
      <p className="text-xs text-muted-foreground">
        Take a test elsewhere (e.g. 16personalities.com) at your own pace, then pick your result here. Private — never shown on
        your public profile — but needed before you can go public.
      </p>
      <div className="flex gap-2">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Not taken yet</option>
          {MBTI_TYPES.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
        </select>
        <Button variant="outline" onClick={save} disabled={saving || code === mbtiType}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

function ProfileEditor({ twin, onSaved }: { twin: Twin; onSaved: () => void }) {
  const [form, setForm] = useState(twin);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const publicBase = typeof window === "undefined" ? "" : window.location.origin;

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const photo_url = await uploadAvatar(twin.id, file);
      const { error } = await supabase.from("twins").update({ photo_url }).eq("id", twin.id);
      if (error) throw new Error(error.message);
      setForm((f) => ({ ...f, photo_url }));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

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
    if (isPublic && !form.mbti_type) {
      toast.error("Add your MBTI type before making your profile public.");
      return;
    }
    setSaving(true);
    // is_adult is server-controlled (declare_adult RPC) — never sent from here.
    // mbti_type is never sent from here either — it's denormalized by a trigger
    // from the student's own assessments submission (see the MBTI card below).
    const payload = {
      name: form.name,
      institution: form.institution,
      programme: form.programme,
      year: form.year,
      headline: form.headline,
      visibility: form.visibility,
      handle: handle || null,
      public_show_evidence_details: form.public_show_evidence_details,
      gender: form.gender,
      gender_self_described: form.gender === "self_described" ? form.gender_self_described : null,
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
      <div className="flex items-center gap-4 sm:col-span-2">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
          {form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition hover:border-electric/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
          <Camera className="h-4 w-4" />
          {uploadingPhoto ? "Uploading…" : form.photo_url ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/*" className="sr-only" disabled={uploadingPhoto} onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
        </label>
      </div>
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
      <div className="space-y-1.5">
        <Label>Gender</Label>
        <select
          value={form.gender ?? ""}
          onChange={(e) => setForm({ ...form, gender: e.target.value || null })}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Prefer not to answer</option>
          {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        {form.gender === "self_described" && (
          <Input
            maxLength={LIMITS.genderSelfDescribed}
            placeholder="How would you describe it?"
            value={form.gender_self_described ?? ""}
            onChange={(e) => setForm({ ...form, gender_self_described: e.target.value })}
          />
        )}
        <p className="text-xs text-muted-foreground">Private — never shown on your public profile.</p>
      </div>
      <MbtiCard twinId={twin.id} mbtiType={twin.mbti_type} onSaved={onSaved} />
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
          shows your email, birth year, year of study, gender or MBTI type.
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
