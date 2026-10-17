import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchMySchoolAdminStatus, fetchMyInstitutionGrades, type SchoolAdminStatus, type InstitutionGrade } from "@/lib/school-admin";
import { Card, PageHero, Section } from "@/components/site";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/LoadError";
import { Stars } from "@/components/VisitorFeedbackCard";
import { fetchInstitutionFeedback, type InstitutionFeedback } from "@/lib/project-feedback";
import { feedbackRoleLabel } from "@/lib/visitor-feedback";

export const Route = createFileRoute("/school/dashboard")({
  head: () => ({ meta: [{ title: "School admin dashboard · MetaTwin" }] }),
  component: SchoolDashboardPage,
});

const RATING_COLORS: Record<string, string> = {
  "Exceeds Expectation": "bg-electric-soft text-accent-foreground",
  "Meets Expectation": "bg-muted text-foreground",
  "Approaches Expectation": "bg-muted text-muted-foreground",
  "Below Expectation": "bg-destructive/10 text-destructive",
};

function formatDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SchoolDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [status, setStatus] = useState<SchoolAdminStatus | null>(null);
  const [grades, setGrades] = useState<InstitutionGrade[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/school/login" });
      return;
    }
    let cancelled = false;
    setState("loading");
    fetchMySchoolAdminStatus(user.id)
      .then(async (s) => {
        if (cancelled) return;
        setStatus(s);
        if (s?.status === "verified") {
          const g = await fetchMyInstitutionGrades();
          if (!cancelled) setGrades(g);
        }
        if (!cancelled) setState("ready");
      })
      .catch((err) => {
        console.error("[school dashboard] load failed:", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  if (authLoading || state === "loading") {
    return <div className="p-16 text-center text-muted-foreground" role="status">Loading...</div>;
  }
  if (state === "error") return <LoadError onRetry={() => setState("loading")} />;

  if (!status) {
    return (
      <Section className="mx-auto max-w-md text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">This account isn't registered as a school admin</h1>
        <p className="mt-2 text-muted-foreground">If you're MKU staff, request access with your university email.</p>
        <Button asChild variant="hero" className="mt-6"><Link to="/school/signup">Request access</Link></Button>
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
            ? "We'll email you once MetaTwin has verified your university affiliation."
            : "Your request wasn't approved. Contact andrew@metaglobetechnologies.co.ke if you think this is a mistake."}
        </p>
      </Section>
    );
  }

  return (
    <>
      <PageHero eyebrow="School admin" title={`Welcome, ${status.full_name.split(" ")[0]}`}>
        <p>Grades submitted for your campus via the academic grading Google Form.</p>
      </PageHero>
      <Section>
        {grades.length === 0 ? (
          <Card className="border-dashed"><p className="text-sm text-muted-foreground">No grades submitted yet.</p></Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {grades.map((g) => (
              <li key={g.id}>
                <Card className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display font-semibold">{g.project_title}</p>
                      <p className="truncate text-xs text-muted-foreground">{g.student_name ?? g.student_handle ?? "Student"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${RATING_COLORS[g.rating_label] ?? "bg-muted"}`}>
                      {g.rating_label} ({g.rating_score}/4)
                    </span>
                  </div>
                  {g.comment && <p className="mt-2 text-sm text-muted-foreground">"{g.comment}"</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(g.graded_at)}{g.grader_name && ` · ${g.grader_name}`}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section className="pt-0">
        <InstitutionFeedbackList />
      </Section>
    </>
  );
}

// Visitor feedback on your students' projects (no reviewer contact details;
// feedback a student hid or reported is not shown).
function InstitutionFeedbackList() {
  const [items, setItems] = useState<InstitutionFeedback[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetchInstitutionFeedback().then(setItems).catch(() => setFailed(true));
  }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold">Student project feedback</h2>
      <p className="mt-1 text-sm text-muted-foreground">From people visiting your students' public MetaTwins.</p>
      {failed ? (
        <p className="mt-4 text-sm text-destructive">Couldn't load feedback. Refresh to try again.</p>
      ) : items === null ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="mt-4 border-dashed"><p className="text-sm text-muted-foreground">No visitor feedback on your students' projects yet.</p></Card>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((f) => (
            <li key={f.id}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold">{f.project_title}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.student_name ?? f.student_handle ?? "Student"}</p>
                  </div>
                  <Stars value={f.rating} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">"{f.comment}"</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(f.confirmed_at ?? "")} · {f.reviewer_name} · {feedbackRoleLabel(f.reviewer_role)}{f.reviewer_org ? ` · ${f.reviewer_org}` : ""}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
