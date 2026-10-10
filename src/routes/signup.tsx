import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, HeroBackdrop } from "@/components/site";

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
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/login`;
    const result = await signUp(email, password, redirectTo);
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
              {submitting ? "Creating account..." : <>Create my MetaTwin <Sparkles /></>}
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have a MetaTwin? <Link to="/login" className="text-electric">Log in</Link>
        </p>
      </div>
    </div>
  );
}
