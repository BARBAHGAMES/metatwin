import { ShieldOff } from "lucide-react";
import { Card } from "@/components/site";

// Shown instead of the dashboard/profile for an account a platform admin has
// deactivated (src/lib/platform-admin.ts's deactivateTwin). Nothing for the
// student to self-resolve here, unlike AdultGate — it's a read-only message.
export function DeactivatedGate() {
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <Card>
        <ShieldOff className="h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Your account has been deactivated</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your MetaTwin profile and public page are currently hidden, and this dashboard isn't available. If this seems wrong, contact{" "}
          <a href="mailto:andrew@metaglobetechnologies.co.ke" className="text-electric hover:underline">
            andrew@metaglobetechnologies.co.ke
          </a>
          .
        </p>
      </Card>
    </main>
  );
}
