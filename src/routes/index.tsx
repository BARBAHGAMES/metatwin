import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-home.jpg";
import { ArrowRight, Layers, FileCheck2, TrendingUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileMockup } from "@/components/ProfileMockup";
import sampleProfilePhoto from "@/assets/sample-profile.jpg";
import { Card, HeroBackdrop, Section, StatusBadge } from "@/components/site";
import { Reveal } from "@/components/Reveal";
import { capBySlug, statusMeta, type Status } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MetaTwin — The Future of the CV" },
      { name: "description", content: "Your CV tells people what you've done. MetaTwin shows them what you can do — with evidence." },
      { property: "og:title", content: "MetaTwin — The Future of the CV" },
      { property: "og:description", content: "A living, evidence-based digital twin of your capabilities." },
    ],
  }),
  component: Home,
});

const loop = ["Learn", "Build", "Demonstrate", "Receive Feedback", "Improve", "Grow"];

function Home() {
  const cap = capBySlug("3d-modelling")!;
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop image={heroImg} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 md:py-24 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="hero-rise inline-flex items-center gap-2 rounded-full border border-ink-foreground/15 bg-ink-foreground/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-electric">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric" /> The Future of the CV
            </p>
            <h1 className="hero-rise-delay-1 mt-5 text-4xl font-semibold leading-[1.08] md:text-6xl">
              Your CV lists skills. <span className="text-gradient-electric">Your MetaTwin brings a workforce.</span>
            </h1>
            <p className="hero-rise-delay-1 mt-6 max-w-xl text-lg text-ink-muted">
              In the age of capability, everyone needs two things: proof of what they can do, and a team of AI employees working for them. MetaTwin puts both in one profile, so one hire brings a whole team.
            </p>
            <div className="hero-rise-delay-2 mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg"><Link to="/build">Build Your MetaTwin <ArrowRight /></Link></Button>
              <Button asChild variant="heroOutline" size="lg"><Link to="/profile">Explore a Profile</Link></Button>
            </div>
          </div>
          <ProfileMockup />
        </div>
      </section>

      <section className="border-b bg-card">
        <Section>
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">The capability network</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Connect. Show your work. Get matched on evidence.</h2>
            <p className="mt-4 text-muted-foreground">A professional network, a portfolio of proof and a marketplace of opportunity — for a new breed of workforce: individuals with proven capability and their own team of AI employees.</p>
          </div>
          <Reveal stagger={0.1} className="mt-10 grid gap-5 lg:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your network</p>
              <div className="mt-4 flex items-center gap-3">
                <img src={sampleProfilePhoto} alt="Victorious Kibaki" className="h-10 w-10 shrink-0 rounded-full object-cover object-top" />
                <div className="min-w-0"><p className="truncate text-sm font-semibold">Victorious Kibaki</p><p className="text-xs text-muted-foreground">added new evidence · 2h</p></div>
              </div>
              <p className="mt-3 text-sm">Pilot results are in: AquaLoop v3 is diverting ~600 L of water a week. 💧</p>
              <div className="mt-3 rounded-lg bg-electric-soft p-3 text-xs text-accent-foreground">Linked to 3D Modelling · Systems Thinking</div>
              <p className="mt-3 text-xs text-muted-foreground">24 endorsements of evidence · 6 comments</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your proof</p>
              <p className="mt-4 font-display text-lg font-semibold">8 capabilities · 28 evidence items</p>
              <ul className="mt-4 space-y-2">
                {(["reviewed", "evidence", "self"] as Status[]).map((s, i) => (
                  <li key={s} className="flex items-center justify-between text-sm"><StatusBadge status={s} /><span className="font-mono text-xs text-muted-foreground">{[2, 4, 2][i]}</span></li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">Transparent statuses, never a single score.</p>
            </Card>
            <Card className="bg-ink text-ink-foreground">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Your opportunities</p>
              {[
                ["Freelance: 3D prototype for agri startup", "Gig · 3 weeks"],
                ["Circular Product Design Internship", "Internship · 6 months"],
                ["Mentor match: hardware founder", "Mentorship"],
              ].map(([t, m]) => (
                <div key={t} className="mt-3 rounded-lg bg-ink-soft p-3">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-ink-muted">{m} · matched on evidence</p>
                </div>
              ))}
            </Card>
          </Reveal>
        </Section>
      </section>

      <Section>
        <h2 className="text-3xl font-semibold md:text-4xl">From Claims to Capability.</h2>
        <Reveal stagger={0.1} className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { icon: Layers, t: "Capture Your Capabilities", d: "Build a structured record of your skills, experience, interests, projects, and development." },
            { icon: FileCheck2, t: "Show the Evidence", d: "Connect skills to real projects, prototypes, work samples, documented contributions, and relevant reviews." },
            { icon: TrendingUp, t: "Grow Your Potential", d: "Track progress, strengthen your profile, and discover opportunities relevant to your demonstrated capabilities." },
          ].map(({ icon: I, t, d }) => (
            <Card key={t}>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-electric-soft text-electric"><I className="h-5 w-5" /></div>
              <h3 className="mt-5 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </Card>
          ))}
        </Reveal>
      </Section>

      <section className="border-y bg-card">
        <Section>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold md:text-4xl">Your Story Doesn't End at Your CV.</h2>
              <p className="mt-4 text-muted-foreground">
                Instead of rewriting a CV whenever you gain experience, you keep adding new evidence to an evolving record. Your MetaTwin develops as you do.
              </p>
            </div>
            <Reveal as="ol" stagger={0.06} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {loop.map((s, i) => (
                <li key={s} className="relative rounded-xl border bg-background p-4">
                  <span className="font-mono text-xs text-electric">0{i + 1}</span>
                  <p className="mt-2 font-display font-semibold">{s}</p>
                  {i < loop.length - 1 && <ArrowRight className="absolute right-3 top-4 h-4 w-4 text-muted-foreground" />}
                </li>
              ))}
            </Reveal>
          </div>
        </Section>
      </section>

      <Reveal>
        <Section>
          <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Proof of capability</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Skills Are Claims. Evidence Makes Them Credible.</h2>
            <p className="mt-4 text-muted-foreground">Every capability in MetaTwin carries a clear evidence relationship and an honest status. Not everything is verified — and MetaTwin never pretends it is. There is no universal score.</p>
            <ul className="mt-8 space-y-3">
              {(Object.keys(statusMeta) as Status[]).map((s) => (
                <li key={s} className="flex items-start gap-3"><StatusBadge status={s} /><span className="text-sm text-muted-foreground">{statusMeta[s].desc}</span></li>
              ))}
            </ul>
          </div>
          <Card className="p-0">
            <div className="flex items-center justify-between gap-3 border-b p-5">
              <div><p className="text-xs text-muted-foreground">Capability</p><p className="font-display text-xl font-semibold">{cap.name}</p></div>
              <StatusBadge status={cap.status} />
            </div>
            <ul className="divide-y">
              {cap.evidence.map((e) => (
                <li key={e.title} className="flex gap-3 p-4">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                  <div><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.type} · {e.note}</p></div>
                </li>
              ))}
              <li className="bg-status-reviewed-bg p-4 text-sm">
                <p className="font-medium text-status-reviewed">Reviewer feedback · {cap.review!.reviewer}</p>
                <p className="mt-1 text-muted-foreground">Scope: {cap.review!.scope}</p>
              </li>
            </ul>
            <div className="p-4"><Button asChild variant="link" className="px-0"><Link to="/capability/$slug" params={{ slug: cap.slug }}>Open capability detail <ArrowRight /></Link></Button></div>
          </Card>
        </div>
        </Section>
      </Reveal>

      <section className="bg-ink text-ink-foreground">
        <Reveal>
        <Section>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold md:text-4xl">Make Your Capabilities Discoverable.</h2>
              <p className="mt-4 text-ink-muted">A structured capability record helps you present relevant evidence when exploring career opportunities, projects and collaborations, mentorship, practical experience, further learning, and innovation and entrepreneurship.</p>
              <p className="mt-6 flex items-start gap-2 text-sm text-ink-muted"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-electric" /> Private by default. Your profile is never public just because it exists — you choose what to share, and with whom.</p>
              <p className="mt-3 text-xs text-ink-muted">Alignment is illustrative. MetaTwin does not guarantee employment, funding or commercial outcomes.</p>
            </div>
            <div className="rounded-2xl border border-ink-foreground/10 bg-ink-soft p-6">
              <p className="font-mono text-[10px] uppercase tracking-wider text-electric">Sample opportunity</p>
              <h3 className="mt-2 text-xl font-semibold">Circular Product Design Internship</h3>
              <p className="text-sm text-ink-muted">Fictional studio · 6 months · Hybrid</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-muted">How Victorious's evidence aligns</p>
              <ul className="mt-3 space-y-2.5">
                {[
                  ["3D Modelling", "AquaLoop v3 model + review", "reviewed"],
                  ["Sustainable Materials", "Stated, no evidence yet", "self"],
                  ["Technical Writing", "AquaLoop assembly guide", "evidence"],
                ].map(([n, e, s]) => (
                  <li key={n} className="flex items-center justify-between gap-3 rounded-lg bg-ink p-3">
                    <div className="min-w-0"><p className="text-sm">{n}</p><p className="truncate text-xs text-ink-muted">{e}</p></div>
                    <StatusBadge status={s as Status} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
        </Reveal>
      </section>

      <Reveal>
        <Section className="text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold md:text-5xl">Don't just tell the world what you can do. <span className="text-gradient-electric">Show the evidence.</span></h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="lg"><Link to="/build">Build Your MetaTwin</Link></Button>
            <Button asChild variant="outline" size="lg" className="rounded-full"><Link to="/profile">Explore a Profile</Link></Button>
          </div>
        </Section>
      </Reveal>
    </>
  );
}
