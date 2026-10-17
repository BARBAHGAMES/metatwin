import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/site";
import { FEEDBACK_CONFIRM_PATH } from "@/lib/api-paths";
import { CONFIRM_TOKEN_PATTERN } from "@/lib/visitor-feedback";

// Landing page for the link in the "Confirm your feedback" email. Confirmation
// needs a tap (a POST), never a page load: email link scanners and mail-app
// previews open links automatically and must not confirm on the reviewer's behalf.
export const Route = createFileRoute("/feedback/confirm/$token")({
  head: () => ({ meta: [{ title: "Confirm your feedback · MetaTwin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ConfirmFeedbackPage,
});

type Result = { status: "confirmed"; handle?: string; project_title?: string } | { status: "expired" | "invalid" | "error" | "rate_limited" };

function ConfirmFeedbackPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"idle" | "sending" | Result["status"]>(CONFIRM_TOKEN_PATTERN.test(token) ? "idle" : "invalid");
  const [result, setResult] = useState<Result | null>(null);

  async function confirm() {
    setState("sending");
    try {
      const res = await fetch(FEEDBACK_CONFIRM_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const body = (await res.json().catch(() => ({ status: "error" }))) as Result;
      setResult(body);
      setState(body.status);
    } catch {
      setState("error");
    }
  }

  return (
    <Section className="py-16">
      <Card className="mx-auto max-w-md text-center">
        {state === "idle" || state === "sending" ? (
          <>
            <h1 className="text-2xl font-semibold">Confirm your feedback</h1>
            <p className="mt-2 text-sm text-muted-foreground">Tap below and the student will be able to read what you wrote.</p>
            <Button variant="hero" className="mt-6 w-full" onClick={confirm} disabled={state === "sending"}>
              {state === "sending" ? "Confirming…" : "Confirm my feedback"}
            </Button>
          </>
        ) : state === "confirmed" ? (
          <div role="status">
            <CheckCircle2 className="mx-auto h-10 w-10 text-status-evidence" />
            <h1 className="mt-3 text-2xl font-semibold">Thank you!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your feedback{result && "project_title" in result && result.project_title ? <> on <strong>{result.project_title}</strong></> : null} is now with the student.
            </p>
            {result && "handle" in result && result.handle && (
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link to="/t/$handle" params={{ handle: result.handle }}>Back to their MetaTwin</Link>
              </Button>
            )}
          </div>
        ) : state === "expired" ? (
          <div role="alert">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-3 text-2xl font-semibold">This link has expired</h1>
            <p className="mt-2 text-sm text-muted-foreground">Confirmation links last 48 hours. Open the student's MetaTwin and send your feedback again.</p>
          </div>
        ) : (
          <div role="alert">
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-3 text-2xl font-semibold">{state === "invalid" ? "This link isn't valid" : "Something went wrong"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state === "invalid"
                ? "It may have been used already: each link confirms once. If your feedback was confirmed, there's nothing more to do."
                : "Please try the link again in a moment."}
            </p>
            {state !== "invalid" && <Button variant="outline" className="mt-6 w-full" onClick={confirm}>Try again</Button>}
          </div>
        )}
      </Card>
    </Section>
  );
}
