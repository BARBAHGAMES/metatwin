import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, HeroBackdrop } from "@/components/site";
import { OAuthButtons } from "@/components/OAuthButtons";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Log in · MetaTwin" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const error = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-16">
        <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">Welcome back</p>
        <h1 className="hero-rise-delay-1 mt-3 text-3xl font-semibold">Log in to your MetaTwin</h1>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <p className="text-right text-sm"><Link to="/reset-password" className="text-electric">Forgot password?</Link></p>
            <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
              {submitting ? "Logging in..." : <>Log in <ArrowRight /></>}
            </Button>
          </form>
          <div className="mt-5"><OAuthButtons /></div>
        </Card>
        <p className="mt-6 text-center text-sm text-ink-muted">
          New to MetaTwin? <Link to="/signup" className="text-electric">Build your MetaTwin</Link>
        </p>
      </div>
    </div>
  );
}
