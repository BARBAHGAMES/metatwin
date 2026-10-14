import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LIMITS } from "@/lib/limits";
import {
  fetchMySentCollaborationRequests,
  fetchOpenCollaborationProjects,
  sendCollaborationRequest,
  withdrawCollaborationRequest,
  type OpenCollaborationProject,
  type SentCollaborationRequest,
} from "@/lib/real-data";
import { Card, PageHero, Section } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadError } from "@/components/LoadError";

export const Route = createFileRoute("/pair")({
  head: () => ({
    meta: [
      { title: "Find a Co-founder · MetaTwin" },
      { name: "description", content: "Solo students with an idea at the Idea stage can find each other and pair up to form a team." },
    ],
  }),
  component: PairPage,
});

function PairPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  if (authLoading || !user) return <main className="p-16 text-center text-muted-foreground">Loading...</main>;
  return <Pair userId={user.id} />;
}

function Pair({ userId }: { userId: string }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [open, setOpen] = useState<OpenCollaborationProject[]>([]);
  const [sent, setSent] = useState<SentCollaborationRequest[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [requestTarget, setRequestTarget] = useState<OpenCollaborationProject | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    Promise.all([fetchOpenCollaborationProjects(), fetchMySentCollaborationRequests()])
      .then(([o, s]) => {
        if (cancelled) return;
        setOpen(o);
        setSent(s);
        setState("ready");
      })
      .catch((e) => {
        console.error("[pair] load failed:", e);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;
  if (state === "loading") return <main className="p-16 text-center text-muted-foreground">Loading...</main>;

  const sentProjectIds = new Set(sent.filter((r) => r.status === "pending").map((r) => r.project_id));

  async function sendRequest() {
    if (!requestTarget) return;
    setSending(true);
    try {
      await sendCollaborationRequest({
        requesterTwinId: userId,
        projectId: requestTarget.project_id,
        ownerTwinId: requestTarget.owner_twin_id,
        message,
      });
      toast.success("Request sent.");
      setRequestTarget(null);
      setMessage("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that request.");
    } finally {
      setSending(false);
    }
  }

  async function withdraw(id: string) {
    try {
      await withdrawCollaborationRequest(id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not withdraw that request.");
    }
  }

  return (
    <>
      <PageHero eyebrow="Pairing" title="Find a co-founder">
        Solo at the Idea stage? Browse other students with an idea who are open to pairing up, or check the status of requests you've sent.
      </PageHero>
      <Section className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><Users className="h-5 w-5" /> Open ideas</h2>
          {open.length === 0 ? (
            <Card className="mt-5 border-dashed"><p className="text-sm text-muted-foreground">No one's open to pairing right now. Check back later.</p></Card>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {open.map((p) => {
                const pending = sentProjectIds.has(p.project_id);
                return (
                  <li key={p.project_id}>
                    <Card className="h-full">
                      <p className="font-display font-semibold">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.owner_name ?? p.owner_handle}{p.owner_institution ? ` · ${p.owner_institution}` : ""}</p>
                      {p.problem_statement && <p className="mt-2 text-sm text-muted-foreground">{p.problem_statement}</p>}
                      <Button
                        variant={pending ? "outline" : "hero"}
                        className="mt-3 w-full"
                        disabled={pending}
                        onClick={() => {
                          setRequestTarget(p);
                          setMessage("");
                        }}
                      >
                        {pending ? "Request sent" : "Request to pair"}
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> My requests</h3>
          {sent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">You haven't sent any pairing requests yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sent.map((r) => (
                <li key={r.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.project_title}</p>
                      <p className="text-xs text-muted-foreground">{r.owner_name ?? r.owner_handle} · {r.status}</p>
                    </div>
                    {r.status === "pending" && (
                      <button onClick={() => withdraw(r.id)} aria-label="Withdraw" className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            Have an idea of your own? <Link to="/dashboard" className="text-electric hover:underline">Turn on "Open to being paired"</Link> on your project.
          </p>
        </aside>
      </Section>

      <Dialog open={!!requestTarget} onOpenChange={(o) => !o && setRequestTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request to pair on "{requestTarget?.title}"</DialogTitle></DialogHeader>
          <Textarea
            rows={3}
            maxLength={LIMITS.collaborationRequestMessage}
            placeholder="Say a bit about why you'd be a good fit (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <DialogFooter><Button onClick={sendRequest} disabled={sending}>{sending ? "Sending…" : "Send request"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
