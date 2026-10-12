import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-metatwin.jpg";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Target, Lock, Bot, Briefcase, UserPlus, Sparkles, Search, Handshake } from "lucide-react";
import { toast } from "sonner";
import { aiEmployees, capabilities, growth, person, projects } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { safeHref } from "@/lib/url";
import { LoadError } from "@/components/LoadError";
import { supabase } from "@/integrations/supabase/client";
import { AITeam } from "@/components/AITeam";
import { CareerGraph } from "@/components/CareerGraph";
import { Button } from "@/components/ui/button";
import sampleProfilePhoto from "@/assets/sample-profile.jpg";
import { Card, HeroBackdrop, SampleAvatar, SampleTag, Section, StatusBadge } from "@/components/site";
import { Reveal } from "@/components/Reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Status } from "@/lib/data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My MetaTwin · Your Digital Twin for Opportunities" },
      { name: "description", content: "Your MetaTwin: capabilities, projects, evidence and growth over time. Sign in to see yours, or explore a fictional sample." },
      { property: "og:title", content: "MetaTwin · Your verified digital twin" },
      { property: "og:description", content: "A living record of capabilities, projects and evidence." },
    ],
  }),
  component: Profile,
});

const groups = ["Technical", "Creative", "Problem-solving", "Collaboration", "Domain"] as const;

function Profile() {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <main className="p-16 text-center text-muted-foreground">Loading...</main>;
  return user ? <RealProfile userId={user.id} /> : <SampleProfile />;
}

type Twin = {
  id: string;
  name: string | null;
  institution: string | null;
  programme: string | null;
  year: number | null;
  headline: string | null;
  visibility: "private" | "public";
  handle: string | null;
};
type Competency = {
  id: string;
  level: number;
  evidence_count: number;
  updated_at: string;
  skills: { name: string; category: string | null } | null;
};
type Project = { id: string; title: string; description: string | null; created_at: string };
type Evidence = { id: string; competency_id: string; title: string; link: string | null; note: string | null; created_at: string };
type EvidenceReview = { id: string; evidence_id: string; reviewer_name: string; reviewer_role: string | null; comment: string | null };

function competencyStatus(c: Competency, evidence: Evidence[], reviews: EvidenceReview[]): Status {
  const evidenceIds = evidence.filter((e) => e.competency_id === c.id).map((e) => e.id);
  if (reviews.some((r) => evidenceIds.includes(r.evidence_id))) return "reviewed";
  return c.evidence_count > 0 ? "evidence" : "self";
}

function RealProfile({ userId }: { userId: string }) {
  const [twin, setTwin] = useState<Twin | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [reviews, setReviews] = useState<EvidenceReview[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [twinRes, compsRes, projectsRes, evidenceRes, reviewsRes] = await Promise.all([
        supabase.from("twins").select("id, name, institution, programme, year, headline, visibility, handle").eq("id", userId).maybeSingle(),
        supabase
          .from("competencies")
          .select("id, level, evidence_count, updated_at, skills(name, category)")
          .eq("twin_id", userId)
          .order("updated_at", { ascending: false }),
        supabase.from("projects").select("id, title, description, created_at").eq("twin_id", userId).order("created_at", { ascending: false }),
        supabase
          .from("evidence")
          .select("id, competency_id, title, link, note, created_at")
          .eq("twin_id", userId)
          .order("created_at", { ascending: false }),
        // RLS only ever returns rows with submitted_at set for the owner — see
        // "evidence_reviews: owner select submitted" policy.
        supabase.from("evidence_reviews").select("id, evidence_id, reviewer_name, reviewer_role, comment").eq("twin_id", userId),
      ]);
      if (cancelled) return;
      if (twinRes.error) console.error("[profile] load twin failed:", twinRes.error.message);
      if (compsRes.error) console.error("[profile] load competencies failed:", compsRes.error.message);
      if (projectsRes.error) console.error("[profile] load projects failed:", projectsRes.error.message);
      if (evidenceRes.error) console.error("[profile] load evidence failed:", evidenceRes.error.message);
      if (reviewsRes.error) console.error("[profile] load evidence reviews failed:", reviewsRes.error.message);
      // A failed load must not render as an empty profile (it reads as lost data).
      if ([twinRes, compsRes, projectsRes, evidenceRes, reviewsRes].some((r) => r.error)) {
        setLoadError(true);
        setFetching(false);
        return;
      }
      setLoadError(false);
      setTwin((twinRes.data as Twin | null) ?? { id: userId, name: null, institution: null, programme: null, year: null, headline: null, visibility: "private", handle: null });
      setCompetencies((compsRes.data as unknown as Competency[] | null) ?? []);
      setProjectList((projectsRes.data as Project[] | null) ?? []);
      setEvidence((evidenceRes.data as Evidence[] | null) ?? []);
      setReviews((reviewsRes.data as EvidenceReview[] | null) ?? []);
      setFetching(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  if (loadError) {
    return (
      <LoadError
        onRetry={() => {
          setFetching(true);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  if (fetching || !twin) return <main className="p-16 text-center text-muted-foreground">Loading...</main>;

  const reviewedCount = competencies.filter((c) => competencyStatus(c, evidence, reviews) === "reviewed").length;
  const evidenceCount = competencies.filter((c) => c.evidence_count > 0).length;
  const initials = (twin.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const recentActivity = [
    ...competencies
      .filter((c) => c.evidence_count === 0)
      .map((c) => ({ at: c.updated_at, text: `${c.skills?.name ?? "A capability"} — self-reported` })),
    ...projectList.map((p) => ({ at: p.created_at, text: `Started project: ${p.title}` })),
    ...evidence.map((e) => {
      const skillName = competencies.find((c) => c.id === e.competency_id)?.skills?.name;
      return { at: e.created_at, text: `${e.title}${skillName ? ` — evidence for ${skillName}` : ""}` };
    }),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  const isEmpty = !twin.name && competencies.length === 0 && projectList.length === 0;

  return (
    <>
      <VisionHero signedIn />
      <ExampleShowcase />

      <Section className="pb-0 md:pb-0">
        <p className="scroll-mt-24 font-mono text-xs uppercase tracking-[0.2em] text-electric">
          {isEmpty ? "Now build yours" : "Your real MetaTwin"}
        </p>
      </Section>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <div className="absolute inset-0 opacity-50"><CareerGraph /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 py-12 md:py-16">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs text-ink-muted">Your MetaTwin</p>
            <Link to="/dashboard" className="text-xs text-ink-muted underline-offset-4 hover:text-ink-foreground hover:underline">Owner view →</Link>
          </div>
          <div className="hero-rise mt-8 grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
            <SampleAvatar initials={initials} className="h-64 w-52 rounded-3xl text-5xl shadow-glow ring-2 ring-electric/40 md:h-80 md:w-64" />
            <div className="min-w-0">
              <h1 className="mt-4 text-4xl font-semibold md:text-6xl">{twin.name || "Add your name"}</h1>
              <p className="mt-2 text-lg text-ink-muted">{twin.headline || "Add a headline from your dashboard"}</p>
              {(twin.institution || twin.programme) && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin className="h-4 w-4" />{[twin.institution, twin.programme].filter(Boolean).join(" · ")}{twin.year ? ` · Year ${twin.year}` : ""}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="hero"><Link to="/dashboard">Edit your MetaTwin</Link></Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                {[[String(competencies.length), "Capabilities"], [String(evidenceCount), "Evidence added"], [String(reviewedCount), "Reviewed"], [String(projectList.length), "Projects"]].map(([v, l]) => (
                  <div key={l}><p className="font-display text-xl font-semibold">{v}</p><p className="text-xs text-ink-muted">{l}</p></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          <div>
            <h2 className="text-2xl font-semibold">Capability Map</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each capability shows its evidence status.</p>
            {competencies.length === 0 ? (
              <Card className="mt-6 border-dashed">
                <p className="text-sm text-muted-foreground">No capabilities added yet. Add some from your <Link to="/dashboard" className="text-electric">dashboard</Link>.</p>
              </Card>
            ) : (
              <Reveal stagger={0.05} className="mt-6 space-y-6">
                {groups
                  .filter((g) => competencies.some((c) => c.skills?.category === g))
                  .map((g) => (
                    <div key={g}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {competencies.filter((c) => c.skills?.category === g).map((c) => {
                          const items = evidence.filter((e) => e.competency_id === c.id);
                          return (
                            <div key={c.id} className="rounded-xl border bg-card p-4 transition-shadow duration-200 hover:shadow-card">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium">{c.skills?.name ?? "Unknown skill"}</p>
                                <StatusBadge status={competencyStatus(c, evidence, reviews)} />
                              </div>
                              {items.length > 0 && (
                                <ul className="mt-2 space-y-2 border-t pt-2">
                                  {items.map((e) => {
                                    const href = safeHref(e.link);
                                    const review = reviews.find((r) => r.evidence_id === e.id);
                                    return (
                                      <li key={e.id}>
                                        {href ? (
                                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-electric hover:underline">
                                            {e.title}
                                          </a>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">{e.title}</span>
                                        )}
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
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </Reveal>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-semibold">Projects</h2>
            {projectList.length === 0 ? (
              <Card className="mt-6 border-dashed">
                <p className="text-sm text-muted-foreground">No projects added yet. Add some from your <Link to="/dashboard" className="text-electric">dashboard</Link>.</p>
              </Card>
            ) : (
              <Reveal stagger={0.08} className="mt-5 space-y-3">
                {projectList.map((p) => (
                  <Card key={p.id} className="transition-shadow duration-200 hover:shadow-card">
                    <p className="font-display font-semibold">{p.title}</p>
                    {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  </Card>
                ))}
              </Reveal>
            )}
          </div>

          {recentActivity.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold">Growth Timeline</h2>
              <Reveal as="ol" stagger={0.06} className="mt-5 space-y-0 border-l-2 border-electric/20 pl-6">
                {recentActivity.map((g, i) => (
                  <li key={i} className="relative pb-6">
                    <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background bg-electric" />
                    <p className="font-mono text-xs text-muted-foreground">{new Date(g.at).toLocaleDateString()}</p>
                    <p className="mt-0.5">{g.text}</p>
                  </li>
                ))}
              </Reveal>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <Card className="bg-muted/50">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              {twin.visibility === "public" && twin.handle ? (
                <span>
                  Your profile is public. Anyone with your link can view it:{" "}
                  <Link to="/t/$handle" params={{ handle: twin.handle }} className="text-electric underline-offset-4 hover:underline">
                    /t/{twin.handle}
                  </Link>
                </span>
              ) : (
                "This profile is private — only you can see it. You can share a public page from your dashboard."
              )}
            </p>
          </Card>
        </aside>
      </Section>
    </>
  );
}

function VisionHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop image={heroImg} />
      <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24">
        <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">Your MetaTwin</p>
        <h1 className="hero-rise-delay-1 mt-4 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">Your digital twin. Working for you, 24/7.</h1>
        <p className="hero-rise-delay-1 mt-5 max-w-2xl text-lg text-ink-muted">A MetaTwin is the AI version of you. It presents your proven skills to the world and searches for jobs, projects, gigs and collaborations that fit what you can actually do. It does this while you learn, build and sleep.</p>
        <div className="hero-rise-delay-2 mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            [Sparkles, "Presents your capability", "Your skills, projects and evidence, in one live record instead of a static CV."],
            [Search, "Searches for opportunities", "Scans jobs, projects and gigs that match your proven capabilities."],
            [Handshake, "Makes the introduction", "Puts you, and your AI team, in front of the people looking to hire."],
            [Bot, "Brings your AI team", "Comes with AI employees you supervise, so you're hired as a team."],
          ] as const).map(([I, t, d]) => (
            <div key={t} className="rounded-2xl border border-ink-foreground/10 bg-ink/60 p-5 backdrop-blur">
              <I className="h-5 w-5 text-electric" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-ink-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="hero-rise-delay-2 mt-10 flex flex-wrap gap-3">
          {signedIn ? (
            <>
              <Button asChild variant="hero"><Link to="/dashboard">Edit your MetaTwin <ArrowRight /></Link></Button>
              <Button asChild variant="heroOutline"><a href="#example">See an example MetaTwin</a></Button>
            </>
          ) : (
            <>
              <Button asChild variant="hero"><Link to="/build">Build Your MetaTwin <ArrowRight /></Link></Button>
              <Button asChild variant="heroOutline"><a href="#example">See Victorious's MetaTwin</a></Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ExampleShowcase() {
  return (
    <>
      <Section className="pb-0 md:pb-0">
        <p id="example" className="scroll-mt-24 font-mono text-xs uppercase tracking-[0.2em] text-electric">Example · What a MetaTwin looks like</p>
      </Section>
      <section className="relative mx-auto mt-4 max-w-7xl overflow-hidden rounded-3xl bg-gradient-ink text-ink-foreground md:mx-5 xl:mx-auto">
        <div className="absolute inset-0 opacity-50"><CareerGraph /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" aria-hidden />
        <div className="relative px-5 py-12 md:px-10 md:py-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs text-ink-muted">metatwin.app/<span className="text-ink-foreground">victorious</span></p>
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="text-xs text-ink-muted underline-offset-4 hover:text-ink-foreground hover:underline">Owner view →</Link>
              <SampleTag />
            </div>
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
            <img src={sampleProfilePhoto} alt={person.name} width={700} height={869} className="h-64 w-52 shrink-0 rounded-3xl object-cover shadow-glow ring-2 ring-electric/40 md:h-80 md:w-64" />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-electric/40 bg-electric/10 px-3 py-1 text-xs text-electric">
                <Bot className="h-3.5 w-3.5" /> Human + {aiEmployees.length} AI employees
              </span>
              <h2 className="mt-4 text-4xl font-semibold md:text-5xl">{person.name}</h2>
              <p className="mt-2 text-lg text-ink-muted">{person.headline}</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted"><MapPin className="h-4 w-4" />{person.location} · Open to gigs, internships & collaborations</p>
              <p className="mt-5 max-w-2xl text-ink-foreground/90">{person.intro}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="hero" onClick={() => toast.success("Hire request sent (demo)", { description: "Victorious and her AI team will be in touch." })}><Briefcase /> Hire Victorious + AI team</Button>
                <Button variant="heroOutline" onClick={() => toast("Connection request sent (demo)")}><UserPlus /> Connect</Button>
                <Button variant="heroOutline" onClick={() => toast("Following Victorious (demo)")}>Follow</Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                {[["8", "Capabilities"], ["28", "Evidence items"], ["2", "Reviewed"], ["612", "Connections"], ["1.4k", "Followers"]].map(([v, l]) => (
                  <div key={l}><p className="font-display text-xl font-semibold">{v}</p><p className="text-xs text-ink-muted">{l}</p></div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {person.focus.map((f) => <span key={f} className="rounded-full border border-ink-foreground/15 px-3 py-1 text-xs">{f}</span>)}
          </div>
        </div>
      </section>

      <Section className="pb-0 md:pb-0">
        <AITeam owner={person.name} />
      </Section>
    </>
  );
}

function SampleProfile() {
  return (
    <>
      <VisionHero signedIn={false} />
      <ExampleShowcase />

      <Section className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          <div>
            <h2 className="text-2xl font-semibold">Capability Map</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each capability shows its evidence status. Open one to see what supports it.</p>
            <Reveal stagger={0.05} className="mt-6 space-y-6">
              {groups.map((g) => (
                <div key={g}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {capabilities.filter((c) => c.group === g).map((c) => (
                      <Link key={c.slug} to="/capability/$slug" params={{ slug: c.slug }} className="group rounded-xl border bg-card p-4 transition-all duration-200 hover:border-electric/50 hover:shadow-card motion-safe:hover:-translate-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{c.name}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{c.evidence.length} evidence item{c.evidence.length === 1 ? "" : "s"} · {c.projects.length} project{c.projects.length === 1 ? "" : "s"}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </Reveal>
          </div>

          <div>
            <h2 className="text-2xl font-semibold">Projects and Work</h2>
            <Accordion type="single" collapsible className="mt-5 rounded-xl border bg-card px-5">
              {projects.slice(0, 4).map((p) => (
                <AccordionItem key={p.id} value={p.id}>
                  <AccordionTrigger className="text-left">
                    <span><span className="font-display">{p.title}</span><span className="ml-2 text-xs font-normal text-muted-foreground">{p.discipline} · {p.team.type}</span></span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-sm">
                    <p>{p.description}</p>
                    <p><span className="font-semibold">My contribution:</span> {p.team.myRole}</p>
                    {p.team.collective && <p className="text-muted-foreground"><span className="font-semibold">Team output:</span> {p.team.collective}</p>}
                    <p><span className="font-semibold">Evidence:</span> {p.samples.map((s) => s.title).join(", ")}</p>
                    <p><span className="font-semibold">Outcome:</span> {p.outcome}</p>
                    <Link to="/projects/$id" params={{ id: p.id }} className="inline-flex items-center gap-1 font-medium text-electric">View project <ArrowRight className="h-4 w-4" /></Link>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div>
            <h2 className="text-2xl font-semibold">Growth Timeline</h2>
            <Reveal as="ol" stagger={0.05} className="mt-5 space-y-0 border-l-2 border-electric/20 pl-6">
              {growth.map((g, i) => (
                <li key={i} className="relative pb-6">
                  <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background bg-electric" />
                  <p className="font-mono text-xs text-muted-foreground">{g.date} · {g.kind}</p>
                  <p className="mt-0.5">{g.text}</p>
                </li>
              ))}
            </Reveal>
          </div>
        </div>

        <aside className="space-y-5">
          <Card>
            <h3 className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4 text-electric" /> Development goals</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{person.goals.map((g) => <li key={g}>— {g}</li>)}</ul>
          </Card>
          <Card>
            <h3 className="font-semibold">Opportunity interests</h3>
            <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Fields</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{person.interests.fields.map((f) => <span key={f} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{f}</span>)}</div>
            <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Seeking</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{person.interests.experience.map((f) => <span key={f} className="rounded-full bg-electric-soft px-2.5 py-1 text-xs text-accent-foreground">{f}</span>)}</div>
          </Card>
          <Card className="bg-muted/50">
            <p className="flex items-start gap-2 text-sm text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> Victorious has chosen to share this profile. MetaTwin profiles are private unless the owner publishes them.</p>
          </Card>
        </aside>
      </Section>
    </>
  );
}
