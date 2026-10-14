import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { individualPlans } from "@/lib/pricing";
import { useMpesaPayment } from "@/lib/useMpesaPayment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/site";
import { cn } from "@/lib/utils";

// Shown instead of the dashboard/profile for a signed-in account with no
// active plan (never paid, or a lapsed one). Mirrors AdultGate's shell;
// unlike AdultGate this has an async multi-step flow (initiate the STK
// push, then poll for the result) since the actual payment confirmation
// comes from Safaricom's own callback, not this request/response — see
// useMpesaPayment, shared with the team-lead "upgrade team" flow.
export function PaywallGate({ onPaid }: { onPaid: () => void }) {
  const [tier, setTier] = useState<(typeof individualPlans)[number]["id"]>("basic");
  const [phone, setPhone] = useState("");
  const { stage, error, pay } = useMpesaPayment(onPaid);

  const selected = individualPlans.find((p) => p.id === tier)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await pay(phone, { kind: "individual", tier });
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <Card>
        <ShieldCheck className="h-8 w-8 text-electric" />
        <h1 className="mt-4 text-2xl font-semibold">Unlock your MetaTwin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a plan to get your full profile, capabilities, projects, evidence, and public page.
        </p>
        {stage === "waiting" ? (
          <div className="mt-5 space-y-2 text-sm">
            <p className="font-medium">Check your phone</p>
            <p className="text-muted-foreground">Enter your M-Pesa PIN on the prompt sent to {phone}. This page will update automatically.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid gap-2">
              {individualPlans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTier(p.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                    tier === p.id ? "border-electric bg-electric/10" : "border-input hover:bg-accent",
                  )}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">KES {p.price.toLocaleString()}/yr</span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paywall-phone">M-Pesa phone number</Label>
              <Input
                id="paywall-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="hero" className="w-full">Pay KES {selected.price.toLocaleString()} with M-Pesa</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
