import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MPESA_INITIATE_PATH, MPESA_STATUS_PATH, type MpesaProduct } from "@/lib/api-paths";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

// Shared "collect phone -> initiate STK push -> poll for the async result"
// flow, used by both PaywallGate (individual plans) and the team-lead
// "upgrade team" flow — same mechanics, different Product.
export function useMpesaPayment(onPaid: () => void) {
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
          toast.success("Payment received.");
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

  async function pay(phone: string, product: MpesaProduct) {
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
        body: JSON.stringify({ phone, product }),
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

  return { stage, error, pay };
}
