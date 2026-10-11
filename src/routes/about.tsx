import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, FileCheck2, Layers } from "lucide-react";
import heroImg from "@/assets/hero-about.jpg";
import { Button } from "@/components/ui/button";
import { Card, PageHero, Section } from "@/components/site";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About MetaTwin · Kenya's First Workforce with AI Employees" },
      { name: "description", content: "MetaTwin positions Kenyan youth as the first workforce to arrive with proven capabilities and their own team of AI employees." },
      { property: "og:title", content: "About MetaTwin · The Future of the CV" },
      { property: "og:description", content: "Future hires bring proof of capability and a team of AI employees. Kenyan youth are leading the way." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const pillars = [
  { icon: Layers, title: "Capabilities", text: "The skills you can actually do, not just the ones you list." },
  { icon: FileCheck2, title: "Proof", text: "Real projects, evidence and feedback that show your work." },
  { icon: Bot, title: "AI employees", text: "A team of AI employees you supervise, multiplying what you deliver." },
];

function About() {
  return (
    <>
      <PageHero
        image={heroImg}
        imageClassName="hero-drift-soft object-top sm:object-top"
        eyebrow="About MetaTwin · The Future of the CV"
        title={
          <>
            Everyone needs an AI workforce.
            <br />
            <span className="text-gradient-electric">Kenyan youth lead in AI.</span>
          </>
        }
      >
        A CV lists skills. A MetaTwin brings proof of capability and a team of AI employees, so the next hire arrives as a whole team. MetaTwin is how Kenya's young people become the first workforce to do it.
      </PageHero>

      <Section className="max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Why we exist</p>
        <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Employers no longer hire a CV. They hire what you can deliver.</h2>
        <p className="mt-5 text-lg text-muted-foreground">
          A CV lists what you say you can do. In the age of capability, that isn't enough. Future hires need to show proof of what they've built, and bring the AI employees that help them deliver more, faster. That combination is a new kind of candidate, and Kenya's young people are ready to be the first.
        </p>

        <Reveal stagger={0.1} className="mt-10 grid gap-5 md:grid-cols-3">
          {pillars.map(({ icon: I, title, text }) => (
            <Card key={title}>
              <I className="h-5 w-5 text-electric" />
              <p className="mt-3 font-display text-lg font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </Card>
          ))}
        </Reveal>
      </Section>

      <section className="bg-ink text-ink-foreground">
        <Section className="max-w-5xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Kenya first</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">The first workforce to arrive with AI employees.</h2>
          <p className="mt-5 text-lg text-ink-muted">
            Kenya's youth are creative, digital-first and hungry to build. MetaTwin gives every young Kenyan a way to turn that energy into a living record of capability, and to stand behind it with their own supervised AI team. When an employer, client or partner meets a MetaTwin, they don't meet a candidate. They meet a ready-made team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero"><Link to="/build">Build Your MetaTwin <ArrowRight /></Link></Button>
            <Button asChild variant="heroOutline"><Link to="/profile">See a MetaTwin</Link></Button>
          </div>
        </Section>
      </section>

      <Section className="max-w-5xl">
        <Reveal stagger={0.1} className="grid gap-5 md:grid-cols-2">
          <Card>
            <p className="font-mono text-xs uppercase tracking-wider text-electric">Mission</p>
            <p className="mt-3 font-display text-xl font-semibold">Equip Kenyan youth to prove what they can do, and to deliver it with a team of AI employees.</p>
          </Card>
          <Card className="bg-ink text-ink-foreground">
            <p className="font-mono text-xs uppercase tracking-wider text-electric">Vision</p>
            <p className="mt-3 font-display text-xl font-semibold">A world of work where every hire arrives with proof of capability and their own AI workforce, starting in Kenya.</p>
          </Card>
        </Reveal>
        <p className="mt-10 text-sm text-muted-foreground">MetaTwin is developed by MetaGlobe Technologies Ltd. A MetaTwin represents a person's capabilities. It is not a biometric or physical replica of the individual. AI employees work under the person's supervision, and their output is never counted as the person's own evidence.</p>
      </Section>
    </>
  );
}
