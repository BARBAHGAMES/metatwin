import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type Twin = {
  id: string;
  name: string | null;
  institution: string | null;
  programme: string | null;
  year: number | null;
  headline: string | null;
  visibility: "private" | "public";
};

function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [twin, setTwin] = useState<Twin | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("twins")
      .select("id, name, institution, programme, year, headline, visibility")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("[dashboard] load twin failed:", error.message);
        setTwin(
          (data as Twin | null) ?? {
            id: user.id,
            name: null,
            institution: null,
            programme: null,
            year: null,
            headline: null,
            visibility: "private",
          },
        );
        setFetching(false);
      });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!twin || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("twins")
      .upsert({ ...twin, id: user.id }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved.");
  }

  if (loading || fetching || !twin) {
    return <main className="p-8 text-center">Loading...</main>;
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Your MetaTwin</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Name</span>
          <input
            value={twin.name ?? ""}
            onChange={(e) => setTwin({ ...twin, name: e.target.value })}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Institution</span>
          <input
            value={twin.institution ?? ""}
            onChange={(e) => setTwin({ ...twin, institution: e.target.value })}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Programme</span>
          <input
            value={twin.programme ?? ""}
            onChange={(e) => setTwin({ ...twin, programme: e.target.value })}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Year</span>
          <input
            type="number"
            value={twin.year ?? ""}
            onChange={(e) => setTwin({ ...twin, year: e.target.value ? Number(e.target.value) : null })}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Headline</span>
          <input
            value={twin.headline ?? ""}
            onChange={(e) => setTwin({ ...twin, headline: e.target.value })}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={twin.visibility === "public"}
            onChange={(e) => setTwin({ ...twin, visibility: e.target.checked ? "public" : "private" })}
          />
          <span className="text-sm">Visible to employers</span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </main>
  );
}
