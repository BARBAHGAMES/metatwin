import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, HeroBackdrop } from "@/components/site";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password · MetaTwin" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { passwordRecovery } = useAuth();
  return (
    <div className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-md flex-col justify-center px-5 py-16">
        <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">Account</p>
        <h1 className="hero-rise-delay-1 mt-3 text-3xl font-semibold">
          {passwordRecovery ? "Choose a new password" : "Reset your password"}
        </h1>
        <Card className="hero-rise-delay-2 mt-8 bg-card/95 text-foreground backdrop-blur-sm">
          {passwordRecovery ? <NewPasswordForm /> : <RequestResetForm />}
        </Card>
        <p className="mt-6 text-center text-sm text-ink-muted">
          <Link to="/login" className="text-electric">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}

function RequestResetForm() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const error = await resetPassword(email);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    // Same message whether or not the address has an account (no enumeration).
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm" role="status">
        If an account exists for that email, we've sent a link to reset your password. Check your inbox (and spam).
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email">Email</Label>
        <Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
        {submitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}

function NewPasswordForm() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const err = await updatePassword(password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success("Password updated.");
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
        {submitting ? "Saving..." : "Update password"}
      </Button>
    </form>
  );
}
