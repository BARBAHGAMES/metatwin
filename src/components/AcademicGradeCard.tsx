import { GraduationCap } from "lucide-react";
import type { MyProjectGrade } from "@/lib/school-admin";
import { Card } from "@/components/site";

const RATING_COLORS: Record<string, string> = {
  "Exceeds Expectation": "bg-electric-soft text-accent-foreground",
  "Meets Expectation": "bg-muted text-foreground",
  "Approaches Expectation": "bg-muted text-muted-foreground",
  "Below Expectation": "bg-destructive/10 text-destructive",
};

function formatDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Read-only — the grade itself arrives only via the lecturer's Google Form,
// never editable here.
export function AcademicGradeCard({ grade }: { grade: MyProjectGrade | null }) {
  if (!grade) return null;
  return (
    <Card>
      <h3 className="flex items-center gap-2 font-semibold"><GraduationCap className="h-4 w-4" /> Academic grade</h3>
      <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${RATING_COLORS[grade.rating_label] ?? "bg-muted"}`}>
        {grade.rating_label} ({grade.rating_score}/4)
      </span>
      {grade.comment && <p className="mt-3 text-sm text-muted-foreground">"{grade.comment}"</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        {formatDate(grade.graded_at)}{grade.grader_name && ` · ${grade.grader_name}`}
      </p>
    </Card>
  );
}
