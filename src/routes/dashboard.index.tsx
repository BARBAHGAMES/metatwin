import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { averageRating, fetchMyProjectFeedback, newFeedback } from "@/lib/project-feedback";
import { ArrowRight, Bot, Check, FolderGit2, Github, MessageSquareText, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, StatusBadge } from "@/components/site";
import { Reveal } from "@/components/Reveal";
import { LoadError } from "@/components/LoadError";
import { GithubActivityCard } from "@/components/GithubActivityCard";
import { PitchScoresCard } from "@/components/PitchScoresCard";
import { TeamsCard } from "@/components/TeamsCard";
import { fetchMyPitchScores } from "@/lib/pitch-scores";
import { useDashboard } from "@/lib/dashboard-context";
import type { Status } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/")({
  component: Overview,
});

const CATEGORIES = ["Technical", "Creative", "Problem-solving", "Collaboration", "Domain"] as const;

type Competency = { id: string; updated_at: string; evidence_count: number; skills: { name: string; category: string | null } | null };
type Project = { id: string; title: string; description: string | null; created_at: string };
type EvidenceRow = { id: string; competency_id: string; title: string; link: string | null; created_at: string };
type EvidenceReview = { id: string; evidence_id: string; reviewer_name: string; reviewer_role: string | null; comment: string | null };

function competencyStatus(c: Competency, evidence: EvidenceRow[], reviews: EvidenceReview[]): Status {
  const evidenceIds = evidence.filter((e) => e.competency_id === c.id).map((e) => e.id);
  if (reviews.some((r) => evidenceIds.includes(r.evidence_id))) return "reviewed";
  return c.evidence_count > 0 ? "evidence" : "self";
}

function Overview() {
  const { userId, twin } = useDashboard();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [reviews, setReviews] = useState<EvidenceReview[]>([]);
  const [aiEmployeeCount, setAiEmployeeCount] = useState(0);
  const [pitchScoreCount, setPitchScoreCount] = useState(0);
  const [githubStars, setGithubStars] = useState(0);
  const [businessesPitched, setBusinessesPitched] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [feedback, setFeedback] = useState<{ total: number; fresh: number; avg: number | null; projectId: string | null } | null>(null);

  // Visitor feedback summary (separate from the main load: a failure here shouldn't block the overview).
  useEffect(() => {
    fetchMyProjectFeedback()
      .then((items) => {
        const visible = items.filter((f) => !f.hidden_by_owner);
        const fresh = newFeedback(items);
        // Open the project with the newest unread feedback (else the newest feedback).
        const target = fresh[0] ?? visible[0];
        setFeedback({ total: visible.length, fresh: fresh.length, avg: averageRating(visible), projectId: target?.project_id ?? null });
      })
      .catch(() => setFeedback(null));
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    Promise.all([
      supabase.from("competencies").select("id, updated_at, evidence_count, skills(name, category)").eq("twin_id", userId).order("updated_at", { ascending: false }),
      supabase.from("projects").select("id, title, description, created_at").eq("twin_id", userId).order("created_at", { ascending: false }),
      supabase.from("evidence").select("id, competency_id, title, link, created_at").eq("twin_id", userId).order("created_at", { ascending: false }),
      supabase.from("evidence_reviews").select("id, evidence_id, reviewer_name, reviewer_role, comment").eq("twin_id", userId),
      supabase.from("ai_employees").select("id", { count: "exact", head: true }).eq("twin_id", userId),
      fetchMyPitchScores(),
      supabase.from("github_repos").select("stars").eq("twin_id", userId),
      supabase.from("pitch_stats").select("total_pitches").eq("twin_id", userId),
    ])
      .then(([compsRes, projectsRes, evidenceRes, reviewsRes, aiRes, pitchScores, reposRes, pitchStatsRes]) => {
        if (cancelled) return;
        if ([compsRes, projectsRes, evidenceRes, reviewsRes].some((r) => r.error)) {
          setState("error");
          return;
        }
        setCompetencies((compsRes.data as unknown as Competency[] | null) ?? []);
        setProjects((projectsRes.data as Project[] | null) ?? []);
        setEvidence((evidenceRes.data as EvidenceRow[] | null) ?? []);
        setReviews((reviewsRes.data as EvidenceReview[] | null) ?? []);
        setAiEmployeeCount(aiRes.count ?? 0);
        setPitchScoreCount(pitchScores.length);
        setGithubStars(((reposRes.data as { stars: number }[] | null) ?? []).reduce((sum, r) => sum + r.stars, 0));
        setBusinessesPitched(((pitchStatsRes.data as { total_pitches: number }[] | null) ?? []).reduce((sum, r) => sum + r.total_pitches, 0));
        setState("ready");
      })
      .catch((e) => {
        console.error("[dashboard overview] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <p className="text-center text-muted-foreground">Loading…</p>;

  const checklist = [
    { label: "Finish your profile", done: !!(twin.name && twin.headline && twin.institution), to: "/dashboard/profile" },
    { label: "Add your skills", done: competencies.length > 0, to: "/dashboard/skills" },
    { label: "Add a project", done: projects.length > 0, to: "/dashboard/projects" },
    { label: "Add your AI employees", done: aiEmployeeCount > 0, to: "/dashboard/ai-team" },
    { label: "Publish your MetaTwin", done: twin.visibility === "public", to: "/dashboard/profile" },
  ] as const;
  const checklistDone = checklist.filter((c) => c.done).length;

  const recentActivity = [
    ...competencies.filter((c) => c.evidence_count === 0).map((c) => ({ at: c.updated_at, text: `${c.skills?.name ?? "A capability"} — self-reported` })),
    ...projects.map((p) => ({ at: p.created_at, text: `Started project: ${p.title}` })),
    ...evidence.map((e) => {
      const skillName = competencies.find((c) => c.id === e.competency_id)?.skills?.name;
      return { at: e.created_at, text: `${e.title}${skillName ? ` — evidence for ${skillName}` : ""}` };
    }),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><p className="font-display text-3xl font-semibold">{projects.length}</p><p className="text-xs text-muted-foreground">Projects</p></Card>
        <Card><p className="font-display text-3xl font-semibold">{competencies.length}</p><p className="text-xs text-muted-foreground">Skills</p></Card>
        <Card><p className="font-display text-3xl font-semibold">{businessesPitched}</p><p className="text-xs text-muted-foreground">Businesses pitched</p></Card>
        <Card><p className="font-display text-3xl font-semibold">{githubStars}</p><p className="text-xs text-muted-foreground">GitHub stars</p></Card>
      </div>

      {feedback && feedback.total > 0 && (
        <Link to={feedback.projectId ? "/projects/$id" : "/dashboard/projects"} params={feedback.projectId ? { id: feedback.projectId } : undefined} className="block">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-5 w-5 text-electric" />
              <div>
                <p className="font-semibold">Visitor feedback</p>
                <p className="text-xs text-muted-foreground">
                  {feedback.total} {feedback.total === 1 ? "person has" : "people have"} rated your projects{feedback.avg != null ? `, ${feedback.avg.toFixed(1)}/5 on average` : ""}. Tap to read{feedback.fresh > 0 ? " the latest" : ""}.
                </p>
              </div>
            </div>
            {feedback.fresh > 0 && <span className="rounded-full bg-electric px-2.5 py-1 text-xs font-semibold text-primary-foreground">{feedback.fresh} new</span>}
          </Card>
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Build your MetaTwin</h3>
            <span className="text-xs text-muted-foreground">{checklistDone}/{checklist.length}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-electric" style={{ width: `${(checklistDone / checklist.length) * 100}%` }} /></div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link to={c.to} className="flex items-center gap-2 py-1 hover:text-electric sm:py-0">
                  <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", c.done ? "border-electric bg-electric text-primary-foreground" : "border-muted-foreground/40")}>
                    {c.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">How complete your record is, not a measure of ability.</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold"><FolderGit2 className="h-4 w-4" /> Projects</h3>
            <Link to="/dashboard/projects" className="text-xs text-electric hover:underline -my-2 py-2 sm:my-0 sm:py-0">Add project</Link>
          </div>
          {projects.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {projects.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link to="/projects/$id" params={{ id: p.id }} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm hover:border-electric/50">
                    <span className="truncate">{p.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4" /> Your AI employees</h3>
            <Link to="/dashboard/ai-team" className="text-xs text-electric hover:underline -my-2 py-2 sm:my-0 sm:py-0">Manage</Link>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {aiEmployeeCount === 0 ? "No AI employees yet. Add the agents and tools that work for you." : `${aiEmployeeCount} AI employee${aiEmployeeCount === 1 ? "" : "s"} listed.`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">AI work is shown separately and never counts as your own evidence.</p>
        </Card>
        <Card>
          <h3 className="flex items-center gap-2 font-semibold"><Github className="h-4 w-4" /> GitHub</h3>
          <GithubActivityCard />
        </Card>
      </div>

      <Card>
        <TeamsCard />
      </Card>

      {pitchScoreCount > 0 && (
        <Card>
          <PitchScoresCard />
        </Card>
      )}

      <div>
        <h2 className="text-xl font-semibold">Capability map</h2>
        {competencies.length === 0 ? (
          <Card className="mt-4 border-dashed"><p className="text-sm text-muted-foreground">No capabilities yet. Add some from the <Link to="/dashboard/skills" className="text-electric">Skills</Link> tab.</p></Card>
        ) : (
          <Reveal stagger={0.05} className="mt-4 space-y-6">
            {CATEGORIES.filter((g) => competencies.some((c) => c.skills?.category === g)).map((g) => (
              <div key={g}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {competencies.filter((c) => c.skills?.category === g).map((c) => (
                    <div key={c.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{c.skills?.name ?? "Unknown skill"}</p>
                        <StatusBadge status={competencyStatus(c, evidence, reviews)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Reveal>
        )}
      </div>

      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold">Growth timeline</h2>
          <Reveal as="ol" stagger={0.05} className="mt-4 space-y-0 border-l-2 border-electric/20 pl-6">
            {recentActivity.map((a, i) => (
              <li key={i} className="relative pb-5">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background bg-electric" />
                <p className="font-mono text-xs text-muted-foreground">{new Date(a.at).toLocaleDateString()}</p>
                <p className="mt-0.5 text-sm">{a.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      )}

      {pitchScoreCount === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> No pitch competition scores synced yet.</p>
      )}
    </div>
  );
}
