import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, ExternalLink, Plus, Trash2 } from "lucide-react";
import { fetchMyAiEmployees, addAiEmployee, removeAiEmployee, type AiEmployee } from "@/lib/ai-employees";
import { safeHref } from "@/lib/url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = { name: "", role: "", platform: "", description: "", link_url: "" };

export function AiEmployeesCard({ userId }: { userId: string }) {
  const [employees, setEmployees] = useState<AiEmployee[] | undefined>(undefined);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  function reload() {
    fetchMyAiEmployees(userId)
      .then(setEmployees)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Couldn't load your AI employees.");
        setEmployees([]);
      });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleAdd() {
    if (!form.name.trim()) {
      toast.error("Give it a name.");
      return;
    }
    setAdding(true);
    try {
      await addAiEmployee(userId, form);
      setForm(emptyForm);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeAiEmployee(id);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that.");
    }
  }

  return (
    <div>
      <h3 className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4" /> Your AI employees</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        The agents and tools that work alongside you — a GPT, an automation, a bot you run. Shown separately on your public
        page and never counted as your own evidence.
      </p>

      {employees === undefined ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : employees.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">None added yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {employees.map((e) => {
            const href = safeHref(e.link_url);
            return (
              <li key={e.id} className="rounded-xl bg-ink p-3 text-ink-foreground">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.name} <span className="ml-1 rounded bg-electric/15 px-1.5 py-0.5 font-mono text-[10px] text-electric">AI</span></p>
                    <p className="truncate text-xs text-ink-muted">{[e.role, e.platform].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <button onClick={() => handleRemove(e.id)} aria-label="Remove" className="shrink-0 cursor-pointer rounded p-1 text-ink-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {e.description && <p className="mt-2 text-xs text-ink-muted">{e.description}</p>}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 flex items-center gap-1 text-xs text-electric hover:underline">
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 space-y-2 border-t pt-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Name (e.g. Research Analyst)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Role (optional)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Platform (optional, e.g. ChatGPT)" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
          <Input placeholder="Link (optional)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
        </div>
        <Textarea rows={2} placeholder="What does it do for you? (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Button onClick={handleAdd} disabled={adding}><Plus /> {adding ? "Adding…" : "Add AI employee"}</Button>
      </div>
    </div>
  );
}
