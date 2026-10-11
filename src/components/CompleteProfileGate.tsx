import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LIMITS } from "@/lib/limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/site";

type City = { id: string; name: string };
type University = { id: string; name: string; location: string | null };
type EducationStatus = "in_university" | "graduated_university" | "in_school" | "in_program";

const EDUCATION_OPTIONS: { value: EducationStatus; label: string }[] = [
  { value: "in_university", label: "Currently in university" },
  { value: "graduated_university", label: "Graduated from university" },
  { value: "in_school", label: "In school (not yet in university)" },
  { value: "in_program", label: "In an upskilling / training program" },
];

// Shown once after AdultGate, for any account missing the basics (first_name
// is the "completed" flag — simplest single field to check).
export function CompleteProfileGate({ twinId, onCompleted }: { twinId: string; onCompleted: () => void }) {
  const [cities, setCities] = useState<City[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cityId, setCityId] = useState("");
  const [educationStatus, setEducationStatus] = useState<EducationStatus>("in_university");
  const [universityId, setUniversityId] = useState("");
  const [institution, setInstitution] = useState(""); // school name or program name, when not a university pick
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [citiesRes, universitiesRes] = await Promise.all([
        supabase.from("kenya_cities").select("id, name").order("name"),
        supabase.from("universities").select("id, name, location").order("name"),
      ]);
      if (cancelled) return;
      setCities((citiesRes.data as City[] | null) ?? []);
      // Mount Kenya University pinned first, per product requirement; the rest alphabetical.
      const sortedUniversities = ((universitiesRes.data as University[] | null) ?? []).sort((a, b) => {
        const aFirst = a.name === "Mount Kenya University";
        const bFirst = b.name === "Mount Kenya University";
        if (aFirst !== bFirst) return aFirst ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setUniversities(sortedUniversities);
      setLoadingLists(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isUniversityStatus = educationStatus === "in_university" || educationStatus === "graduated_university";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!cityId) {
      setError("Choose your location.");
      return;
    }
    if (isUniversityStatus && !universityId) {
      setError("Choose your university.");
      return;
    }
    if (!isUniversityStatus && !institution.trim()) {
      setError(educationStatus === "in_school" ? "Enter your school's name." : "Enter the program's name.");
      return;
    }
    setError(null);
    setSaving(true);

    const selectedUniversity = universities.find((u) => u.id === universityId);
    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      city_id: cityId,
      education_status: educationStatus,
      university_id: isUniversityStatus ? universityId : null,
      institution: isUniversityStatus ? (selectedUniversity?.name ?? null) : institution.trim(),
      headline: headline.trim() || null,
      bio: bio.trim() || null,
    };

    const { error: updateError } = await supabase.from("twins").update(payload).eq("id", twinId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Profile saved.");
    onCompleted();
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <Card>
        <h1 className="text-2xl font-semibold">Tell us about you</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A few details to build out your MetaTwin. You can refine all of this later from your dashboard.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="first-name">First name</Label>
              <Input id="first-name" maxLength={LIMITS.firstName} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last-name">Last name</Label>
              <Input id="last-name" maxLength={LIMITS.lastName} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city-select">Location</Label>
            <select
              id="city-select"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              disabled={loadingLists}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Choose a city…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Education</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {EDUCATION_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="education-status"
                    value={opt.value}
                    checked={educationStatus === opt.value}
                    onChange={() => setEducationStatus(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {isUniversityStatus ? (
            <div className="space-y-1.5">
              <Label htmlFor="university-select">University</Label>
              <select
                id="university-select"
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                disabled={loadingLists}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Choose your university…</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.location ? ` — ${u.location}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="institution-text">{educationStatus === "in_school" ? "School name" : "Program name"}</Label>
              <Input
                id="institution-text"
                maxLength={LIMITS.institution}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder={educationStatus === "in_school" ? "e.g. Alliance High School" : "e.g. Moringa School, ALX"}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline (your career choice)</Label>
            <Input id="headline" maxLength={LIMITS.headline} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Aspiring Software Engineer" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">A short description of who you are</Label>
            <Textarea id="bio" maxLength={LIMITS.bio} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving || loadingLists} className="w-full">
            {saving ? "Saving..." : "Continue"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
