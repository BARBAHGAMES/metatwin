import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import heroImg from "@/assets/hero-project.jpg";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileCheck2, MessageSquare } from "lucide-react";
import { capBySlug, projectById, type Project } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import {
  buildProjectTimeline,
  fetchMyProject,
  formatDate,
  isUuid,
  type GithubRepoRow,
  type IncomingCollaborationRequest,
  type MyProject,
  type PitchRow,
  type PitchStatsRow,
  type ProjectUpdateRow,
} from "@/lib/real-data";
import { STAGE_LABELS, type ProjectStage } from "@/lib/project-stage";
import { safeHref } from "@/lib/url";
import { LoadError } from "@/components/LoadError";
import { Card, PageHero, SampleTag, Section, StatusBadge } from "@/components/site";
import { VisitorFeedbackCard } from "@/components/VisitorFeedbackCard";
import { Journey } from "@/components/Journey";
import { Reveal } from "@/components/Reveal";
import {
  CollaborationCard,
  GitHubCard,
  InterviewTrackerCard,
  MarkCompleteButton,
  MediaTiles,
  PitchFeedbackCard,
  PitchTracker,
  ProblemSolutionCards,
  ProjectLinksForm,
  ProjectUpdatesCard,
  PrototypeChecklistCard,
} from "@/components/ProjectExtras";
import { AcademicGradeCard } from "@/components/AcademicGradeCard";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/projects/$id")({
  // A sample id shows the fictional showcase project. A uuid is a real project,
  // loaded client-side for its signed-in owner (RLS: owner-only).
  loader: ({ params }) => {
    const project = projectById(params.id) ?? null;
    if (!project && !isUuid(params.id)) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.project?.title ?? "Project";
    const description = loaderData?.project?.description ?? "A project and the evidence behind it.";
    return {
      meta: [
        { title: `${title} · MetaTwin` },
        { name: "description", content: description },
        { property: "og:title", content: `${title} · MetaTwin` },
        { property: "og:description", content: description },
      ],
    };
  },
  notFoundComponent: () => <Section><p>Project not found. <Link to="/projects" className="text-electric">All projects</Link></p></Section>,
  component: ProjectPage,
});

function ProjectPage() {
  const { project } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  if (project) return <SampleProject p={project} />;
  if (loading) return <div className="p-16 text-center text-muted-foreground" role="status">Loading...</div>;
  if (!user) {
    return (
      <Section>
        <p>Log in to view your project. <Link to="/login" className="text-electric">Log in</Link></p>
      </Section>
    );
  }
  return <RealProject userId={user.id} projectId={id} />;
}

function RealProject({ userId, projectId }: { userId: string; projectId: string }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchMyProject>>>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchMyProject(userId, projectId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState("ready");
      })
      .catch((e) => {
        console.error("[project] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, projectId, reloadKey]);

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <div className="p-16 text-center text-muted-foreground" role="status">Loading...</div>;
  if (!data) {
    return (
      <Section>
        <p>We couldn't find this project in your MetaTwin. <Link to="/projects" className="text-electric">Back to my projects</Link></p>
      </Section>
    );
  }

  const { project: p, evidence, githubRepo, pitches, pitchStats, grade, grades, updates, incomingRequests } = data;
  const artifact = safeHref(p.artifact_url);
  const stage = p.stage as ProjectStage;
  return (
    <>
      <PageHero image={heroImg} eyebrow={`${STAGE_LABELS[stage]} · Started ${formatDate(p.created_at)}`} title={p.title}>
        {p.description && <p>{p.description}</p>}
      </PageHero>
      <Section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> My projects</Link>
          <MediaTiles writeupUrl={p.writeup_url} pitchDeckUrl={p.pitch_deck_url} pitchVideoUrl={p.pitch_video_url} addHref="#pitch-links" />
          <ProblemSolutionCards problemStatement={p.problem_statement} proposedSolution={p.proposed_solution} />
          <VisitorFeedbackCard projectId={projectId} twinId={userId} current={{ problem_statement: p.problem_statement, proposed_solution: p.proposed_solution }} />
          {artifact && (
            <Card>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Project link</p>
              <a href={artifact} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm text-electric hover:underline">{artifact}</a>
            </Card>
          )}
          <Card>
            <h3 className="font-semibold">Evidence for this project</h3>
            {evidence.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No evidence linked yet. When you add evidence from your dashboard, choose this project under "Related project".</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {evidence.map((e) => {
                  const href = safeHref(e.link);
                  return (
                    <li key={e.id} className="flex items-start gap-2">
                      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-electric hover:underline">{e.title}</a> : <span>{e.title}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <AcademicGradeCard grade={grade} />
          <ProjectExtrasPanel
            userId={userId}
            projectId={projectId}
            project={p}
            githubRepo={githubRepo}
            pitches={pitches}
            pitchStats={pitchStats}
            updates={updates}
            incomingRequests={incomingRequests}
            onReload={() => setReloadKey((k) => k + 1)}
          />
        </div>
        <aside className="min-w-0 space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Journey</h2>
            <p className="mt-1 text-xs text-muted-foreground">Built from the dates you actually added things.</p>
            <div className="mt-5"><Journey steps={buildProjectTimeline(p, evidence, updates, grades, pitches)} /></div>
          </div>
        </aside>
      </Section>
    </>
  );
}

function ProjectExtrasPanel({
  userId,
  projectId,
  project,
  githubRepo,
  pitches,
  pitchStats,
  updates,
  incomingRequests,
  onReload,
}: {
  userId: string;
  projectId: string;
  project: MyProject;
  githubRepo: GithubRepoRow | null;
  pitches: PitchRow[];
  pitchStats: PitchStatsRow | null;
  updates: ProjectUpdateRow[];
  incomingRequests: IncomingCollaborationRequest[];
  onReload: () => void;
}) {
  const [githubField, setGithubField] = useState(project.github_repo ?? "");
  const stage = project.stage as ProjectStage;

  async function saveGithubRepo() {
    const value = githubField.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");
    const { error } = await supabase.from("projects").update({ github_repo: value || null }).eq("id", projectId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setGithubField(value);
    toast.success("Saved.");
    onReload();
  }

  return (
    <>
      <InterviewTrackerCard project={project} onSynced={onReload} />
      <CollaborationCard
        projectId={projectId}
        stage={stage}
        hasTeam={!!project.team_id}
        openToCollaborators={project.open_to_collaborators}
        incomingRequests={incomingRequests}
        onChange={onReload}
      />
      <GitHubCard repo={githubRepo} githubRepoField={githubField} onFieldChange={setGithubField} onSave={saveGithubRepo} onSynced={onReload} projectId={projectId} />
      <ProjectLinksForm project={project} onSaved={onReload} />
      <PitchFeedbackCard project={project} onSynced={onReload} />
      <PitchTracker pitches={pitches} stats={pitchStats} twinId={userId} projectId={projectId} onChange={onReload} />
      <ProjectUpdatesCard updates={updates} twinId={userId} projectId={projectId} onChange={onReload} />
      {(stage === "prototype" || stage === "completed") && (
        <PrototypeChecklistCard artifactUrl={project.artifact_url} hasPitchFeedback={"responses" in project.pitch_scores && project.pitch_scores.responses > 0} pitchCount={pitches.length} />
      )}
      <MarkCompleteButton projectId={projectId} stage={stage} completionReason={project.completion_reason} onChange={onReload} />
    </>
  );
}

function SampleProject({ p }: { p: Project }) {
  return (
    <>
      <PageHero image={heroImg} eyebrow={`${p.discipline} · ${p.stage}`} title={p.title}>
        <p>{p.description}</p>
        <div className="mt-4"><SampleTag /></div>
      </PageHero>
      <Section className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All projects</Link>
          <div className="grid gap-5 md:grid-cols-2">
            <Card><p className="text-xs font-semibold uppercase text-muted-foreground">Problem</p><p className="mt-2">{p.problem}</p></Card>
            <Card><p className="text-xs font-semibold uppercase text-muted-foreground">Proposed solution</p><p className="mt-2">{p.solution}</p></Card>
          </div>
          <Card className="border-electric/30">
            <p className="text-xs font-semibold uppercase text-electric">Victorious's individual role</p>
            <p className="mt-2">{p.team.myRole}</p>
            {p.team.collective && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Collective team output ({p.team.size} people)</p>
                <p className="mt-2 text-muted-foreground">{p.team.collective}</p>
              </div>
            )}
          </Card>
          <div>
            <h2 className="text-2xl font-semibold">Work samples</h2>
            <Reveal stagger={0.06} className="mt-4 grid gap-3 sm:grid-cols-2">
              {p.samples.map((s) => (
                <div key={s.title} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow duration-200 hover:shadow-card">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-electric-soft text-electric"><FileCheck2 className="h-5 w-5" /></div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.kind}</p></div>
                </div>
              ))}
            </Reveal>
          </div>
          <Accordion type="multiple" defaultValue={["feedback"]} className="rounded-xl border bg-card px-5">
            <AccordionItem value="feedback">
              <AccordionTrigger>Feedback received ({p.feedback.length})</AccordionTrigger>
              <AccordionContent className="space-y-4">
                {p.feedback.length === 0 && <p className="text-muted-foreground">No feedback yet.</p>}
                {p.feedback.map((f) => (
                  <div key={f.text} className="flex gap-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                    <div><p>"{f.text}"</p><p className="mt-1 text-xs text-muted-foreground">{f.from} · {f.role} · {f.date}</p></div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="iterations">
              <AccordionTrigger>Iterations and improvements ({p.iterations.length})</AccordionTrigger>
              <AccordionContent>
                <ol className="space-y-2">{p.iterations.map((it) => <li key={it.version}><span className="font-mono text-xs text-electric">{it.version}</span> — {it.change}</li>)}</ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="outcome" className="border-b-0">
              <AccordionTrigger>Outcomes and next steps</AccordionTrigger>
              <AccordionContent className="space-y-2"><p><strong>Outcome:</strong> {p.outcome}</p><p><strong>Next:</strong> {p.next}</p></AccordionContent>
            </AccordionItem>
          </Accordion>
          <div>
            <h2 className="text-2xl font-semibold">The Journey of This Work</h2>
            <div className="mt-6"><Journey steps={p.journey} /></div>
          </div>
        </div>
        <aside className="min-w-0">
          <Card>
            <h3 className="font-semibold">Competencies demonstrated</h3>
            <ul className="mt-4 space-y-3">
              {p.capabilities.map((c) => {
                const cap = capBySlug(c)!;
                return (
                  <li key={c}>
                    <Link to="/capability/$slug" params={{ slug: c }} className="flex items-center justify-between gap-2 text-sm hover:text-electric">
                      <span className="truncate">{cap.name}</span><StatusBadge status={cap.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </Section>
    </>
  );
}
