import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, GitFork, Github, MessageSquare, Pencil, Plus, RefreshCw, Rocket, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GITHUB_SYNC_PATH, PITCH_FEEDBACK_SYNC_PATH, type GitHubRepoStats } from "@/lib/api-paths";
import type { GithubRepoRow, MyProject, PitchRow, PitchStatsRow } from "@/lib/real-data";
import type { PitchScores } from "@/lib/scores";
import { safeHref } from "@/lib/url";
import { Card } from "@/components/site";
import { PitchDeckButton, PitchVideoButton } from "@/components/PitchMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const OUTCOMES = [
  { value: "interested", label: "Interested" },
  { value: "follow-up", label: "Follow-up" },
  { value: "customer", label: "Customer" },
  { value: "no", label: "No" },
] as const;

export function GitHubCard({
  repo,
  githubRepoField,
  onFieldChange,
  onSave,
  onSynced,
  twinId,
  projectId,
}: {
  repo: GithubRepoRow | null;
  githubRepoField: string;
  onFieldChange: (v: string) => void;
  onSave: () => Promise<void>;
  onSynced: () => void;
  twinId: string;
  projectId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const weeks = Array.isArray(repo?.weekly_commits) ? (repo.weekly_commits as number[]) : [];
  const max = Math.max(1, ...weeks);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    const repoName = githubRepoField.trim();
    if (!repoName) {
      toast.error("Add a repo first (owner/name).");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(GITHUB_SYNC_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: repoName }),
      });
      const body = (await res.json()) as GitHubRepoStats | { error: string };
      if (!res.ok || "error" in body) {
        toast.error("error" in body ? body.error : "Could not sync this repo.");
        return;
      }
      await supabase.from("github_repos").delete().eq("project_id", projectId);
      const { error } = await supabase.from("github_repos").insert({
        twin_id: twinId,
        project_id: projectId,
        full_name: body.full_name,
        url: body.url,
        description: body.description,
        stars: body.stars,
        forks: body.forks,
        open_issues: body.open_issues,
        language: body.language,
        last_commit_at: body.last_commit_at,
        weekly_commits: body.weekly_commits,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("GitHub stats synced.");
      onSynced();
    } catch {
      toast.error("Could not reach GitHub. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <h3 className="flex items-center gap-2 font-semibold"><Github className="h-4 w-4" /> GitHub repo</h3>
      <div className="mt-3 flex gap-2">
        <Input placeholder="owner/repo" value={githubRepoField} onChange={(e) => onFieldChange(e.target.value)} />
        <Button variant="outline" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
      <Button variant="hero" className="mt-2 w-full" onClick={sync} disabled={syncing}>
        <RefreshCw className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : repo ? "Sync again" : "Sync stats"}
      </Button>
      {repo && (
        <div className="mt-4 border-t pt-4">
          <a href={safeHref(repo.url) ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-electric hover:underline">
            {repo.full_name} <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {repo.description && <p className="mt-1 text-sm text-muted-foreground">{repo.description}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {repo.stars}</span>
            <span className="flex items-center gap-1"><GitFork className="h-3.5 w-3.5" /> {repo.forks}</span>
            {repo.language && <span>{repo.language}</span>}
            {repo.last_commit_at && <span>Last push {new Date(repo.last_commit_at).toLocaleDateString()}</span>}
          </div>
          {weeks.length > 0 && (
            <div className="mt-4">
              <div className="flex h-12 items-end gap-1">
                {weeks.map((w, i) => (
                  <div key={i} title={`${w} commits`} className="flex-1 rounded-sm bg-electric/60" style={{ height: `${Math.max(6, (w / max) * 100)}%` }} />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Commits, last 12 weeks · from GitHub</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function PitchTracker({
  pitches,
  stats,
  twinId,
  projectId,
  onChange,
}: {
  pitches: PitchRow[];
  stats: PitchStatsRow | null;
  twinId: string;
  projectId: string;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ business_name: "", sector: "", outcome: "follow-up" as string, notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ business_name: "", sector: "", outcome: "follow-up" as string, notes: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  async function addPitch() {
    if (!form.business_name.trim()) {
      toast.error("Add the business name.");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("pitches").insert({
      twin_id: twinId,
      project_id: projectId,
      business_name: form.business_name.trim(),
      sector: form.sector.trim() || null,
      outcome: form.outcome,
      notes: form.notes.trim() || null,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ business_name: "", sector: "", outcome: "follow-up", notes: "" });
    onChange();
  }

  function startEdit(p: PitchRow) {
    setEditingId(p.id);
    setEditForm({ business_name: p.business_name, sector: p.sector ?? "", outcome: p.outcome, notes: p.notes ?? "" });
  }

  async function saveEdit() {
    if (!editingId || !editForm.business_name.trim()) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("pitches")
      .update({
        business_name: editForm.business_name.trim(),
        sector: editForm.sector.trim() || null,
        outcome: editForm.outcome,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", editingId);
    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingId(null);
    onChange();
  }

  async function removePitch(id: string) {
    const { error } = await supabase.from("pitches").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange();
  }

  return (
    <Card>
      <h3 className="flex items-center gap-2 font-semibold"><Rocket className="h-4 w-4" /> Startup tracker</h3>
      <p className="mt-1 text-xs text-muted-foreground">Reported by the student — not independently verified.</p>
      {stats && stats.total_pitches > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{stats.total_pitches}</p><p className="text-xs text-muted-foreground">Pitches</p></div>
          <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{stats.conversion_pct ?? 0}%</p><p className="text-xs text-muted-foreground">Positive</p></div>
          <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{stats.customers}</p><p className="text-xs text-muted-foreground">Customers</p></div>
        </div>
      )}
      <ul className="mt-4 space-y-2">
        {pitches.map((p) =>
          editingId === p.id ? (
            <li key={p.id} className="space-y-2 rounded-lg border p-2.5 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Business name" value={editForm.business_name} onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })} />
                <Input placeholder="Sector (optional)" value={editForm.sector} onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })} />
              </div>
              <select value={editForm.outcome} onChange={(e) => setEditForm({ ...editForm, outcome: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Textarea rows={2} placeholder="Notes (optional)" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? "Saving…" : "Save"}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={savingEdit}>Cancel</Button>
              </div>
            </li>
          ) : (
            <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.business_name}{p.sector ? ` · ${p.sector}` : ""}</p>
                <p className="text-xs text-muted-foreground">{p.pitched_on} · {OUTCOMES.find((o) => o.value === p.outcome)?.label ?? p.outcome}</p>
                {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => startEdit(p)} aria-label="Edit" className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => removePitch(p.id)} aria-label="Remove" className="cursor-pointer rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ),
        )}
      </ul>
      <div className="mt-4 space-y-2 border-t pt-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Business name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          <Input placeholder="Sector (optional)" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
        </div>
        <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Textarea rows={2} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <Button onClick={addPitch} disabled={adding}><Plus /> {adding ? "Adding…" : "Log pitch"}</Button>
      </div>
    </Card>
  );
}

export function PitchFeedbackCard({
  project,
  onSynced,
}: {
  project: Pick<MyProject, "id" | "scores_csv_url" | "pitch_scores" | "scores_synced_at">;
  onSynced: () => void;
}) {
  const [url, setUrl] = useState(project.scores_csv_url ?? "");
  const [syncing, setSyncing] = useState(false);
  const scores = project.pitch_scores as PitchScores | Record<string, never>;
  const hasScores = "responses" in scores && scores.responses > 0;

  async function sync() {
    const csvUrl = url.trim();
    if (!csvUrl) {
      toast.error("Paste your published Google Sheet link first.");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(PITCH_FEEDBACK_SYNC_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv_url: csvUrl }),
      });
      const body = (await res.json()) as PitchScores | { error: string };
      if (!res.ok || "error" in body) {
        toast.error("error" in body ? body.error : "Could not sync feedback.");
        return;
      }
      const { error } = await supabase
        .from("projects")
        .update({ scores_csv_url: csvUrl, pitch_scores: body, scores_synced_at: new Date().toISOString() })
        .eq("id", project.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Pitch feedback synced.");
      onSynced();
    } catch {
      toast.error("Could not reach Google Sheets. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <h3 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" /> Pitch feedback</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Paste your Google Form's response sheet, published to the web as a CSV (Sheet → File → Share → Publish to web → CSV). We
        only read question averages — never the raw responses.
      </p>
      <div className="mt-3 flex gap-2">
        <Input placeholder="https://docs.google.com/spreadsheets/..." value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <Button variant="hero" className="mt-2 w-full" onClick={sync} disabled={syncing}>
        <RefreshCw className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : hasScores ? "Sync again" : "Sync feedback"}
      </Button>
      {hasScores && "overall" in scores && (
        <div className="mt-4 border-t pt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">{scores.responses} response{scores.responses === 1 ? "" : "s"}</p>
            {scores.overall != null && <p className="font-display text-2xl font-semibold">{scores.overall.toFixed(1)}<span className="text-sm text-muted-foreground">/10</span></p>}
          </div>
          <div className="mt-3 space-y-2">
            {scores.questions.map((q) => (
              <div key={q.label}>
                <div className="flex justify-between text-xs"><span>{q.label}</span><span className="text-muted-foreground">{q.average.toFixed(1)} / {q.max}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-electric" style={{ width: `${(q.average / q.max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          {project.scores_synced_at && <p className="mt-3 text-xs text-muted-foreground">Last synced {new Date(project.scores_synced_at).toLocaleDateString()} · reported by the student</p>}
        </div>
      )}
    </Card>
  );
}

export function ProjectLinksForm({
  project,
  onSaved,
}: {
  project: Pick<MyProject, "id" | "writeup_url" | "pitch_deck_url" | "pitch_video_url">;
  onSaved: () => void;
}) {
  const [writeup, setWriteup] = useState(project.writeup_url ?? "");
  const [deck, setDeck] = useState(project.pitch_deck_url ?? "");
  const [video, setVideo] = useState(project.pitch_video_url ?? "");
  const [saving, setSaving] = useState(false);
  const savedDeck = safeHref(project.pitch_deck_url);
  const savedVideo = safeHref(project.pitch_video_url);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ writeup_url: writeup.trim() || null, pitch_deck_url: deck.trim() || null, pitch_video_url: video.trim() || null })
      .eq("id", project.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Links saved.");
    onSaved();
  }

  return (
    <Card>
      <h3 className="font-semibold">Write-up, deck & pitch video</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Paste links — a Google Doc write-up, a Slides/Drive deck, and a pitch video (YouTube or a direct video link). No account connection needed, and they play inline on your profile.
      </p>
      <div className="mt-3 space-y-2">
        <div className="space-y-1.5">
          <Label>Write-up (Google Doc, etc.)</Label>
          <Input placeholder="https://docs.google.com/..." value={writeup} onChange={(e) => setWriteup(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Pitch deck (Google Slides/Drive, etc.)</Label>
          <Input placeholder="https://docs.google.com/presentation/..." value={deck} onChange={(e) => setDeck(e.target.value)} />
          {savedDeck && <PitchDeckButton url={savedDeck} label="Preview saved deck" className="mt-1 flex items-center gap-1.5 text-xs text-electric hover:underline" />}
        </div>
        <div className="space-y-1.5">
          <Label>Pitch video (YouTube or direct link)</Label>
          <Input placeholder="https://youtube.com/watch?v=..." value={video} onChange={(e) => setVideo(e.target.value)} />
          {savedVideo && <PitchVideoButton url={savedVideo} label="Preview saved video" className="mt-1 flex items-center gap-1.5 text-xs text-electric hover:underline" />}
        </div>
        <Button variant="outline" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save links"}</Button>
      </div>
    </Card>
  );
}
