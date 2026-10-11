import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validateBirthYear } from "@/lib/adult";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/site";

// Shown instead of the dashboard for accounts with no adult declaration
// (accounts created before the 18+ rule, or via a sign-in that carries no
// birth year). The declaration is stored once by the declare_adult() RPC.
export function AdultGate({ onDeclared }: { onDeclared: () => void }) {
  const [birthYear, setBirthYear] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const age = validateBirthYear(birthYear);
    if ("error" in age) {
      setError(age.error);
      return;
    }
    if (!confirmed) {
      setError("Please confirm you are 18 or older.");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("declare_adult", { p_birth_year: age.year });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success("Thanks — you're all set.");
    onDeclared();
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <Card>
        <h1 className="text-2xl font-semibold">One quick step</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          MetaTwin is for students aged 18 or older for now. Confirm your year of birth to continue. We store only the year.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gate-birth-year">Year of birth</Label>
            <Input
              id="gate-birth-year"
              type="number"
              inputMode="numeric"
              required
              min={1900}
              max={new Date().getFullYear()}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="e.g. 2003"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>I confirm I am 18 or older.</span>
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Continue"}</Button>
        </form>
      </Card>
    </main>
  );
}
