import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS, validateStudyYear } from "@/lib/limits";
import { GENDER_OPTIONS, MBTI_TYPES } from "@/lib/profile-traits";
import { HANDLE_HELP, normalizeHandle, publicProfilePath, validateHandle } from "@/lib/public-profile";
import { uploadAvatar } from "@/lib/avatar";
import { useDashboard } from "@/lib/dashboard-context";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfileTab,
});

type City = { id: string; name: string };

function MbtiCard({ twinId, mbtiType, onSaved }: { twinId: string; mbtiType: string | null; onSaved: () => void }) {
  const [code, setCode] = useState(mbtiType ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!code) {
      toast.error("Pick your MBTI type first.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("assessments").insert({ twin_id: twinId, trait_type: "mbti", trait_value: code });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("MBTI saved.");
    onSaved();
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>MBTI type</Label>
      <p className="text-xs text-muted-foreground">
        Take a test elsewhere (e.g. 16personalities.com) at your own pace, then pick your result here. Private — never shown on
        your public profile — but needed before you can go public.
      </p>
      <div className="flex gap-2">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Not taken yet</option>
          {MBTI_TYPES.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
        </select>
        <Button variant="outline" onClick={save} disabled={saving || code === mbtiType}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { twin, reload } = useDashboard();
  const [form, setForm] = useState(twin);
  const [cities, setCities] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const publicBase = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    supabase.from("kenya_cities").select("id, name").order("name").then(({ data }) => setCities((data as City[] | null) ?? []));
  }, []);

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const photo_url = await uploadAvatar(twin.id, file);
      const { error } = await supabase.from("twins").update({ photo_url }).eq("id", twin.id);
      if (error) throw new Error(error.message);
      setForm((f) => ({ ...f, photo_url }));
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function save() {
    const yearError = validateStudyYear(form.year);
    if (yearError) {
      toast.error(yearError);
      return;
    }
    const handle = normalizeHandle(form.handle ?? "");
    const isPublic = form.visibility === "public";
    if (handle || isPublic) {
      const handleError = validateHandle(handle);
      if (handleError) {
        toast.error(isPublic && !handle ? "Choose a handle to make your profile public." : handleError);
        return;
      }
    }
    if (isPublic && !form.name?.trim()) {
      toast.error("Add your name before making your profile public.");
      return;
    }
    if (isPublic && !form.mbti_type) {
      toast.error("Add your MBTI type before making your profile public.");
      return;
    }
    setSaving(true);
    // is_adult is server-controlled (declare_adult RPC) — never sent from here.
    // mbti_type is never sent from here either — it's denormalized by a trigger
    // from the student's own assessments submission (see the MBTI card below).
    const payload = {
      name: form.name,
      institution: form.institution,
      programme: form.programme,
      year: form.year,
      headline: form.headline,
      bio: form.bio,
      city_id: form.city_id,
      visibility: form.visibility,
      handle: handle || null,
      public_show_evidence_details: form.public_show_evidence_details,
      gender: form.gender,
      gender_self_described: form.gender === "self_described" ? form.gender_self_described : null,
    };
    const { error } = await supabase.from("twins").update(payload).eq("id", twin.id);
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "That handle is already taken. Try another." : error.message);
      return;
    }
    toast.success("Profile saved.");
    reload();
  }

  return (
    <Card className="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 sm:col-span-2">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
            {form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition hover:border-electric/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
            <Camera className="h-4 w-4" />
            {uploadingPhoto ? "Uploading…" : form.photo_url ? "Change photo" : "Add a photo"}
            <input type="file" accept="image/*" className="sr-only" disabled={uploadingPhoto} onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input maxLength={LIMITS.name} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Headline</Label>
          <Input maxLength={LIMITS.headline} value={form.headline ?? ""} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Institution</Label>
          <Input maxLength={LIMITS.institution} value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Programme</Label>
          <Input maxLength={LIMITS.programme} value={form.programme ?? ""} onChange={(e) => setForm({ ...form, programme: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input
            type="number"
            min={LIMITS.studyYearMin}
            max={LIMITS.studyYearMax}
            value={form.year ?? ""}
            onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <select value={form.city_id ?? ""} onChange={(e) => setForm({ ...form, city_id: e.target.value || null })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Choose a city…</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Bio</Label>
          <Textarea rows={3} maxLength={LIMITS.bio} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="What drives you? How do you like to learn and build?" />
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <select
            value={form.gender ?? ""}
            onChange={(e) => setForm({ ...form, gender: e.target.value || null })}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Prefer not to answer</option>
            {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          {form.gender === "self_described" && (
            <Input
              maxLength={LIMITS.genderSelfDescribed}
              placeholder="How would you describe it?"
              value={form.gender_self_described ?? ""}
              onChange={(e) => setForm({ ...form, gender_self_described: e.target.value })}
            />
          )}
          <p className="text-xs text-muted-foreground">Private — never shown on your public profile.</p>
        </div>
        <MbtiCard twinId={twin.id} mbtiType={twin.mbti_type} onSaved={reload} />
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4 sm:col-span-2">
          <div>
            <h4 className="font-semibold">Public profile</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Your profile is private unless you turn this on. When public, anyone with your link can view it.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-handle">Your link</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">{publicBase}/t/</span>
              <Input
                id="profile-handle"
                maxLength={30}
                value={form.handle ?? ""}
                onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })}
                placeholder="your-name"
              />
            </div>
            <p className="text-xs text-muted-foreground">{HANDLE_HELP}</p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.visibility === "public"}
              onChange={(e) => setForm({ ...form, visibility: e.target.checked ? "public" : "private" })}
            />
            <span>Make my profile public</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.public_show_evidence_details}
              onChange={(e) => setForm({ ...form, public_show_evidence_details: e.target.checked })}
            />
            <span>Also show my evidence links, evidence notes and project links</span>
          </label>
          <p className="text-xs text-muted-foreground">
            The public page shows your name, headline, institution, programme, capabilities, evidence titles and projects. It never
            shows your email, birth year, year of study, gender or MBTI type.
          </p>
          {twin.visibility === "public" && twin.handle && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-3 text-sm">
              <span className="min-w-0 truncate font-mono text-xs">{publicBase}{publicProfilePath(twin.handle)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(`${publicBase}${publicProfilePath(twin.handle!)}`)
                    .then(() => toast.success("Link copied."))
                    .catch(() => toast.error("Couldn't copy — select the link and copy it manually."));
                }}
              >
                Copy link
              </Button>
              <Button asChild type="button" variant="link" size="sm" className="px-0">
                <a href={publicProfilePath(twin.handle)} target="_blank" rel="noopener noreferrer">View public page</a>
              </Button>
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
        </div>
      </div>
    </Card>
  );
}
