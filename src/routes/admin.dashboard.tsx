import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Clock, Users, UserCheck, FolderGit2, ShieldOff, ShieldHalf } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchMyPlatformAdminStatus,
  fetchAdminDashboardData,
  deactivateTwin,
  reactivateTwin,
  type PlatformAdminStatus,
  type AdminDashboardRow,
} from "@/lib/platform-admin";
import { Card, PageHero, Section } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadError } from "@/components/LoadError";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Platform admin dashboard · MetaTwin" }] }),
  component: AdminDashboardPage,
});

function formatDateTime(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Monday of the week containing d, as an ISO date string — used to bucket
// signups without a date-bucketing SQL function (pilot scale, computed
// client-side from the one dataset get_admin_dashboard_data already returns).
function weekStart(d: Date): string {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [status, setStatus] = useState<PlatformAdminStatus | null>(null);
  const [rows, setRows] = useState<AdminDashboardRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminDashboardRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/admin/login" });
      return;
    }
    let cancelled = false;
    setState("loading");
    fetchMyPlatformAdminStatus(user.id)
      .then(async (s) => {
        if (cancelled) return;
        setStatus(s);
        if (s?.status === "verified") {
          const data = await fetchAdminDashboardData();
          if (!cancelled) setRows(data);
        }
        if (!cancelled) setState("ready");
      })
      .catch((err) => {
        console.error("[admin dashboard] load failed:", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate, reloadKey]);

  const funnel = useMemo(() => {
    const total = rows.length;
    const withCapability = rows.filter((r) => r.capability_count > 0).length;
    const withEvidence = rows.filter((r) => r.evidence_count > 0).length;
    const withPublicProfile = rows.filter((r) => r.has_public_profile).length;
    return { total, withCapability, withEvidence, withPublicProfile };
  }, [rows]);

  const trend = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const key = weekStart(new Date(r.created_at));
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(1, ...sorted.map(([, n]) => n));
    return { sorted, max };
  }, [rows]);

  async function handleToggleActive(row: AdminDashboardRow) {
    setBusyId(row.id);
    try {
      if (row.is_active) {
        await deactivateTwin(row.id);
        toast.success(`${row.name ?? "That profile"} has been deactivated.`);
      } else {
        await reactivateTwin(row.id);
        toast.success(`${row.name ?? "That profile"} has been reactivated.`);
      }
      setConfirmTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || state === "loading") {
    return <main className="p-16 text-center text-muted-foreground">Loading...</main>;
  }
  if (state === "error") return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />;

  if (!status) {
    return (
      <Section className="mx-auto max-w-md text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">This account isn't registered as a platform admin</h1>
        <p className="mt-2 text-muted-foreground">Admin access is invite-only.</p>
      </Section>
    );
  }

  if (status.status !== "verified") {
    return (
      <Section className="mx-auto max-w-md text-center">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">{status.status === "pending" ? "Pending verification" : "Access not approved"}</h1>
        <p className="mt-2 text-muted-foreground">
          {status.status === "pending"
            ? "This is verified by hand — give it a moment."
            : "Your request wasn't approved."}
        </p>
      </Section>
    );
  }

  return (
    <>
      <PageHero eyebrow="Platform admin" title={`Welcome, ${status.full_name.split(" ")[0]}`}>
        <p>Onboarding activity across every MetaTwin student account.</p>
      </PageHero>
      <Section className="space-y-10">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="text-center">
            <Users className="mx-auto h-5 w-5 text-electric" />
            <p className="mt-2 text-2xl font-semibold">{funnel.total}</p>
            <p className="text-xs text-muted-foreground">Total signups</p>
          </Card>
          <Card className="text-center">
            <ShieldHalf className="mx-auto h-5 w-5 text-electric" />
            <p className="mt-2 text-2xl font-semibold">{funnel.total ? Math.round((funnel.withCapability / funnel.total) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">Added a capability</p>
          </Card>
          <Card className="text-center">
            <FolderGit2 className="mx-auto h-5 w-5 text-electric" />
            <p className="mt-2 text-2xl font-semibold">{funnel.total ? Math.round((funnel.withEvidence / funnel.total) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">Added evidence</p>
          </Card>
          <Card className="text-center">
            <UserCheck className="mx-auto h-5 w-5 text-electric" />
            <p className="mt-2 text-2xl font-semibold">{funnel.total ? Math.round((funnel.withPublicProfile / funnel.total) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">Went public</p>
          </Card>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">Signups by week</h2>
          {trend.sorted.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No signups yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {trend.sorted.map(([week, n]) => (
                <li key={week} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{formatDateTime(week)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-gradient-electric" style={{ width: `${(n / trend.max) * 100}%` }} />
                  </span>
                  <span className="w-6 shrink-0 text-right font-mono text-xs">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">Recent signups</h2>
          {rows.length === 0 ? (
            <Card className="mt-3 border-dashed"><p className="text-sm text-muted-foreground">No students yet.</p></Card>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Signed up</th>
                    <th className="py-2 pr-3">Confirmed</th>
                    <th className="py-2 pr-3">18+</th>
                    <th className="py-2 pr-3">Caps / Evidence / Projects</th>
                    <th className="py-2 pr-3">Public</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`border-b last:border-0 ${!r.is_active ? "opacity-60" : ""}`}>
                      <td className="py-2 pr-3">{r.name ?? "—"}</td>
                      <td className="py-2 pr-3">{r.email}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDateTime(r.created_at)}</td>
                      <td className="py-2 pr-3">{r.email_confirmed_at ? "Yes" : "No"}</td>
                      <td className="py-2 pr-3">{r.is_adult ? "Yes" : "No"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{r.capability_count} / {r.evidence_count} / {r.project_count}</td>
                      <td className="py-2 pr-3">{r.has_public_profile ? "Yes" : "No"}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.is_active ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"}`}>
                          {r.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <Button
                          size="sm"
                          variant={r.is_active ? "outline" : "secondary"}
                          onClick={() => (r.is_active ? setConfirmTarget(r) : handleToggleActive(r))}
                          disabled={busyId === r.id}
                        >
                          {r.is_active ? <><ShieldOff className="h-3.5 w-3.5" /> Deactivate</> : <><ShieldCheck className="h-3.5 w-3.5" /> Reactivate</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      <Dialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate {confirmTarget?.name ?? "this profile"}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Their public page and dashboard become unavailable immediately. Nothing is deleted — their capabilities, evidence and projects
            stay exactly as they are, and you can reactivate the account at any time from this same screen.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmTarget && handleToggleActive(confirmTarget)} disabled={busyId === confirmTarget?.id}>
              {busyId === confirmTarget?.id ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
