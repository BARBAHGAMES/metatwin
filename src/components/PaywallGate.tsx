import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MPESA_INITIATE_PATH, MPESA_STATUS_PATH } from "@/lib/api-paths";
import { individualPlans } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/site";

const BASIC_PLAN = individualPlans.find((p) => p.id === "basic")!;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

// Shown instead of the dashboard/profile for a signed-in account with no
// active plan (never paid, or a lapsed one). Mirrors AdultGate's shell;
// unlike AdultGate this has an async multi-step flow (initiate the STK
// push, then poll for the result) since the actual payment confirmation
// comes from Safaricom's own callback, not this request/response.
export function PaywallGate({ onPaid }: { onPaid: () => void }) {
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"form" | "waiting">("form");
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function pollStatus(checkoutRequestId: string, accessToken: string) {
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
    pollTimer.current = setInterval(async () => {
      if (Date.now() > pollDeadline.current) {
        stopPolling();
        setStage("form");
        setError("We didn't hear back in time. If you completed the payment, refresh this page in a minute.");
        return;
      }
      try {
        const res = await fetch(`${MPESA_STATUS_PATH}?checkout_request_id=${encodeURIComponent(checkoutRequestId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await res.json()) as { status?: string };
        if (body.status === "success") {
          stopPolling();
          toast.success("Payment received — welcome to MetaTwin.");
          onPaid();
        } else if (body.status === "failed") {
          stopPolling();
          setStage("form");
          setError("The payment wasn't completed. You can try again below.");
        }
      } catch {
        // Transient network hiccup — keep polling, the timeout above covers a genuine stall.
      }
    }, POLL_INTERVAL_MS);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setError("Please sign in again.");
      return;
    }
    setStage("waiting");
    try {
      const res = await fetch(MPESA_INITIATE_PATH, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = (await res.json()) as { checkout_request_id?: string; error?: string };
      if (!res.ok || !body.checkout_request_id) {
        setStage("form");
        setError(body.error ?? "Couldn't start the M-Pesa prompt. Try again.");
        return;
      }
      pollStatus(body.checkout_request_id, session.access_token);
    } catch {
      setStage("form");
      setError("Couldn't reach M-Pesa. Try again.");
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <Card>
        <ShieldCheck className="h-8 w-8 text-electric" />
        <h1 className="mt-4 text-2xl font-semibold">Unlock MetaTwin Basic</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          KES {BASIC_PLAN.price.toLocaleString()}/year gets you your full profile, capabilities, projects, evidence, and public page.
        </p>
        {stage === "waiting" ? (
          <div className="mt-5 space-y-2 text-sm">
            <p className="font-medium">Check your phone</p>
            <p className="text-muted-foreground">Enter your M-Pesa PIN on the prompt sent to {phone}. This page will update automatically.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
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
            <Button type="submit" variant="hero" className="w-full">Pay with M-Pesa</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
