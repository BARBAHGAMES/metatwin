import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Check, FileCheck2, Layers, Paperclip, Rocket, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, HeroBackdrop, Section } from "@/components/site";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works · MetaTwin" },
      { name: "description", content: "The market is shifting to proof of capability. Bring your skills, the projects that prove them, and your own AI employees." },
      { property: "og:title", content: "How MetaTwin Works" },
      { property: "og:description", content: "Skills, project evidence and AI employees — together in one MetaTwin." },
    ],
  }),
  component: How,
});

const pillars = [
  { n: "01", i: Layers, t: "Skills", d: "What you can do — technical, creative, problem-solving and collaborative capabilities.", tag: "The claim" },
  { n: "02", i: FileCheck2, t: "Projects & evidence", d: "The work that proves it — prototypes, code, reports, feedback and reviews, linked to each skill.", tag: "The proof" },
  { n: "03", i: Bot, t: "AI employees", d: "Your own team of AI agents that research, build and operate — directed and supervised by you.", tag: "The multiplier" },
];

const steps = [
  { i: UserRound, t: "Create your profile", d: "Your identity, interests, background and goals." },
  { i: Layers, t: "Add your skills", d: "Document what you can do and what you're developing." },
  { i: Paperclip, t: "Prove them with projects", d: "Attach work samples, demos, feedback and reviews." },
  { i: Bot, t: "Add your AI employees", d: "Show the AI team that works for you, and how you supervise it." },
  { i: Rocket, t: "Get hired as a team", d: "Be discovered for gigs, roles and collaborations on evidence." },
];

function How() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-24">
          <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">How It Works</p>
          <h1 className="hero-rise-delay-1 mt-5 max-w-4xl text-4xl font-semibold leading-[1.08] md:text-6xl">
            The job market is shifting to a <span className="text-gradient-electric">proof-of-capability market.</span>
          </h1>
          <p className="hero-rise-delay-1 mt-6 max-w-2xl text-lg text-ink-muted">
            Listing skills is no longer enough. To compete, you need to bring your skills, the projects that prove them — and your own team of AI employees. Your MetaTwin is where all three come together.
          </p>
          <div className="hero-rise-delay-2 mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/build">Build Your MetaTwin <ArrowRight /></Link></Button>
            <Button asChild variant="heroOutline" size="lg"><Link to="/profile">View a MetaTwin</Link></Button>
          </div>
        </div>
      </section>

      <Section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">What you bring</p>
        <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Three things make a MetaTwin.</h2>
        <Reveal stagger={0.1} className="mt-10 grid gap-5 md:grid-cols-3">
          {pillars.map(({ n, i: I, t, d, tag }) => (
            <Card key={t} className="relative overflow-hidden">
              <span className="absolute right-5 top-4 font-display text-5xl font-semibold text-muted">{n}</span>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-electric text-primary-foreground"><I className="h-5 w-5" /></div>
              <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-electric">{tag}</p>
              <h3 className="mt-1 text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </Card>
          ))}
        </Reveal>

        <div className="mt-12 grid overflow-hidden rounded-2xl border md:grid-cols-2">
          <div className="bg-card p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">The old way · CV</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {["A static list of claimed skills", "Projects described, not shown", "You alone — capacity limited to your hours", "Rewritten every time you apply"].map((x) => <li key={x} className="flex gap-2"><X className="mt-0.5 h-4 w-4 shrink-0" />{x}</li>)}
            </ul>
          </div>
          <div className="bg-ink p-6 text-ink-foreground md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-electric">The new way · MetaTwin</p>
            <ul className="mt-4 space-y-3 text-sm">
              {["Skills with a clear evidence status", "Projects with work samples, feedback and journey", "You + your AI employees — a team, ready to hire", "A living record that grows as you do"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-electric" />{x}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      <section className="border-t bg-card">
        <Section>
          <h2 className="text-3xl font-semibold md:text-4xl">Five steps to your MetaTwin.</h2>
          <Reveal as="ol" stagger={0.08} className="mt-10 grid gap-5 md:grid-cols-5">
            {steps.map(({ i: I, t, d }, n) => (
              <li key={t} className="rounded-2xl border bg-background p-6 shadow-card">
                <span className="font-mono text-xs text-electric">Step {n + 1}</span>
                <div className="mt-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-electric text-primary-foreground"><I className="h-5 w-5" /></div>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </Reveal>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/build">Build Your MetaTwin</Link></Button>
            <Button asChild variant="outline" size="lg" className="rounded-full"><Link to="/dashboard">See an example setup</Link></Button>
          </div>
        </Section>
      </section>
    </>
  );
}
