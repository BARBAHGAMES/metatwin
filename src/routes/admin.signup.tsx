import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, HeroBackdrop } from "@/components/site";

export const Route = createFileRoute("/admin/signup")({
  head: () => ({
    meta: [{ title: "Platform admin sign up · MetaTwin" }],
  }),
  component: AdminSignupPage,
});

// Invite-only — the email allowlist lives server-side in handle_new_user(),
// not here. This page exists so the one allowlisted account can actually
// create its login; nothing else enforces who reaches it.
function AdminSignupPage() {
  const { signUpPlatformAdmin } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/admin/login`;
    const result = await signUpPlatformAdmin(email, password, { fullName }, redirectTo);
    setSubmitting(false);
    switch (result.outcome) {
      case "error":
        toast.error(result.message);
        return;
      case "already_registered":
        toast.info("That email already has an account — try logging in instead.");
        return;
      case "signed_in":
      case "confirm":
        setDone(true);
        return;
    }
  }

  if (done) {
    return (
      <div className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-md flex-col justify-center px-5 py-16 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-electric" />
          <h1 className="mt-4 text-2xl font-semibold">Thanks — you're on the list</h1>
          <p className="mt-2 text-ink-muted">This is manually verified, so give it a moment. Once it's verified, log in and you'll land on the admin dashboard.</p>
          <Button asChild variant="hero" className="mt-6"><Link to="/">Back to MetaTwin</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-md flex-col justify-center px-5 py-16">
        <p className="hero-rise flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-electric"><ShieldCheck className="h-3.5 w-3.5" /> Platform admin</p>
        <h1 className="hero-rise-delay-1 mt-3 text-3xl font-semibold">Request admin access</h1>
        <p className="hero-rise-delay-1 mt-2 text-ink-muted">Invite-only, verified by hand before it can see any student data.</p>
        <Card className="hero-rise-delay-2 mt-8 bg-card/95 text-foreground backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
          Already verified? <Link to="/admin/login" className="text-electric">Log in</Link>
        </p>
      </div>
    </div>
  );
}
