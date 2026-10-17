import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart3, EyeOff, Flag, MessageSquareText, Star, Eye } from "lucide-react";
import { Card } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { feedbackRoleLabel } from "@/lib/visitor-feedback";
import { supabase } from "@/integrations/supabase/client";
import { publicProfilePath } from "@/lib/public-profile";
import {
  aboutEarlierVersion,
  averageRating,
  fetchMyDeckViews,
  fetchMyProjectFeedback,
  type DeckViews,
  markFeedbackSeen,
  reportProjectFeedback,
  setProjectFeedbackHidden,
  type MyProjectFeedback,
} from "@/lib/project-feedback";

export function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} aria-hidden />
      ))}
    </span>
  );
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Owner-only panel on /projects/$id: feedback from visitors to the student's public MetaTwin. */
export function VisitorFeedbackCard({
  projectId,
  twinId,
  current,
}: {
  projectId: string;
  twinId: string;
  current: { problem_statement: string | null; proposed_solution: string | null };
}) {
  const [publicProfileUrl, setPublicProfileUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from("twins")
      .select("handle, visibility")
      .eq("id", twinId)
      .maybeSingle()
      .then(({ data }) => setPublicProfileUrl(data?.visibility === "public" && data.handle ? publicProfilePath(data.handle) : null));
  }, [twinId]);
  const [items, setItems] = useState<MyProjectFeedback[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [reporting, setReporting] = useState<MyProjectFeedback | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setItems(await fetchMyProjectFeedback(projectId));
      setFailed(false);
      markFeedbackSeen();
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function toggleHidden(f: MyProjectFeedback) {
    try {
      await setProjectFeedbackHidden(f.id, !f.hidden_by_owner);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update that feedback.");
    }
  }

  async function submitReport() {
    if (!reporting) return;
    setBusy(true);
    try {
      await reportProjectFeedback(reporting.id, reason);
      toast.success("Reported. MetaTwin will review it, and it's hidden from your list.");
      setReporting(null);
      setReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't report that feedback.");
    } finally {
      setBusy(false);
    }
  }

  const visible = (items ?? []).filter((f) => !f.hidden_by_owner);
  const hidden = (items ?? []).filter((f) => f.hidden_by_owner);
  const avg = averageRating(visible);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-4 w-4" /> Visitor feedback</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">From people visiting your public MetaTwin. Only you and your school can see it.</p>
        </div>
        {avg != null && (
          <div className="text-right">
            <Stars value={avg} />
            <p className="text-xs text-muted-foreground">{avg.toFixed(1)} from {visible.length} {visible.length === 1 ? "person" : "people"}</p>
          </div>
        )}
      </div>

      {failed ? (
        <p className="mt-3 text-sm text-destructive">Couldn't load feedback. <button type="button" className="underline" onClick={load}>Try again</button></p>
      ) : items === null ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">Loading…</p>
      ) : visible.length === 0 && hidden.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">All feedback on this project is hidden. You can unhide it below.</p>
      ) : visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No visitor feedback yet. Anyone viewing your public MetaTwin can rate this project
          {publicProfileUrl ? (
            <>: <a href={publicProfileUrl} target="_blank" rel="noopener noreferrer" className="text-electric hover:underline">share your link</a> to get some.</>
          ) : (
            ". Make your profile public (Dashboard → Profile) to start getting feedback."
          )}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((f) => (
            <FeedbackItem key={f.id} f={f} earlier={aboutEarlierVersion(f.snapshot, current)} onToggleHidden={() => toggleHidden(f)} onReport={() => setReporting(f)} />
          ))}
        </ul>
      )}

      {hidden.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? "Hide" : "Show"} hidden feedback ({hidden.length})
          </button>
          {showHidden && (
            <ul className="mt-3 space-y-3 opacity-70">
              {hidden.map((f) => (
                <FeedbackItem key={f.id} f={f} earlier={aboutEarlierVersion(f.snapshot, current)} onToggleHidden={() => toggleHidden(f)} />
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={!!reporting} onOpenChange={(o) => !o && setReporting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this feedback</DialogTitle>
            <DialogDescription>It will be hidden from your list and reviewed by MetaTwin. You can't edit or delete feedback yourself.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} maxLength={300} placeholder="What's wrong with it? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="destructive" onClick={submitReport} disabled={busy}>{busy ? "Reporting…" : "Report"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FeedbackItem({ f, earlier, onToggleHidden, onReport }: { f: MyProjectFeedback; earlier: boolean; onToggleHidden: () => void; onReport?: () => void }) {
  return (
    <li className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars value={f.rating} />
        <span className="text-xs text-muted-foreground">{formatDay(f.confirmed_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{f.comment}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {f.reviewer_name} · {feedbackRoleLabel(f.reviewer_role)}{f.reviewer_org ? ` · ${f.reviewer_org}` : ""}
      </p>
      {earlier && <p className="mt-2 inline-block rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">About an earlier version of your problem/solution</p>}
      {f.reported_at && <p className="mt-2 text-xs text-muted-foreground">Reported to MetaTwin</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={onToggleHidden}>
          {f.hidden_by_owner ? <><Eye className="h-3.5 w-3.5" /> Unhide</> : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}
        </Button>
        {onReport && !f.reported_at && (
          <Button size="sm" variant="ghost" onClick={onReport}><Flag className="h-3.5 w-3.5" /> Report</Button>
        )}
      </div>
    </li>
  );
}

const COUNTRY_NAMES: Record<string, string> = { KE: "Kenya", UG: "Uganda", TZ: "Tanzania", RW: "Rwanda", ET: "Ethiopia", NG: "Nigeria", ZA: "South Africa", GH: "Ghana", US: "USA", GB: "UK", IN: "India", AE: "UAE" };

/** Owner-only: how many people opened the pitch deck on the public MetaTwin (counts, never visitors). */
export function DeckViewsCard({ projectId, hasDeck }: { projectId: string; hasDeck: boolean }) {
  const [views, setViews] = useState<DeckViews | null | undefined>(undefined);
  useEffect(() => {
    if (!hasDeck) return;
    fetchMyDeckViews(projectId).then(setViews).catch(() => setViews(null));
  }, [projectId, hasDeck]);
  if (!hasDeck) return null;
  return (
    <Card>
      <h3 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" /> Who's seen your pitch</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Times visitors opened your deck on MetaTwin (once per person per day). Views elsewhere aren't counted.</p>
      {views === undefined ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">Loading…</p>
      ) : !views || views.total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No views yet. Share your public MetaTwin link when you pitch.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <div><p className="font-display text-3xl font-semibold">{views.total}</p><p className="text-xs text-muted-foreground">total views</p></div>
          <div><p className="font-display text-3xl font-semibold">{views.last_7_days}</p><p className="text-xs text-muted-foreground">last 7 days</p></div>
          {views.countries.length > 0 && (
            <p className="text-xs text-muted-foreground">
              From {views.countries.map((c) => `${COUNTRY_NAMES[c.country] ?? c.country} (${c.views})`).join(", ")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
