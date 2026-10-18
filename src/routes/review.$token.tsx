import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeHref } from "@/lib/url";
import { LIMITS } from "@/lib/limits";
import { Card, HeroBackdrop, Section } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type ReviewInvite = {
  evidence_title: string;
  evidence_note: string | null;
  evidence_link: string | null;
  reviewer_name: string;
  twin_name: string | null;
  already_submitted: boolean;
  expired: boolean;
};

export const Route = createFileRoute("/review/$token")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.rpc("get_review_invite", { p_token: params.token });
    if (error) throw new Error(error.message);
    const invite = (data as ReviewInvite[] | null)?.[0];
    if (!invite) throw notFound();
    return { invite, token: params.token };
  },
  head: () => ({
    meta: [
      { title: "Review a MetaTwin · MetaTwin" },
      { name: "description", content: "Review a specific piece of evidence a student has shared with you." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewPage,
  notFoundComponent: ReviewNotFound,
  errorComponent: ReviewError,
});

function ReviewError() {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">We couldn't load this review link</h1>
      <p className="mt-3 text-sm text-muted-foreground">Something went wrong on our side. Please try again in a moment.</p>
      <Button className="mt-6" onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}

function ReviewNotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">This review link isn't valid</h1>
      <p className="mt-3 text-sm text-muted-foreground">Double-check the link the student sent you, or ask them to send a new one.</p>
      <Button asChild variant="hero" className="mt-6"><Link to="/">Back to MetaTwin</Link></Button>
    </div>
  );
}

function ReviewPage() {
  const { invite, token } = Route.useLoaderData() as { invite: ReviewInvite; token: string };
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(invite.already_submitted);

  async function submit() {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_evidence_review", {
      p_token: token,
      p_comment: (comment.trim() || null) as string,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error("This review link is no longer valid — it may have expired or already been used.");
      return;
    }
    setSubmitted(true);
  }

  const href = safeHref(invite.evidence_link);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-2xl px-5 py-14 md:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Review request</p>
          <h1 className="mt-4 text-3xl font-semibold md:text-4xl">
            {invite.twin_name ?? "A student"} asked you to review their work
          </h1>
          <p className="mt-3 text-ink-muted">Hi {invite.reviewer_name} — take a look at the specific evidence below and leave a short note. No account needed.</p>
        </div>
      </section>

      <Section className="max-w-2xl">
        <Card>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><FileCheck2 className="h-4 w-4 text-electric" /> Evidence</p>
          <p className="mt-2 font-display text-xl font-semibold">{invite.evidence_title}</p>
          {invite.evidence_note && <p className="mt-2 text-sm text-muted-foreground">{invite.evidence_note}</p>}
          {href && <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block text-sm text-electric hover:underline">Open the evidence</a>}
        </Card>

        <Card className="mt-5">
          {submitted ? (
            <div className="text-center">
              <p className="font-semibold">Thanks — your review has been recorded.</p>
              <p className="mt-2 text-sm text-muted-foreground">{invite.twin_name ?? "The student"} will see it on their MetaTwin.</p>
            </div>
          ) : invite.expired ? (
            <div className="text-center">
              <p className="font-semibold">This review link has expired.</p>
              <p className="mt-2 text-sm text-muted-foreground">Ask {invite.twin_name ?? "the student"} to send you a new one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="review-comment">Your comment (optional)</Label>
                <Textarea
                  id="review-comment"
                  rows={4}
                  maxLength={LIMITS.evidenceNote}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What stands out about this work? Any feedback on quality, rigor or presentation?"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Submitting marks this specific piece of evidence as reviewed by you. Your name and comment will be shown next to it.
              </p>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit review"}</Button>
            </div>
          )}
        </Card>
      </Section>
    </>
  );
}
