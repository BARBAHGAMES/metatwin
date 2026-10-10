import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHero, Section } from "@/components/site";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About MetaTwin · MetaGlobe Technologies" },
      { name: "description", content: "MetaTwin is developed by MetaGlobe Technologies Ltd to help individuals build an evidence-based record of their capabilities." },
      { property: "og:title", content: "About MetaTwin" },
      { property: "og:description", content: "Moving beyond static CVs with evidence, feedback and growth over time." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero eyebrow="About MetaTwin" title="The Future of the CV.">
        MetaTwin is a digital platform developed by MetaGlobe Technologies Ltd to help individuals build an evolving, evidence-based record of their capabilities.
      </PageHero>
      <Section className="max-w-5xl">
        <p className="text-lg text-muted-foreground">Its purpose is to move beyond static CVs by connecting skills and experience to real projects, supporting evidence, feedback, and development over time.</p>
        <Reveal stagger={0.1} className="mt-10 grid gap-5 md:grid-cols-2">
          <Card>
            <p className="font-mono text-xs uppercase tracking-wider text-electric">Mission</p>
            <p className="mt-3 font-display text-xl font-semibold">Help individuals demonstrate what they can do through a growing record of evidence.</p>
          </Card>
          <Card className="bg-ink text-ink-foreground">
            <p className="font-mono text-xs uppercase tracking-wider text-electric">Vision</p>
            <p className="mt-3 font-display text-xl font-semibold">A future where an individual's capabilities can be understood through more than qualifications and claims alone.</p>
          </Card>
        </Reveal>
        <p className="mt-10 text-sm text-muted-foreground">MetaTwin represents a person's capabilities. It is not a biometric or physical replica of the individual.</p>
      </Section>
    </>
  );
}
