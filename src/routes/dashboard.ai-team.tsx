import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/site";
import { AiEmployeesCard } from "@/components/AiEmployeesCard";
import { useDashboard } from "@/lib/dashboard-context";

export const Route = createFileRoute("/dashboard/ai-team")({
  component: AiTeamTab,
});

function AiTeamTab() {
  const { userId } = useDashboard();
  return (
    <Card>
      <AiEmployeesCard userId={userId} />
    </Card>
  );
}
