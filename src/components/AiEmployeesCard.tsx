import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, ExternalLink, Pencil, Plus, Trash2, Star, GitFork, RefreshCw } from "lucide-react";
import {
  fetchMyAiEmployees,
  addAiEmployee,
  updateAiEmployee,
  removeAiEmployee,
  parseGithubRepo,
  syncAiEmployeeGithubStats,
  type AiEmployee,
} from "@/lib/ai-employees";
import { safeHref } from "@/lib/url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = { name: "", role: "", platform: "", description: "", link_url: "" };
const LINK_PLACEHOLDER = "GitHub repo or Claude Skill link (optional)";

function EditForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: AiEmployee;
  onSave: (fields: typeof emptyForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial.name,
    role: initial.role ?? "",
    platform: initial.platform ?? "",
    description: initial.description ?? "",
    link_url: initial.link_url ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Give it a name.");
      return;
    }
    setSaving(true);
    await onSave(form).finally(() => setSaving(false));
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Role (optional)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Platform (optional)" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
        <Input placeholder={LINK_PLACEHOLDER} value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
      </div>
      <Textarea rows={2} placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

export function AiEmployeesCard({ userId }: { userId: string }) {
  const [employees, setEmployees] = useState<AiEmployee[] | undefined>(undefined);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

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

  async function handleSaveEdit(id: string, fields: typeof emptyForm) {
    try {
      await updateAiEmployee(id, fields);
      setEditingId(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that.");
    }
  }

  async function handleSyncStats(id: string, repo: string) {
    setSyncingId(id);
    try {
      await syncAiEmployeeGithubStats(id, repo);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't fetch GitHub stats.");
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div>
      <h3 className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4" /> Your AI employees</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        The agents and tools that work alongside you — a GPT, an automation, a bot you run. Link its GitHub repo or Claude
        Skill. Shown separately on your public page and never counted as your own evidence.
      </p>

      {employees === undefined ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : employees.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">None added yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {employees.map((e) => {
            const href = safeHref(e.link_url);
            const repo = e.link_url ? parseGithubRepo(e.link_url) : null;
            if (editingId === e.id) {
              return (
                <li key={e.id} className="rounded-xl bg-ink p-3 text-ink-foreground">
                  <EditForm initial={e} onSave={(fields) => handleSaveEdit(e.id, fields)} onCancel={() => setEditingId(null)} />
                </li>
              );
            }
            return (
              <li key={e.id} className="rounded-xl bg-ink p-3 text-ink-foreground">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.name} <span className="ml-1 rounded bg-electric/15 px-1.5 py-0.5 font-mono text-[10px] text-electric">AI</span></p>
                    <p className="truncate text-xs text-ink-muted">{[e.role, e.platform].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => setEditingId(e.id)} aria-label="Edit" className="cursor-pointer rounded p-1 text-ink-muted hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleRemove(e.id)} aria-label="Remove" className="cursor-pointer rounded p-1 text-ink-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {e.description && <p className="mt-2 text-xs text-ink-muted">{e.description}</p>}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 flex items-center gap-1 text-xs text-electric hover:underline">
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {repo && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-ink-foreground/10 pt-2 text-xs text-ink-muted">
                    {e.github_synced_at ? (
                      <>
                        <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {e.github_stars}</span>
                        <span className="flex items-center gap-1"><GitFork className="h-3 w-3" /> {e.github_forks}</span>
                        <span>{e.github_open_issues} open issues</span>
                      </>
                    ) : (
                      <span>Not synced yet</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSyncStats(e.id, repo)}
                      disabled={syncingId === e.id}
                      className="ml-auto flex items-center gap-1 text-electric hover:underline disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${syncingId === e.id ? "animate-spin" : ""}`} /> {syncingId === e.id ? "Syncing…" : "Sync stats"}
                    </button>
                  </div>
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
          <Input placeholder={LINK_PLACEHOLDER} value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
        </div>
        <Textarea rows={2} placeholder="What does it do for you? (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Button onClick={handleAdd} disabled={adding}><Plus /> {adding ? "Adding…" : "Add AI employee"}</Button>
      </div>
    </div>
  );
}
