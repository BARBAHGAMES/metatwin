import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import heroImg from "@/assets/hero-metatwin.jpg";
import { useEffect } from "react";
import { ArrowRight, MapPin, Target, Lock, Bot, Briefcase, UserPlus, Sparkles, Search, Handshake } from "lucide-react";
import { toast } from "sonner";
import { aiEmployees, capabilities, growth, person, projects } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { AITeam } from "@/components/AITeam";
import { CareerGraph } from "@/components/CareerGraph";
import { Button } from "@/components/ui/button";
import sampleProfilePhoto from "@/assets/sample-profile.jpg";
import { Card, HeroBackdrop, SampleTag, Section, StatusBadge } from "@/components/site";
import { Reveal } from "@/components/Reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

// A signed-in student's own real profile now lives at /dashboard (Overview
// tab carries the Growth Timeline and capability map this page used to show).
// Signed-out visitors still see the fictional vision/sample page below.
function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard" });
  }, [authLoading, user, navigate]);

  if (authLoading || user) return <main className="p-16 text-center text-muted-foreground">Loading...</main>;
  return <SampleProfile />;
}

function VisionHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop image={heroImg} />
      <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24">
        <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">Your MetaTwin</p>
        <h1 className="hero-rise-delay-1 mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.03em] md:text-6xl">Your digital twin. Working for you, 24/7.</h1>
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
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">{person.name}</h2>
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

        <aside className="min-w-0 space-y-5">
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
