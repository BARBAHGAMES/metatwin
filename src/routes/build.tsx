import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileCheck2, Lock, Plus, Sparkles, Trash2, UserRound, Layers, Paperclip, Target, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, HeroBackdrop, StatusBadge } from "@/components/site";
import { statusMeta, type Status } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "Build Your MetaTwin · Get started" },
      { name: "description", content: "Create your MetaTwin in five steps: profile, capabilities, evidence, goals and privacy." },
      { property: "og:title", content: "Build Your MetaTwin" },
      { property: "og:description", content: "Turn what you can do into an evidence-based profile in minutes." },
    ],
  }),
  component: Build,
});

type Cap = { name: string; group: string; status: Status };
type Ev = { title: string; type: string; cap: string; link: string; contribution: string };
type Visibility = "private" | "link" | "network" | "public";

const steps = [
  { t: "Profile", d: "Who are you?", i: UserRound },
  { t: "Capabilities", d: "What can you do?", i: Layers },
  { t: "Evidence", d: "Can you show it?", i: Paperclip },
  { t: "Goals", d: "Where can it take you?", i: Target },
  { t: "Privacy", d: "Who can see it?", i: Lock },
];

const suggestions = ["3D Modelling", "React Development", "User Research", "Data Analysis", "Visual Design", "Game Design", "VR Development", "Technical Writing", "Project Management", "Public Speaking"];
const groups = ["Technical", "Creative", "Problem-solving", "Collaboration", "Domain"];
const evTypes = ["Project", "Work sample", "Prototype / demo", "Report / presentation", "Code repository", "Certificate"];
const fields = ["AgriTech", "FinTech", "Gaming & VR", "Climate & sustainability", "Health", "Education", "Creative industries", "Hardware"];
const seeking = ["Freelance gigs", "Internships", "Full-time roles", "Collaborations", "Mentorship", "Further learning", "Start-up co-founders"];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", on ? "border-electric bg-electric-soft text-accent-foreground" : "bg-card hover:border-electric/50")}>
      {on && <Check className="mr-1 inline h-3.5 w-3.5" />}{children}
    </button>
  );
}

function Build() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [p, setP] = useState({ name: "", headline: "", location: "", intro: "" });
  const [caps, setCaps] = useState<Cap[]>([]);
  const [capDraft, setCapDraft] = useState({ name: "", group: "Technical" });
  const [evs, setEvs] = useState<Ev[]>([]);
  const [ev, setEv] = useState<Ev>({ title: "", type: evTypes[0]!, cap: "", link: "", contribution: "" });
  const [goal, setGoal] = useState("");
  const [fieldSel, setFieldSel] = useState<string[]>([]);
  const [seekSel, setSeekSel] = useState<string[]>([]);
  const [vis, setVis] = useState<Visibility>("private");
  const [showEvidence, setShowEvidence] = useState(true);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const addCap = (name: string, group = capDraft.group) => {
    if (!name.trim() || caps.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    setCaps([...caps, { name: name.trim(), group, status: "self" }]);
    setCapDraft({ ...capDraft, name: "" });
  };
  const addEv = () => {
    if (!ev.title.trim() || !ev.cap) return;
    setEvs([...evs, ev]);
    setCaps(caps.map((c) => (c.name === ev.cap ? { ...c, status: "evidence" } : c)));
    setEv({ title: "", type: evTypes[0]!, cap: ev.cap, link: "", contribution: "" });
  };

  const canNext = [p.name.trim() && p.headline.trim(), caps.length > 0, true, true, true][step];
  const completion = Math.round(
    ([p.name, p.headline, p.location, p.intro].filter(Boolean).length / 4) * 25 +
      Math.min(caps.length / 3, 1) * 25 +
      Math.min(evs.length / 2, 1) * 30 +
      ((fieldSel.length > 0 ? 1 : 0) + (seekSel.length > 0 ? 1 : 0)) * 10,
  );
  const initials = p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  if (done) return <Done name={p.name} caps={caps} evs={evs} vis={vis} />;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/40">
      <div className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-7xl px-5 py-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Build Your MetaTwin</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Don't just tell the world. Show the evidence.</h1>
          <ol className="mt-8 grid grid-cols-5 gap-2">
            {steps.map((s, i) => (
              <li key={s.t}>
                <button disabled={i > step} onClick={() => setStep(i)} className="w-full text-left disabled:cursor-not-allowed">
                  <div className={cn("h-1 rounded-full", i <= step ? "bg-gradient-electric" : "bg-ink-foreground/15")} />
                  <p className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium sm:text-sm", i <= step ? "text-ink-foreground" : "text-ink-muted")}>
                    {i < step ? <Check className="h-3.5 w-3.5 shrink-0 text-electric" /> : <s.i className="hidden h-3.5 w-3.5 shrink-0 sm:block" />}
                    <span className="truncate">{s.t}</span>
                  </p>
                  <p className="hidden text-xs text-ink-muted md:block">{s.d}</p>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_360px]">
        <Card className="min-w-0 p-6 md:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <Head t="Create your profile" d="Establish your identity, interests, background and goals." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Victorious Kibaki" /></Field>
                <Field label="Location"><Input value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} placeholder="e.g. Nairobi, Kenya" /></Field>
              </div>
              <Field label="Headline *"><Input value={p.headline} onChange={(e) => setP({ ...p, headline: e.target.value })} placeholder="e.g. Product designer & maker · sustainable hardware" /></Field>
              <Field label="Short introduction"><Textarea rows={4} value={p.intro} onChange={(e) => setP({ ...p, intro: e.target.value })} placeholder="What drives you? How do you like to learn and build?" /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Head t="Add your capabilities" d="Start with what you can do. Every new capability begins as Self-Reported — you'll back it with evidence next." />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input value={capDraft.name} onChange={(e) => setCapDraft({ ...capDraft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addCap(capDraft.name)} placeholder="Type a capability…" />
                <select value={capDraft.group} onChange={(e) => setCapDraft({ ...capDraft, group: e.target.value })} className="h-9 rounded-md border bg-background px-3 text-sm">
                  {groups.map((g) => <option key={g}>{g}</option>)}
                </select>
                <Button onClick={() => addCap(capDraft.name)}><Plus /> Add</Button>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.filter((s) => !caps.some((c) => c.name === s)).map((s) => (
                    <button key={s} onClick={() => addCap(s)} className="rounded-full border border-dashed px-3 py-1.5 text-sm hover:border-electric hover:text-electric"><Plus className="mr-1 inline h-3 w-3" />{s}</button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2">
                {caps.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0"><p className="truncate font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.group}</p></div>
                    <div className="flex items-center gap-2"><StatusBadge status={c.status} /><button onClick={() => setCaps(caps.filter((x) => x !== c))} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>
                  </li>
                ))}
                {caps.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Add at least one capability to continue.</p>}
              </ul>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Head t="Attach your evidence" d="Connect each capability to real work. Evidence turns a claim into something people can see." />
              <div className="grid gap-4 rounded-xl border bg-muted/40 p-5 sm:grid-cols-2">
                <Field label="Evidence title"><Input value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder="e.g. Filter housing v3 model" /></Field>
                <Field label="Type">
                  <select value={ev.type} onChange={(e) => setEv({ ...ev, type: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">{evTypes.map((t) => <option key={t}>{t}</option>)}</select>
                </Field>
                <Field label="Supports capability">
                  <select value={ev.cap} onChange={(e) => setEv({ ...ev, cap: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Choose…</option>{caps.map((c) => <option key={c.name}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Link (optional)"><Input value={ev.link} onChange={(e) => setEv({ ...ev, link: e.target.value })} placeholder="Drive, GitHub, Behance…" /></Field>
                <div className="sm:col-span-2"><Field label="Your contribution"><Textarea rows={2} value={ev.contribution} onChange={(e) => setEv({ ...ev, contribution: e.target.value })} placeholder="What did you personally do? Separate it from the team's work." /></Field></div>
                <div className="sm:col-span-2"><Button onClick={addEv} disabled={!ev.title || !ev.cap}><Paperclip /> Attach evidence</Button></div>
              </div>
              <ul className="space-y-2">
                {evs.map((e, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border p-3">
                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                    <div className="min-w-0 flex-1"><p className="font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.type} · supports {e.cap}</p></div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">You can skip this and add evidence later. A <strong>Reviewed</strong> status is only given when an identified reviewer examines specific evidence.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Head t="Set your goals" d="Tell MetaTwin where you want your capabilities to take you." />
              <Field label="A development goal"><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Get my 3D Modelling evidence reviewed by a practitioner" /></Field>
              <div><Label>Fields of interest</Label><div className="mt-2 flex flex-wrap gap-2">{fields.map((f) => <Chip key={f} on={fieldSel.includes(f)} onClick={() => toggle(fieldSel, setFieldSel, f)}>{f}</Chip>)}</div></div>
              <div><Label>Open to</Label><div className="mt-2 flex flex-wrap gap-2">{seeking.map((f) => <Chip key={f} on={seekSel.includes(f)} onClick={() => toggle(seekSel, setSeekSel, f)}>{f}</Chip>)}</div></div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <Head t="Choose who can see it" d="Your MetaTwin is private by default. Nothing is public unless you decide." />
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["private", "Private", "Only you."],
                  ["link", "Share by link", "Anyone with your private link."],
                  ["network", "My network", "People you've connected with."],
                  ["public", "Public & discoverable", "Can appear in opportunity matches."],
                ] as const).map(([v, t, d]) => (
                  <button key={v} onClick={() => setVis(v)} className={cn("rounded-xl border p-4 text-left transition", vis === v ? "border-electric bg-electric-soft" : "hover:border-electric/50")}>
                    <p className="flex items-center justify-between font-medium">{t}{vis === v && <Check className="h-4 w-4 text-electric" />}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={showEvidence} onChange={(e) => setShowEvidence(e.target.checked)} className="h-4 w-4 accent-[var(--electric)]" /> Show evidence files to people who can see my profile</label>
            </div>
          )}

          <div className="mt-10 flex items-center justify-between border-t pt-6">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft /> Back</Button>
            {step < steps.length - 1 ? (
              <Button variant="hero" onClick={() => setStep(step + 1)} disabled={!canNext}>Continue <ArrowRight /></Button>
            ) : (
              <Button variant="hero" onClick={() => setDone(true)}><Sparkles /> Create my MetaTwin</Button>
            )}
          </div>
        </Card>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Live preview</p>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div className="bg-gradient-ink p-5 text-ink-foreground">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-electric font-display text-lg font-semibold">{initials}</div>
                <div className="min-w-0"><p className="truncate font-display font-semibold">{p.name || "Your name"}</p><p className="truncate text-xs text-ink-muted">{p.headline || "Your headline"}</p></div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div><div className="flex justify-between text-xs"><span className="text-muted-foreground">Profile completion</span><span className="font-mono">{completion}%</span></div><Progress value={completion} className="mt-2" /></div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Capabilities</p>
                <ul className="mt-2 space-y-1.5">
                  {caps.slice(0, 5).map((c) => <li key={c.name} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{c.name}</span><StatusBadge status={c.status} /></li>)}
                  {caps.length === 0 && <li className="text-xs text-muted-foreground">None yet</li>}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground"><FileCheck2 className="mr-1 inline h-3.5 w-3.5 text-electric" />{evs.length} evidence item{evs.length === 1 ? "" : "s"}</p>
              {fieldSel.length > 0 && <div className="flex flex-wrap gap-1">{fieldSel.map((f) => <span key={f} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{f}</span>)}</div>}
              <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Visibility: {vis}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Prototype — your entries stay in this browser tab and aren't saved.</p>
        </aside>
      </div>
    </div>
  );
}

function Head({ t, d }: { t: string; d: string }) {
  return <div><h2 className="text-2xl font-semibold">{t}</h2><p className="mt-1 text-muted-foreground">{d}</p></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Done({ name, caps, evs, vis }: { name: string; caps: Cap[]; evs: Ev[]; vis: Visibility }) {
  const counts = (Object.keys(statusMeta) as Status[]).map((s) => [s, caps.filter((c) => c.status === s).length] as const);
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-electric shadow-glow"><Check className="h-8 w-8" /></div>
        <h1 className="mt-6 text-4xl font-semibold md:text-5xl">Your MetaTwin is live, {name.split(" ")[0]}.</h1>
        <p className="mt-4 text-ink-muted">{caps.length} capabilities · {evs.length} evidence items · visibility: {vis}. Keep adding evidence as you learn and build — your record grows with you.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">{counts.map(([s, n]) => <span key={s} className="flex items-center gap-2"><StatusBadge status={s} /><span className="font-mono text-sm">{n}</span></span>)}</div>
        <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          {[
            ["Add your next project", "Document the journey, not just the result."],
            ["Request a review", "Ask a mentor or lecturer to review specific evidence."],
            ["Explore opportunities", "See where your evidence aligns."],
          ].map(([t, d]) => <div key={t} className="rounded-xl border border-ink-foreground/10 bg-ink-soft p-4"><p className="font-medium">{t}</p><p className="mt-1 text-xs text-ink-muted">{d}</p></div>)}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild variant="hero" size="lg"><Link to="/dashboard">Go to my dashboard <ArrowRight /></Link></Button>
          <Button asChild variant="heroOutline" size="lg"><Link to="/profile">See an example profile</Link></Button>
        </div>
        <p className="mt-8 text-xs text-ink-muted">Prototype — nothing has been saved.</p>
      </div>
    </div>
  );
}
