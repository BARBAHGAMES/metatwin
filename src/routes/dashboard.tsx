import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import heroImg from "@/assets/hero-dashboard.jpg";
import { useEffect, useRef, useState } from "react";
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
  const tabsRef = useRef<HTMLElement>(null);

  // Keep the active tab visible in the swipeable phone tab row. Adjusts only
  // the row's own horizontal scroll, never the page's vertical position.
  useEffect(() => {
    const nav = tabsRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const left = active.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft || left + active.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = left - 20;
    }
  }, [location.pathname, twin]);

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
    if (!data) {
      // Every student gets a twins row at signup (handle_new_user), so no row
      // usually means a school or platform admin account. Send them to their
      // own dashboard instead of the student 18+ gate, which they can never
      // pass (declare_adult has no twins row to update).
      const [{ data: platformAdmin }, { data: schoolAdmin }] = await Promise.all([
        supabase.from("platform_admins").select("id").eq("id", userId).maybeSingle(),
        supabase.from("school_admins").select("id").eq("id", userId).maybeSingle(),
      ]);
      if (platformAdmin) return void navigate({ to: "/admin/dashboard", replace: true });
      if (schoolAdmin) return void navigate({ to: "/school/dashboard", replace: true });
    }
    setLoadError(false);
    setTwin((data as DashboardTwin | null) ?? emptyTwin(userId));
    setFetching(false);
  }

  useEffect(() => {
    if (user) loadTwin(user.id);
  }, [user]);

  const needsOnboarding = !!twin && twin.is_active && twin.is_adult && (hasActivePlan(twin) || teamPlanAccess) && !twin.first_name;
  useEffect(() => {
    // Redirect from an effect, not during render (React warns on state
    // updates in another component's render, and it can double-fire).
    if (needsOnboarding) navigate({ to: "/build", replace: true });
  }, [needsOnboarding, navigate]);

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
    return <div className="p-16 text-center text-muted-foreground" role="status">Loading...</div>;
  }

  if (!twin.is_active) return <DeactivatedGate />;
  if (!twin.is_adult) return <AdultGate onDeclared={() => user && loadTwin(user.id)} />;
  if (!hasActivePlan(twin) && !teamPlanAccess) return <PaywallGate onPaid={() => user && loadTwin(user.id)} />;

  if (needsOnboarding) {
    return <div className="p-16 text-center text-muted-foreground" role="status">Taking you to set up your MetaTwin…</div>;
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
          {/* Phones: one swipeable row (seven pills wrapped to three rows at 360px).
              md+: wraps as before. */}
          <nav
            ref={tabsRef}
            aria-label="Dashboard sections"
            className="hero-rise-delay-1 -mx-5 mt-6 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((t) => {
              const active = t.to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  // Exact match for Overview: by default TanStack marks /dashboard
                  // active (and aria-current="page") on every /dashboard/* tab.
                  activeOptions={{ exact: t.to === "/dashboard" }}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition md:px-3.5 md:py-1.5",
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
