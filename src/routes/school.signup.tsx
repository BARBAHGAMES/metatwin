import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";
import { isValidSchoolAdminEmail, fetchMkuCampuses, MKU_EMAIL_DOMAIN, type MyCampus } from "@/lib/school-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, HeroBackdrop } from "@/components/site";

export const Route = createFileRoute("/school/signup")({
  head: () => ({
    meta: [{ title: "School admin sign up · MetaTwin" }],
  }),
  component: SchoolSignupPage,
});

function SchoolSignupPage() {
  const { signUpSchoolAdmin } = useAuth();
  const navigate = useNavigate();
  const [campuses, setCampuses] = useState<MyCampus[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchMkuCampuses()
      .then((rows) => {
        setCampuses(rows);
        if (rows[0]) setUniversityId((prev) => prev || rows[0]!.id);
      })
      .catch(() => setCampuses([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSchoolAdminEmail(email)) {
      setEmailError(`Use your Mount Kenya University email (ends in @${MKU_EMAIL_DOMAIN}).`);
      return;
    }
    if (!universityId) {
      toast.error("Select your campus.");
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/school/login`;
    const result = await signUpSchoolAdmin(email, password, { fullName, phone, universityId }, redirectTo);
    setSubmitting(false);
    switch (result.outcome) {
      case "error":
        toast.error(result.message);
        return;
      case "already_registered":
        toast.info("That email already has an account — try logging in instead.");
        navigate({ to: "/school/login" });
        return;
      case "signed_in":
      case "confirm":
        setDone(true);
        return;
    }
  }

  if (done) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-16 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-electric" />
          <h1 className="mt-4 text-2xl font-semibold">Thanks — you're on the list</h1>
          <p className="mt-2 text-ink-muted">We'll verify your university affiliation and email you once your account is active. This is a manual check, so it may take a day or two.</p>
          <Button asChild variant="hero" className="mt-6"><Link to="/">Back to MetaTwin</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-16">
        <p className="hero-rise flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-electric"><GraduationCap className="h-3.5 w-3.5" /> School admin</p>
        <h1 className="hero-rise-delay-1 mt-3 text-3xl font-semibold">Grade your students' projects</h1>
        <p className="hero-rise-delay-1 mt-2 text-ink-muted">For Mount Kenya University staff. We verify every account by hand before it can see any student data.</p>
        <Card className="hero-rise-delay-2 mt-8 bg-card/95 text-foreground backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">University email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${MKU_EMAIL_DOMAIN}`} />
              {emailError && <p role="alert" className="text-sm text-destructive">{emailError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7xx xxx xxx" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campus">Campus</Label>
              <select
                id="campus"
                required
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Request access"}
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already verified? <Link to="/school/login" className="text-electric">Log in</Link>
        </p>
      </div>
    </div>
  );
}
