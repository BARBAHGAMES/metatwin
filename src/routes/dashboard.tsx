import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import heroImg from "@/assets/hero-dashboard.jpg";
import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HeroBackdrop, Section } from "@/components/site";
import { AdultGate } from "@/components/AdultGate";
import { DeactivatedGate } from "@/components/DeactivatedGate";
import { PaywallGate } from "@/components/PaywallGate";
import { hasActivePlan, fetchHasTeamPlanAccess } from "@/lib/plan";
import { LoadError } from "@/components/LoadError";
import { publicProfilePath } from "@/lib/public-profile";
import { DashboardContext, type DashboardTwin } from "@/lib/dashboard-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My MetaTwin · Dashboard" },
      { name: "description", content: "Manage your MetaTwin: profile, projects, courses, skills, AI team and opportunities." },
    ],
  }),
  component: DashboardLayout,
});

const TABS = [
  { to: "/dashboard", label: "Overview" },
  { to: "/dashboard/profile", label: "Profile" },
  { to: "/dashboard/projects", label: "Projects" },
  { to: "/dashboard/courses", label: "Courses" },
  { to: "/dashboard/skills", label: "Skills" },
  { to: "/dashboard/ai-team", label: "AI team" },
  { to: "/dashboard/opportunities", label: "Opportunities" },
] as const;

const TWIN_SELECT =
  "id, name, first_name, institution, programme, year, headline, bio, city_id, visibility, is_adult, is_active, plan_status, plan_paid_until, handle, public_show_evidence_details, photo_url, gender, gender_self_described, mbti_type";

function emptyTwin(userId: string): DashboardTwin {
  return {
    id: userId,
    name: null,
    first_name: null,
    institution: null,
    programme: null,
    year: null,
    headline: null,
    bio: null,
    city_id: null,
    visibility: "private",
    is_adult: false,
    is_active: true,
    plan_status: "unpaid",
    plan_paid_until: null,
    handle: null,
    public_show_evidence_details: false,
    photo_url: null,
    gender: null,
    gender_self_described: null,
    mbti_type: null,
  };
}

function DashboardLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [twin, setTwin] = useState<DashboardTwin | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [teamPlanAccess, setTeamPlanAccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  async function loadTwin(userId: string) {
    fetchHasTeamPlanAccess().then(setTeamPlanAccess);
    const { data, error } = await supabase.from("twins").select(TWIN_SELECT).eq("id", userId).maybeSingle();
    if (error) {
      console.error("[dashboard] load twin failed:", error.message);
      setLoadError(true);
      setFetching(false);
      return;
    }
    setLoadError(false);
    setTwin((data as DashboardTwin | null) ?? emptyTwin(userId));
    setFetching(false);
  }

  useEffect(() => {
    if (user) loadTwin(user.id);
  }, [user]);

  if (loadError) {
    return (
      <LoadError
        onRetry={() => {
          if (!user) return;
          setFetching(true);
          loadTwin(user.id);
        }}
      />
    );
  }

  if (authLoading || fetching || !twin) {
    return <main className="p-16 text-center text-muted-foreground">Loading...</main>;
  }

  if (!twin.is_active) return <DeactivatedGate />;
  if (!twin.is_adult) return <AdultGate onDeclared={() => user && loadTwin(user.id)} />;
  if (!hasActivePlan(twin) && !teamPlanAccess) return <PaywallGate onPaid={() => user && loadTwin(user.id)} />;

  if (!twin.first_name) {
    navigate({ to: "/build" });
    return <main className="p-16 text-center text-muted-foreground">Taking you to set up your MetaTwin…</main>;
  }

  const publicUrl = twin.visibility === "public" && twin.handle ? publicProfilePath(twin.handle) : null;

  return (
    <div className="bg-muted/40">
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop image={heroImg} />
        <div className="relative mx-auto max-w-7xl px-5 py-10 md:py-12">
          <div className="hero-rise flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Owner dashboard</p>
              <h1 className="mt-2 text-2xl font-bold md:text-3xl">Hi{twin.name ? ` ${twin.name.split(" ")[0]}` : ""}.</h1>
            </div>
            <div className="flex items-center gap-2">
              {publicUrl ? (
                <Button asChild variant="heroOutline" size="sm">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">View public MetaTwin <ExternalLink className="h-3.5 w-3.5" /></a>
                </Button>
              ) : (
                <Button asChild variant="heroOutline" size="sm">
                  <Link to="/dashboard/profile">Publish your MetaTwin <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              )}
            </div>
          </div>
          <nav className="hero-rise-delay-1 mt-6 flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const active = t.to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm transition",
                    active ? "bg-ink-foreground/15 text-ink-foreground" : "text-ink-muted hover:text-ink-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>
      <Section className="py-10 md:py-12">
        <DashboardContext.Provider value={{ userId: twin.id, twin, reload: () => loadTwin(twin.id) }}>
          <Outlet />
        </DashboardContext.Provider>
      </Section>
    </div>
  );
}
