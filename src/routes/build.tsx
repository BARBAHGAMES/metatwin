import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-build.jpg";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, Check, FileCheck2, GraduationCap, Lock, Plus, School, Sparkles, Trash2, UserRound, Layers, Paperclip, Target, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, HeroBackdrop, StatusBadge } from "@/components/site";
import type { Status } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LIMITS } from "@/lib/limits";
import { isHttpUrl } from "@/lib/url";
import { uploadAvatar } from "@/lib/avatar";
import { HANDLE_HELP, normalizeHandle, validateHandle } from "@/lib/public-profile";
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

type City = { id: string; name: string };
type University = { id: string; name: string; location: string | null };
type Skill = { id: string; name: string; category: string | null };
type EducationStatus = "in_university" | "graduated_university" | "in_school" | "in_program";
type Cap = { skillId: string; name: string };
type Ev = { title: string; type: string; capSkillId: string; link: string; contribution: string };
type Visibility = "private" | "public";

const steps = [
  { t: "Profile", d: "Who are you?", i: UserRound },
  { t: "Capabilities", d: "What can you do?", i: Layers },
  { t: "Evidence", d: "Can you show it?", i: Paperclip },
  { t: "Goals", d: "Where can it take you?", i: Target },
  { t: "Privacy", d: "Who can see it?", i: Lock },
];

const EDUCATION_OPTIONS: { value: EducationStatus; label: string; hint: string; icon: typeof GraduationCap }[] = [
  { value: "in_university", label: "University student", hint: "Working toward a degree or diploma", icon: GraduationCap },
  { value: "graduated_university", label: "Graduated", hint: "Already have your degree or diploma", icon: FileCheck2 },
  { value: "in_school", label: "High school student", hint: "Form 1–4 or equivalent", icon: School },
  { value: "in_program", label: "Upskilling program", hint: "Bootcamp, academy or short course", icon: Sparkles },
];

const evTypes = ["Project", "Work sample", "Prototype / demo", "Report / presentation", "Code repository", "Certificate"];
const fields = ["AgriTech", "FinTech", "Gaming & VR", "Climate & sustainability", "Health", "Education", "Creative industries", "Hardware"];
const seeking = ["Freelance gigs", "Internships", "Full-time roles", "Collaborations", "Mentorship", "Further learning", "Start-up co-founders"];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2", on ? "border-electric bg-electric-soft text-accent-foreground" : "bg-card hover:border-electric/50 motion-safe:hover:-translate-y-0.5")}>
      {on && <Check className="mr-1 inline h-3.5 w-3.5" />}{children}
    </button>
  );
}

function Build() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reference data (public-read, fetched regardless of sign-in state).
  const [cities, setCities] = useState<City[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Step 0: Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cityId, setCityId] = useState("");
  const [educationStatus, setEducationStatus] = useState<EducationStatus>("in_university");
  const [universityId, setUniversityId] = useState("");
  const [institution, setInstitution] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Step 1: Capabilities
  const [caps, setCaps] = useState<Cap[]>([]);
  const [capabilitySkillId, setCapabilitySkillId] = useState("");

  // Step 2: Evidence
  const [evs, setEvs] = useState<Ev[]>([]);
  const [ev, setEv] = useState<Ev>({ title: "", type: evTypes[0]!, capSkillId: "", link: "", contribution: "" });

  // Step 3: Goals
  const [developmentGoal, setDevelopmentGoal] = useState("");
  const [fieldSel, setFieldSel] = useState<string[]>([]);
  const [seekSel, setSeekSel] = useState<string[]>([]);

  // Step 4: Privacy
  const [vis, setVis] = useState<Visibility>("private");
  const [handle, setHandle] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [citiesRes, universitiesRes, skillsRes] = await Promise.all([
        supabase.from("kenya_cities").select("id, name").order("name"),
        supabase.from("universities").select("id, name, location").order("name"),
        supabase.from("skills").select("id, name, category").order("name"),
      ]);
      if (cancelled) return;
      setCities((citiesRes.data as City[] | null) ?? []);
      const sortedUniversities = ((universitiesRes.data as University[] | null) ?? []).sort((a, b) => {
        const aFirst = a.name === "Mount Kenya University";
        const bFirst = b.name === "Mount Kenya University";
        if (aFirst !== bFirst) return aFirst ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setUniversities(sortedUniversities);
      setSkills((skillsRes.data as Skill[] | null) ?? []);
      setLoadingLists(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isUniversityStatus = educationStatus === "in_university" || educationStatus === "graduated_university";

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const handlePhotoChange = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      setPhotoUrl(await uploadAvatar(user.id, file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addCap = () => {
    if (!capabilitySkillId || caps.some((c) => c.skillId === capabilitySkillId)) return;
    const skill = skills.find((s) => s.id === capabilitySkillId);
    if (!skill) return;
    setCaps([...caps, { skillId: skill.id, name: skill.name }]);
    setCapabilitySkillId("");
  };
  const addEv = () => {
    if (!ev.title.trim() || !ev.capSkillId) return;
    if (ev.link.trim() && !isHttpUrl(ev.link.trim())) {
      toast.error("Links must start with http:// or https:// and contain no spaces.");
      return;
    }
    setEvs([...evs, ev]);
    setEv({ title: "", type: evTypes[0]!, capSkillId: ev.capSkillId, link: "", contribution: "" });
  };

  const profileValid = firstName.trim() && lastName.trim() && cityId && (isUniversityStatus ? universityId : institution.trim());
  const canNext = [profileValid, caps.length > 0, true, true, true][step];

  const completion = Math.round(
    ([firstName, lastName, headline, bio].filter(Boolean).length / 4) * 20 +
      Math.min(caps.length / 3, 1) * 25 +
      Math.min(evs.length / 2, 1) * 30 +
      ((developmentGoal.trim() ? 1 : 0) + (fieldSel.length > 0 ? 1 : 0) + (seekSel.length > 0 ? 1 : 0)) * (25 / 3),
  );
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";

  async function handleFinish() {
    if (!user) {
      setDone(true);
      return;
    }
    const normalizedHandle = normalizeHandle(handle);
    if (vis === "public") {
      const handleError = validateHandle(normalizedHandle);
      if (handleError) {
        toast.error(handleError);
        setStep(4);
        return;
      }
    }
    setSubmitting(true);

    const selectedUniversity = universities.find((u) => u.id === universityId);
    const twinPayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      city_id: cityId || null,
      education_status: educationStatus,
      university_id: isUniversityStatus ? universityId || null : null,
      institution: isUniversityStatus ? (selectedUniversity?.name ?? null) : institution.trim() || null,
      headline: headline.trim() || null,
      bio: bio.trim() || null,
      photo_url: photoUrl,
      development_goal: developmentGoal.trim() || null,
      fields_of_interest: fieldSel.length ? fieldSel : null,
      seeking: seekSel.length ? seekSel : null,
      visibility: vis,
      handle: vis === "public" ? normalizedHandle : null,
    };

    const { error: twinError } = await supabase.from("twins").update(twinPayload).eq("id", user.id);
    if (twinError) {
      setSubmitting(false);
      toast.error(twinError.code === "23505" ? "That handle is already taken. Try another." : twinError.message);
      return;
    }

    const skillIdToCompetencyId = new Map<string, string>();
    for (const cap of caps) {
      const { data, error } = await supabase.from("competencies").insert({ twin_id: user.id, skill_id: cap.skillId, level: 1 }).select("id").single();
      if (error) {
        setSubmitting(false);
        toast.error(error.message);
        return;
      }
      skillIdToCompetencyId.set(cap.skillId, data.id);
    }

    for (const item of evs) {
      const competencyId = skillIdToCompetencyId.get(item.capSkillId);
      if (!competencyId) continue;
      const link = item.link.trim();
      const { error } = await supabase.from("evidence").insert({
        twin_id: user.id,
        competency_id: competencyId,
        title: item.title.trim(),
        evidence_type: item.type || null,
        link: link && isHttpUrl(link) ? link : null,
        note: item.contribution.trim() || null,
      });
      if (error) {
        setSubmitting(false);
        toast.error(error.message);
        return;
      }
    }

    setSubmitting(false);
    setDone(true);
  }

  if (done) return <Done firstName={firstName} caps={caps} evs={evs} vis={vis} />;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/40">
      <div className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop image={heroImg} />
        <div className="relative mx-auto max-w-7xl px-5 py-10">
          <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">Build Your MetaTwin</p>
          <h1 className="hero-rise-delay-1 mt-3 text-3xl font-semibold md:text-4xl">Don't just tell the world. Show the evidence.</h1>
          <p className="mt-6 text-xs font-medium text-ink-muted sm:hidden">
            Step {step + 1} of {steps.length} · <span className="text-ink-foreground">{steps[step]!.t}</span>
          </p>
          <ol className="mt-2 grid grid-cols-5 gap-2 sm:mt-8">
            {steps.map((s, i) => (
              <li key={s.t}>
                <button disabled={i > step} onClick={() => setStep(i)} className="w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 disabled:cursor-not-allowed">
                  <div className={cn("h-1 rounded-full", i <= step ? "bg-gradient-electric" : "bg-ink-foreground/15")} />
                  <p className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium sm:text-sm", i <= step ? "text-ink-foreground" : "text-ink-muted")}>
                    {i < step ? <Check className="h-3.5 w-3.5 shrink-0 text-electric" /> : <s.i className="hidden h-3.5 w-3.5 shrink-0 sm:block" />}
                    <span className="hidden truncate sm:inline">{s.t}</span>
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
              <Head t="Create your profile" d="Establish your identity, background and goals." />
              {user && (
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition hover:border-electric/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                    <Camera className="h-4 w-4" />
                    {uploadingPhoto ? "Uploading…" : photoUrl ? "Change photo" : "Add a photo"}
                    <input type="file" accept="image/*" className="sr-only" disabled={uploadingPhoto} onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
                  </label>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name *"><Input maxLength={LIMITS.firstName} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Victorious" /></Field>
                <Field label="Last name *"><Input maxLength={LIMITS.lastName} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Kibaki" /></Field>
              </div>
              <Field label="Location *">
                <select value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={loadingLists} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Choose a city…</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <div className="space-y-2">
                <Label>Education</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EDUCATION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = educationStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEducationStatus(opt.value)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2",
                          selected ? "border-electric bg-electric-soft ring-1 ring-electric" : "hover:border-electric/50",
                        )}
                      >
                        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-electric" : "text-muted-foreground")} />
                        <span>
                          <span className="block text-sm font-medium">{opt.label}</span>
                          <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {isUniversityStatus ? (
                <Field label="University *">
                  <select value={universityId} onChange={(e) => setUniversityId(e.target.value)} disabled={loadingLists} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Choose your university…</option>
                    {universities.map((u) => <option key={u.id} value={u.id}>{u.name}{u.location ? ` — ${u.location}` : ""}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label={educationStatus === "in_school" ? "School name *" : "Program name *"}>
                  <Input
                    maxLength={LIMITS.institution}
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder={educationStatus === "in_school" ? "e.g. Alliance High School" : "e.g. Moringa School, ALX"}
                  />
                </Field>
              )}

              <Field label="Headline (your career choice)"><Input maxLength={LIMITS.headline} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Aspiring Software Engineer" /></Field>
              <Field label="A short description of who you are"><Textarea rows={4} maxLength={LIMITS.bio} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What drives you? How do you like to learn and build?" /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Head t="Add your capabilities" d="Pick what you can do from the list below. Every new capability begins as Self-Reported — you'll back it with evidence next." />
              <div className="flex flex-col gap-3 sm:flex-row">
                <select value={capabilitySkillId} onChange={(e) => setCapabilitySkillId(e.target.value)} disabled={loadingLists} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Choose a skill…</option>
                  {skills.filter((s) => !caps.some((c) => c.skillId === s.id)).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.category ? ` — ${s.category}` : ""}</option>
                  ))}
                </select>
                <Button onClick={addCap} disabled={!capabilitySkillId}><Plus /> Add</Button>
              </div>
              <ul className="space-y-2">
                {caps.map((c) => (
                  <li key={c.skillId} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <p className="min-w-0 truncate font-medium">{c.name}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status="self" />
                      <button onClick={() => setCaps(caps.filter((x) => x.skillId !== c.skillId))} aria-label="Remove" className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Trash2 className="h-4 w-4" /></button>
                    </div>
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
                <Field label="Evidence title"><Input maxLength={LIMITS.evidenceTitle} value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder="e.g. Filter housing v3 model" /></Field>
                <Field label="Type">
                  <select value={ev.type} onChange={(e) => setEv({ ...ev, type: e.target.value })} className="h-11 w-full rounded-md border bg-background px-3 text-sm">{evTypes.map((t) => <option key={t}>{t}</option>)}</select>
                </Field>
                <Field label="Supports capability">
                  <select value={ev.capSkillId} onChange={(e) => setEv({ ...ev, capSkillId: e.target.value })} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Choose…</option>{caps.map((c) => <option key={c.skillId} value={c.skillId}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Link (optional)">
                  <Input value={ev.link} onChange={(e) => setEv({ ...ev, link: e.target.value })} placeholder="Paste a link to a Google Doc, Drive file, GitHub repo…" />
                </Field>
                <div className="sm:col-span-2"><Field label="Your contribution"><Textarea rows={2} maxLength={LIMITS.evidenceNote} value={ev.contribution} onChange={(e) => setEv({ ...ev, contribution: e.target.value })} placeholder="What did you personally do? Separate it from the team's work." /></Field></div>
                <div className="sm:col-span-2"><Button onClick={addEv} disabled={!ev.title.trim() || !ev.capSkillId}><Paperclip /> Attach evidence</Button></div>
              </div>
              <ul className="space-y-2">
                {evs.map((e, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border p-3">
                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                    <div className="min-w-0 flex-1"><p className="font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.type} · supports {caps.find((c) => c.skillId === e.capSkillId)?.name}</p></div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">You can skip this and add evidence later. A <strong>Reviewed</strong> status only appears once an identified reviewer looks at specific evidence.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Head t="Set your goals" d="Tell MetaTwin where you want your capabilities to take you." />
              <Field label="A development goal"><Input maxLength={LIMITS.developmentGoal} value={developmentGoal} onChange={(e) => setDevelopmentGoal(e.target.value)} placeholder="e.g. Get my 3D Modelling evidence reviewed by a practitioner" /></Field>
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
                  ["public", "Public & shareable", "Anyone with your link can view it."],
                ] as const).map(([v, t, d]) => (
                  <button key={v} onClick={() => setVis(v)} className={cn("cursor-pointer rounded-xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2", vis === v ? "border-electric bg-electric-soft" : "hover:border-electric/50 motion-safe:hover:-translate-y-0.5")}>
                    <p className="flex items-center justify-between font-medium">{t}{vis === v && <Check className="h-4 w-4 text-electric" />}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                  </button>
                ))}
              </div>
              {vis === "public" && (
                <Field label="Your link">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm text-muted-foreground">metatwin.metaglobetechnologies.co.ke/t/</span>
                    <Input maxLength={30} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="your-name" />
                  </div>
                  <p className="text-xs text-muted-foreground">{HANDLE_HELP}</p>
                </Field>
              )}
            </div>
          )}

          <div className="mt-10 flex items-center justify-between border-t pt-6">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft /> Back</Button>
            {step < steps.length - 1 ? (
              <Button variant="hero" onClick={() => setStep(step + 1)} disabled={!canNext}>Continue <ArrowRight /></Button>
            ) : (
              <Button variant="hero" onClick={handleFinish} disabled={submitting}><Sparkles /> {submitting ? "Saving…" : user ? "Create my MetaTwin" : "Preview my MetaTwin"}</Button>
            )}
          </div>
        </Card>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Live preview</p>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div className="bg-gradient-ink p-5 text-ink-foreground">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-electric font-display text-lg font-semibold">{initials}</div>
                <div className="min-w-0"><p className="truncate font-display font-semibold">{firstName || lastName ? `${firstName} ${lastName}`.trim() : "Your name"}</p><p className="truncate text-xs text-ink-muted">{headline || "Your headline"}</p></div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div><div className="flex justify-between text-xs"><span className="text-muted-foreground">Profile completion</span><span className="font-mono">{completion}%</span></div><Progress value={completion} className="mt-2" /></div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Capabilities</p>
                <ul className="mt-2 space-y-1.5">
                  {caps.slice(0, 5).map((c) => <li key={c.skillId} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{c.name}</span><StatusBadge status="self" /></li>)}
                  {caps.length === 0 && <li className="text-xs text-muted-foreground">None yet</li>}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground"><FileCheck2 className="mr-1 inline h-3.5 w-3.5 text-electric" />{evs.length} evidence item{evs.length === 1 ? "" : "s"}</p>
              {fieldSel.length > 0 && <div className="flex flex-wrap gap-1">{fieldSel.map((f) => <span key={f} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{f}</span>)}</div>}
              <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Visibility: {vis}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{user ? "Signed in — this will be saved as your real MetaTwin when you finish." : "Not signed in — this stays a preview until you create an account."}</p>
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

function Done({ firstName, caps, evs, vis }: { firstName: string; caps: Cap[]; evs: Ev[]; vis: Visibility }) {
  const { user } = useAuth();
  const counts: [Status, number][] = [
    ["self", caps.length],
    ["evidence", evs.length > 0 ? Math.min(evs.length, caps.length) : 0],
    ["reviewed", 0],
  ];
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop image={heroImg} />
      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center">
        <div className="pop-in mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-electric shadow-glow"><Check className="h-8 w-8" /></div>
        <h1 className="hero-rise mt-6 text-4xl font-semibold md:text-5xl">
          {user
            ? `Your MetaTwin is live, ${firstName.trim() || "there"}.`
            : firstName.trim()
              ? `Here's your MetaTwin preview, ${firstName.trim()}.`
              : "Here's your MetaTwin preview."}
        </h1>
        <p className="hero-rise-delay-1 mt-4 text-ink-muted">
          {caps.length} capabilities · {evs.length} evidence items · visibility: {vis}.{" "}
          {user ? "Keep adding evidence as you learn and build — your record grows with you." : "This is what your record could look like once you add real evidence."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">{counts.map(([s, n]) => <span key={s} className="flex items-center gap-2"><StatusBadge status={s} /><span className="font-mono text-sm">{n}</span></span>)}</div>
        <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          {[
            ["Add your next project", "Document the journey, not just the result."],
            ["Request a review", "Invite a mentor or lecturer to review specific evidence."],
            ["Explore opportunities", "See where your evidence aligns."],
          ].map(([t, d]) => <div key={t} className="rounded-xl border border-ink-foreground/10 bg-ink-soft p-4"><p className="font-medium">{t}</p><p className="mt-1 text-xs text-ink-muted">{d}</p></div>)}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {user ? (
            <Button asChild variant="hero" size="lg"><Link to="/dashboard">Go to my dashboard <ArrowRight /></Link></Button>
          ) : (
            <>
              <Button asChild variant="hero" size="lg"><Link to="/signup">Create my account to save it <ArrowRight /></Link></Button>
              <Button asChild variant="heroOutline" size="lg"><Link to="/login">I already have an account</Link></Button>
            </>
          )}
        </div>
        <p className="mt-8 text-xs text-ink-muted">
          {user ? "Everything above has been saved to your real MetaTwin." : "This was a preview — nothing has been saved and no account was created. Create a free account to build your real MetaTwin."}
        </p>
      </div>
    </div>
  );
}
