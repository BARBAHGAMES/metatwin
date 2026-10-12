import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-pricing.jpg";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Info, Building2, Users, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHero, Section } from "@/components/site";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { WHATSAPP_CONTACT_URL, WHATSAPP_CONTACT_DISPLAY, comparisonRows, formatKES, individualPlans, teamPackages, teamTiers, teamTierPrice, teamPremium, type Availability, type TeamPackage } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · MetaTwin Plans for Individuals, Teams & Campuses" },
      { name: "description", content: "MetaTwin plans from KES 2,000 per year. Individual memberships, team packages and custom campus partnerships." },
      { property: "og:title", content: "MetaTwin Pricing" },
      { property: "og:description", content: "Your next opportunity starts with what you can prove. Plans from KES 2,000 per year." },
    ],
  }),
  component: Pricing,
});

const availLabel: Record<Exclude<Availability, "live">, string> = { proposed: "Proposed", planned: "Coming soon" };

function AvailTag({ a }: { a?: Availability | undefined }) {
  if (!a || a === "live") return null;
  return <span className="ml-1.5 whitespace-nowrap rounded border border-dashed border-electric/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-foreground">{availLabel[a]}</span>;
}

const faqs: [string, string][] = [
  ["Is MetaTwin a CV builder?", "MetaTwin goes beyond a traditional CV. It is designed to help you build a record of your skills, projects, achievements, and supporting evidence that can grow as you gain experience."],
  ["Can I join without a team?", "Yes. You can start with an individual membership and build your personal profile."],
  ["What if I'm working on a project with other students?", "You can choose a team package. Each member has an individual profile, and the team documents its shared project and each person's contributions."],
  ["Can I join a team if I already have a MetaTwin profile?", "The intended experience is to connect your existing profile to the shared team project. Linking existing profiles to team projects is a feature in development — contact us and we'll help you set it up."],
  ["Are mentoring sessions included?", "Four individual Builder Sessions per year are proposed for Guided and Builder memberships. They will be confirmed once mentor availability, booking rules, and delivery arrangements are in place. Sessions are with mentors from our network, subject to availability."],
  ["Can my university pay for students?", "Yes. MetaTwin Campus is intended for institutions that want to sponsor individual memberships or support student cohorts. Contact us to discuss a suitable arrangement."],
  ["Can I upgrade later?", "Yes — get in touch and we'll help you move to a different plan. Online plan management isn't available yet."],
];

const emptyPartnershipForm = { institution: "", contact: "", email: "", phone: "", message: "" };

function Pricing() {
  const [tab, setTab] = useState<"individual" | "team">("individual");
  const [size, setSize] = useState<TeamPackage["id"]>("studio");
  const pkg = teamPackages.find((p) => p.id === size)!;
  const [partnershipOpen, setPartnershipOpen] = useState(false);
  const [partnershipForm, setPartnershipForm] = useState(emptyPartnershipForm);
  const [submittingPartnership, setSubmittingPartnership] = useState(false);

  async function submitPartnershipInquiry() {
    setSubmittingPartnership(true);
    const { error } = await supabase.rpc("submit_partnership_inquiry", {
      p_institution_name: partnershipForm.institution,
      p_contact_name: partnershipForm.contact,
      p_email: partnershipForm.email,
      p_phone: partnershipForm.phone,
      p_message: partnershipForm.message,
    });
    setSubmittingPartnership(false);
    if (error) {
      toast.error(error.message || "Couldn't send that — try again.");
      return;
    }
    toast.success("Thanks — we'll be in touch about a partnership.");
    setPartnershipOpen(false);
    setPartnershipForm(emptyPartnershipForm);
  }
  return (
    <>
      <PageHero
        image={heroImg}
        imageClassName="sm:object-[62%_52%]"
        className="md:flex md:min-h-[640px] md:items-center"
        eyebrow="Pricing"
        title="Your next opportunity starts with what you can prove."
      >
        MetaTwin helps you build a record of your skills, projects, achievements, and contributions. Start with your individual profile or bring your team together to document what you're building.
      </PageHero>

      <Section className="py-12 md:py-16">
        <div className="flex flex-col items-center gap-4">
          <div role="tablist" aria-label="Plan type" className="inline-flex rounded-full border bg-card p-1 shadow-card">
            {([["individual", "Individual Plans"], ["team", "Team Packages"]] as const).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2", tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">All prices in Kenyan shillings (KES), billed annually.</p>
        </div>

        {tab === "individual" ? (
          <div role="tabpanel" className="mt-10">
            <div className="grid gap-5 lg:grid-cols-3">
              {individualPlans.map((p) => (
                <div key={p.id} className={cn("relative flex flex-col rounded-2xl border bg-card p-7 transition hover:border-electric/50", p.featured && "border-electric/60 shadow-card")}>
                  {p.featured && <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground">Most guidance</span>}
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="mt-4"><span className="font-display text-4xl font-semibold">{formatKES(p.price)}</span><span className="text-sm text-muted-foreground"> / year</span></p>
                  <p className="mt-4 font-medium">{p.headline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                  {p.includesPrevious && <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-electric">{p.includesPrevious}</p>}
                  <ul className={cn("space-y-2.5 text-sm", p.includesPrevious ? "mt-3" : "mt-6")}>
                    {p.features.map((f) => <li key={f.text} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-electric" /><span>{f.text}<AvailTag a={f.availability} /></span></li>)}
                  </ul>
                  <div className="mt-auto pt-8">
                    <Button asChild variant={p.featured ? "hero" : "outline"} className="w-full rounded-full"><Link to="/build">{p.cta}</Link></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-14">
              <h2 className="text-2xl font-semibold">Compare individual plans</h2>
              <div className="mt-5 overflow-x-auto rounded-2xl border bg-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead><tr className="border-b bg-muted/50 text-left">
                    <th scope="col" className="p-4 font-semibold">Feature</th>
                    <th scope="col" className="p-4 font-semibold">Basic</th>
                    <th scope="col" className="relative bg-primary p-4 font-semibold text-primary-foreground">
                      <span className="absolute inset-x-0 -top-px h-0.5 bg-electric" aria-hidden />
                      Guided <span className="ml-1 font-normal text-primary-foreground/70">· Most guidance</span>
                    </th>
                    <th scope="col" className="p-4 font-semibold">Builder</th>
                  </tr></thead>
                  <tbody>
                    {comparisonRows.map((r) => (
                      <tr key={r.feature} className="border-b last:border-0">
                        <th scope="row" className="p-4 text-left font-medium">{r.feature}</th>
                        {[r.basic, r.guided, r.builder].map((v, i) => (
                          <td key={i} className={cn("p-4", i === 1 && "bg-electric-soft/60 font-medium", v === "Included" ? "text-foreground" : v === "Not included" ? "text-muted-foreground" : "text-accent-foreground")}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div role="tabpanel" className="mt-10">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-semibold">Great projects are rarely built alone.</h2>
              <p className="mt-3 text-muted-foreground">Your team builds together, but every member has their own story to tell. MetaTwin connects a shared project with individual profiles, helping teams document what they build and each person's contribution.</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" /> Proposed annual launch prices.</p>
            </div>

            <div className="mt-8 flex justify-center">
              <div role="radiogroup" aria-label="Team size" className="inline-flex rounded-full border bg-card p-1">
                {teamPackages.map((p) => (
                  <button key={p.id} role="radio" aria-checked={size === p.id} onClick={() => setSize(p.id)}
                    className={cn("cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2", size === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {p.name.replace("Team ", "")} · {p.members}
                  </button>
                ))}
              </div>
            </div>

            <p className="mx-auto mt-6 max-w-3xl rounded-xl border border-electric/30 bg-electric/5 p-4 text-center text-sm">
              Every team package includes individual MetaTwin Basic access for each member. Team Guided adds group mentoring, while Team Builder adds mentoring and advanced planning tools. Team packages do not automatically include the four individual Builder Sessions offered in the individual Guided and Builder plans.
            </p>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {teamTiers.map((t) => (
                <div key={t.id} className={cn("relative flex flex-col rounded-2xl border bg-card p-7 transition hover:border-electric/50", t.featured && "border-electric/60 shadow-card")}>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-electric"><Users className="h-3.5 w-3.5" />{pkg.name} · {pkg.members} members</p>
                  <h3 className="mt-2 text-lg font-semibold">{t.name}</h3>
                  <p className="mt-4"><span className="font-display text-4xl font-semibold">{formatKES(teamTierPrice(pkg, t))}</span><span className="text-sm text-muted-foreground"> / year</span></p>
                  {t.id !== "basic" && <p className="mt-1 text-sm text-muted-foreground">Team Basic {formatKES(pkg.price)} + {formatKES(teamPremium(pkg, t))}</p>}
                  <p className="mt-4 font-medium">{t.headline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
                  {t.includesPrevious && <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-electric">{t.includesPrevious}</p>}
                  <ul className={cn("space-y-2.5 text-sm", t.includesPrevious ? "mt-3" : "mt-6")}>
                    {t.features.map((f) => <li key={f.text} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-electric" /><span>{f.text}<AvailTag a={f.availability} /></span></li>)}
                  </ul>
                  {t.id !== "basic" && <p className="mt-4 text-xs text-muted-foreground">Group sessions for the team, not individual sessions per member. Subject to mentor availability, booking rules, and confirmed delivery arrangements.</p>}
                  <div className="mt-auto pt-8"><Button asChild variant={t.featured ? "hero" : "outline"} className="w-full rounded-full"><Link to="/build">{t.cta}</Link></Button></div>
                </div>
              ))}
            </div>

            <div className="mt-14 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold">Compare team packages</h2>
                <div className="mt-5 overflow-x-auto rounded-2xl border bg-card">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th scope="col" className="p-4 text-left font-semibold">Team size</th>
                      {teamTiers.map((t) => <th key={t.id} scope="col" className="p-4 text-right font-semibold">{t.name.replace("Team ", "")}</th>)}
                    </tr></thead>
                    <tbody>{teamPackages.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <th scope="row" className="p-4 text-left font-medium">{p.name} <span className="font-normal text-muted-foreground">· {p.members} members</span></th>
                        {teamTiers.map((t) => <td key={t.id} className="p-4 text-right font-mono">{formatKES(teamTierPrice(p, t))}</td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <Card className="self-start">
                <h3 className="font-semibold">Team package terms</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>— Prices are annual.</li>
                  <li>— Each package includes the number of individual memberships shown, and one shared project.</li>
                  <li>— Additional members or projects require a separate quote.</li>
                  <li>— Team Guided includes four group Builder Sessions per team per year, subject to confirmed mentor availability and booking rules. Team Builder includes the same allowance.</li>
                  <li>— Team packages don't automatically include individual mentoring sessions for every member.</li>
                  <li>— Members keep their individual profiles and document their own roles and contributions.</li>
                  <li>— Features marked "Planned" are not live yet.</li>
                </ul>
                <p className="mt-4 text-sm">Bigger team or more projects? <a href={WHATSAPP_CONTACT_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-electric underline-offset-4 hover:underline">Message us on WhatsApp</a></p>
              </Card>
            </div>
          </div>
        )}
      </Section>

      <section className="bg-ink text-ink-foreground">
        <Section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-electric"><Building2 className="h-4 w-4" /> MetaTwin Campus · Custom pricing</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Help your students make their capabilities visible.</h2>
            <p className="mt-4 text-ink-muted">Give student cohorts a structured way to document skills, showcase innovation projects, and build evidence of what they have accomplished.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="hero" size="lg" onClick={() => setPartnershipOpen(true)}>Discuss an Institutional Partnership</Button>
              <Button asChild variant="heroOutline" size="lg">
                <a href={WHATSAPP_CONTACT_URL} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp us</a>
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">Prefer WhatsApp? {WHATSAPP_CONTACT_DISPLAY}</p>
          </div>
          <div className="rounded-2xl border border-ink-foreground/10 bg-ink-soft p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Potential offerings</p>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {["Student cohort onboarding", "Individual profile development", "Innovation and capstone project showcases", "Team project documentation", "Skills and portfolio workshops", "Sponsored student memberships", "Optional mentor programmes and employer challenges"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-electric" />{x}</li>)}
            </ul>
          </div>
        </Section>
      </section>

      <Section className="max-w-4xl">
        <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="mt-6 rounded-2xl border bg-card px-6">
          {faqs.map(([q, a]) => (
            <AccordionItem key={q} value={q} className="last:border-0">
              <AccordionTrigger className="text-left">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-xs text-muted-foreground">Online payment isn't connected yet. Choosing a plan takes you to the MetaTwin setup flow; no payment is taken.</p>
      </Section>

      <Dialog open={partnershipOpen} onOpenChange={(open) => { setPartnershipOpen(open); if (!open) setPartnershipForm(emptyPartnershipForm); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Discuss an institutional partnership</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tell us a bit about your institution and we'll be in touch. No commitment — this just starts the conversation.</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="partnership-institution">Institution name</Label>
              <Input id="partnership-institution" maxLength={200} value={partnershipForm.institution} onChange={(e) => setPartnershipForm({ ...partnershipForm, institution: e.target.value })} placeholder="e.g. Strathmore University" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partnership-contact">Your name</Label>
              <Input id="partnership-contact" maxLength={120} value={partnershipForm.contact} onChange={(e) => setPartnershipForm({ ...partnershipForm, contact: e.target.value })} placeholder="e.g. Dr. Imani Wekesa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partnership-email">Email</Label>
              <Input id="partnership-email" type="email" maxLength={254} value={partnershipForm.email} onChange={(e) => setPartnershipForm({ ...partnershipForm, email: e.target.value })} placeholder="you@institution.ac.ke" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partnership-phone">Phone (optional)</Label>
              <Input id="partnership-phone" type="tel" maxLength={40} value={partnershipForm.phone} onChange={(e) => setPartnershipForm({ ...partnershipForm, phone: e.target.value })} placeholder="+254…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partnership-message">What are you looking for? (optional)</Label>
              <Textarea id="partnership-message" rows={3} maxLength={2000} value={partnershipForm.message} onChange={(e) => setPartnershipForm({ ...partnershipForm, message: e.target.value })} placeholder="Cohort size, timeline, what you'd want to pilot…" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={submitPartnershipInquiry}
              disabled={submittingPartnership || !partnershipForm.institution.trim() || !partnershipForm.contact.trim() || !partnershipForm.email.trim()}
            >
              {submittingPartnership ? "Sending…" : "Send inquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
