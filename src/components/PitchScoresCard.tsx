import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { fetchMyPitchScores, type MyPitchScore } from "@/lib/pitch-scores";
import { Card } from "@/components/site";

function formatDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ScoreRow({ score }: { score: MyPitchScore }) {
  return (
    <li className="rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {score.competition_name}
          {score.round_name && <span className="text-muted-foreground"> · {score.round_name}</span>}
        </p>
        <p className="text-sm text-muted-foreground">{formatDate(score.event_date)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-display text-lg font-semibold">{score.total_score}/100</span>
        <span className="text-xs text-muted-foreground">
          Problem {score.problem_score} · Solution {score.solution_score} · Team {score.team_score} · Ask {score.ask_score}
        </span>
      </div>
      {score.judge_comment && <p className="mt-2 text-sm text-muted-foreground">"{score.judge_comment}"{score.judge_name && <span> — {score.judge_name}</span>}</p>}
    </li>
  );
}

export function PitchScoresCard() {
  const [scores, setScores] = useState<MyPitchScore[] | undefined>(undefined);

  useEffect(() => {
    fetchMyPitchScores().then(setScores).catch(() => setScores([]));
  }, []);

  if (scores !== undefined && scores.length === 0) return null;

  return (
    <Card className="mt-5">
      <h3 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4" /> Pitch competition scores</h3>
      {scores === undefined ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {scores.map((s) => <ScoreRow key={s.id} score={s} />)}
        </ul>
      )}
    </Card>
  );
}
