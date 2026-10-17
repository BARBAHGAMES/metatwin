import { useEffect, useRef, useState } from "react";
import { MailCheck, MessageSquarePlus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FEEDBACK_LIMITS, FEEDBACK_ROLES, validateFeedback, type FeedbackInput } from "@/lib/visitor-feedback";
import { FEEDBACK_SUBMIT_PATH } from "@/lib/api-paths";
import { cn } from "@/lib/utils";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; size?: string }) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

/** Loads Cloudflare Turnstile once, on demand (only when a site key is configured). */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
  if (existing) return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }));
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.dataset.turnstile = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
}

type Errors = Partial<Record<keyof FeedbackInput | "form", string>>;

export function VisitorFeedbackButton({ handle, projectId, projectTitle, studentFirstName }: { handle: string; projectId: string; projectTitle: string; studentFirstName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="h-4 w-4" /> Give feedback on this project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {open && <FeedbackForm handle={handle} projectId={projectId} projectTitle={projectTitle} studentFirstName={studentFirstName} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeedbackForm({ handle, projectId, projectTitle, studentFirstName, onDone }: { handle: string; projectId: string; projectTitle: string; studentFirstName: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileEl.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !turnstileEl.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(turnstileEl.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => setTurnstileToken(t),
          "expired-callback": () => setTurnstileToken(null),
          size: "flexible",
        });
      })
      .catch(() => setErrors((e) => ({ ...e, form: "The security check couldn't load. Check your connection and try again." })));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: FeedbackInput = { handle, projectId, rating, comment, name, role, org, email, whatsapp, consent };
    const checked = validateFeedback(input);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrors({ form: "Please complete the security check." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch(FEEDBACK_SUBMIT_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, turnstileToken }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: Errors };
      if (!res.ok) {
        setErrors({ ...(body.fields ?? {}), form: body.error ?? "Couldn't send your feedback. Try again." });
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        setTurnstileToken(null);
        return;
      }
      setSentTo(checked.value.email);
    } catch {
      setErrors({ form: "No connection. Check your internet and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center" role="status">
        <MailCheck className="mx-auto h-10 w-10 text-electric" />
        <DialogHeader>
          <DialogTitle className="text-center">Check your email</DialogTitle>
          <DialogDescription className="text-center">
            We sent a link to <strong>{sentTo}</strong>. Tap it to confirm, and {studentFirstName} will see your feedback. The link expires in 48 hours.
          </DialogDescription>
        </DialogHeader>
        <Button className="w-full" onClick={onDone}>Done</Button>
      </div>
    );
  }

  // Clear a field's error as soon as the visitor edits it (errors otherwise linger until the next submit).
  const edit = <T,>(id: keyof FeedbackInput, set: (v: T) => void) => (v: T) => {
    set(v);
    if (errors[id] || errors.form) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        delete next.form;
        return next;
      });
    }
  };

  const field = (id: keyof FeedbackInput) => (errors[id] ? <p id={`${id}-error`} className="text-xs text-destructive">{errors[id]}</p> : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>Feedback on “{projectTitle}”</DialogTitle>
        <DialogDescription>Help {studentFirstName} improve the idea, problem or solution. Only {studentFirstName} and their school can read it.</DialogDescription>
      </DialogHeader>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">How promising is this project?</legend>
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => edit("rating", setRating)(n)}
              className="cursor-pointer rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
            >
              <Star className={cn("h-8 w-8 transition-colors", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
        {field("rating")}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="fb-comment">What would make it stronger?</Label>
        <Textarea id="fb-comment" rows={4} maxLength={FEEDBACK_LIMITS.comment} value={comment} onChange={(e) => edit("comment", setComment)(e.target.value)} aria-invalid={!!errors.comment} aria-describedby={errors.comment ? "comment-error" : undefined} />
        <div className="flex justify-between gap-2">{field("comment") ?? <span />}<span className="text-xs text-muted-foreground">{comment.length}/{FEEDBACK_LIMITS.comment}</span></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fb-name">Your name</Label>
          <Input id="fb-name" autoComplete="name" maxLength={FEEDBACK_LIMITS.name} value={name} onChange={(e) => edit("name", setName)(e.target.value)} aria-invalid={!!errors.name} />
          {field("name")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-role">You are a…</Label>
          <select id="fb-role" value={role} onChange={(e) => edit("role", setRole)(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm" aria-invalid={!!errors.role}>
            <option value="">Choose…</option>
            {FEEDBACK_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {field("role")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fb-org">Organisation <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="fb-org" autoComplete="organization" maxLength={FEEDBACK_LIMITS.org} value={org} onChange={(e) => edit("org", setOrg)(e.target.value)} />
        {field("org")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fb-whatsapp">WhatsApp number</Label>
          <Input id="fb-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={whatsapp} onChange={(e) => edit("whatsapp", setWhatsapp)(e.target.value)} aria-invalid={!!errors.whatsapp} />
          {field("whatsapp")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-email">Email</Label>
          <Input id="fb-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => edit("email", setEmail)(e.target.value)} aria-invalid={!!errors.email} />
          {field("email")}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{studentFirstName} may see my email to follow up on my feedback. <span className="text-muted-foreground">(Optional. MetaTwin may charge the student for this.)</span></span>
      </label>
      <p className="text-xs text-muted-foreground">
        Your email and WhatsApp number stay private: MetaTwin admins can see them to prevent abuse, your WhatsApp number is never shared, and both are deleted after 12 months.{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-electric underline-offset-2 hover:underline">Privacy policy</a>
      </p>

      {TURNSTILE_SITE_KEY && <div ref={turnstileEl} className="min-h-[65px]" />}
      {errors.form && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errors.form}</p>}

      <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send feedback"}
      </Button>
    </form>
  );
}
