import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRound, Layers, Paperclip, RefreshCw, Rocket, FileText, Sheet, FileEdit, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHero, Section } from "@/components/site";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works · MetaTwin" },
      { name: "description", content: "Five steps to build an evidence-based record of your capabilities with MetaTwin." },
      { property: "og:title", content: "How MetaTwin Works" },
      { property: "og:description", content: "Create, add capabilities, attach evidence, improve, and put your capabilities to work." },
    ],
  }),
  component: How,
});

const steps = [
  { i: UserRound, t: "Create Your Profile", d: "Establish your identity, interests, background, and goals." },
  { i: Layers, t: "Add Your Capabilities", d: "Document the skills and competencies you are developing or already possess." },
  { i: Paperclip, t: "Attach Your Evidence", d: "Connect capabilities to projects, work samples, demonstrations, and documented experience." },
  { i: RefreshCw, t: "Learn and Improve", d: "Capture feedback, record revisions, and add new milestones as your capabilities grow." },
  { i: Rocket, t: "Put Your Capabilities to Work", d: "Use your evolving record to communicate your abilities and explore relevant opportunities." },
];

const tools = [
  { i: FileText, t: "Google Forms", d: "Project and capability information intake." },
  { i: Sheet, t: "Google Sheets", d: "Tracking projects, feedback, milestones and status." },
  { i: FileEdit, t: "Google Docs", d: "Detailed project records and development history." },
  { i: Globe, t: "Google Sites", d: "Publishing approved project landing pages." },
];

function How() {
  return (
    <>
      <PageHero eyebrow="How It Works" title="Five steps from claims to capability." />
      <Section>
        <ol className="grid gap-5 md:grid-cols-5">
          {steps.map(({ i: I, t, d }, n) => (
            <li key={t} className="relative rounded-2xl border bg-card p-6 shadow-card">
              <span className="font-mono text-xs text-electric">Step {n + 1}</span>
              <div className="mt-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-electric text-primary-foreground"><I className="h-5 w-5" /></div>
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="hero" size="lg"><Link to="/signup">Build Your MetaTwin</Link></Button>
          <Button asChild variant="outline" size="lg" className="rounded-full"><Link to="/journey">See a project journey</Link></Button>
        </div>
      </Section>
      <section className="border-t bg-card">
        <Section>
          <h2 className="text-2xl font-semibold md:text-3xl">Initial operating model</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">The first rollout is supported by Google Workspace. This prototype does not sync with these tools — links below are placeholders until resources are provided.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map(({ i: I, t, d }) => (
              <Card key={t}>
                <I className="h-5 w-5 text-electric" />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                <span className="mt-4 inline-block rounded-md border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground">[Placeholder link — to be provided]</span>
              </Card>
            ))}
          </div>
        </Section>
      </section>
    </>
  );
}
