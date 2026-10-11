import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { validateBirthYear } from "@/lib/adult";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, HeroBackdrop } from "@/components/site";
import { OAuthButtons } from "@/components/OAuthButtons";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Build Your MetaTwin · Sign up" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const age = validateBirthYear(birthYear);
    if ("error" in age) {
      setAgeError(age.error);
      return;
    }
    if (!confirmedAdult) {
      setAgeError("Please confirm you are 18 or older.");
      return;
    }
    setAgeError(null);
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/login`;
    const result = await signUp(email, password, age.year, redirectTo);
    setSubmitting(false);
    switch (result.outcome) {
      case "error":
        toast.error(result.message);
        return;
      case "already_registered":
        toast.info("That email already has an account — try logging in instead.");
        navigate({ to: "/login" });
        return;
      case "signed_in":
        navigate({ to: "/dashboard" });
        return;
      case "confirm":
        toast.success("Check your email to confirm your account.");
        navigate({ to: "/login" });
        return;
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-16">
        <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">Get started</p>
        <h1 className="hero-rise-delay-1 mt-3 text-3xl font-semibold">Build your MetaTwin</h1>
        <p className="hero-rise-delay-1 mt-2 text-ink-muted">Create your account — you'll start documenting capabilities and evidence from your dashboard.</p>
        <Card className="hero-rise-delay-2 mt-8 bg-card/95 text-foreground backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birth-year">Year of birth</Label>
              <Input
                id="birth-year"
                type="number"
                inputMode="numeric"
                required
                min={1900}
                max={new Date().getFullYear()}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="e.g. 2003"
              />
              <p className="text-xs text-muted-foreground">We store only your birth year, not your full date of birth.</p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmedAdult}
                onChange={(e) => setConfirmedAdult(e.target.checked)}
              />
              <span>I confirm I am 18 or older. MetaTwin is for students aged 18+ for now.</span>
            </label>
            {ageError && <p role="alert" className="text-sm text-destructive">{ageError}</p>}
            <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
              {submitting ? "Creating account..." : <>Create my MetaTwin <Sparkles /></>}
            </Button>
          </form>
          <div className="mt-5"><OAuthButtons /></div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Signing up with Google or GitHub skips the form above — you'll confirm your age in one quick step after.</p>
        </Card>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have a MetaTwin? <Link to="/login" className="text-electric">Log in</Link>
        </p>
      </div>
    </div>
  );
}
