import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Users, Plus, ExternalLink, X, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchMyTeams, createTeam, updateTeam, addTeamMember, leaveTeam, removeTeamMember, type MyTeam } from "@/lib/teams";

const emptyCreateForm = { name: "", description: "" };
const emptyMemberForm = { handle: "", role: "" };

export function TeamsCard() {
  const [teams, setTeams] = useState<MyTeam[] | undefined>(undefined); // undefined = loading
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [manageTeam, setManageTeam] = useState<MyTeam | null>(null);
  const [settingsForm, setSettingsForm] = useState({ name: "", description: "", slug: "", visibility: "private" as "public" | "private" });
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setTeams(await fetchMyTeams());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load your teams.");
      setTeams([]);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      await createTeam(createForm.name, createForm.description);
      toast.success(`Team "${createForm.name}" created.`);
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the team.");
    } finally {
      setCreating(false);
    }
  }

  function openManage(team: MyTeam) {
    setManageTeam(team);
    setSettingsForm({ name: team.name, description: team.description ?? "", slug: team.slug ?? "", visibility: team.visibility });
    setMemberForm(emptyMemberForm);
  }

  async function handleSaveSettings() {
    if (!manageTeam) return;
    setBusy(true);
    try {
      await updateTeam({ teamId: manageTeam.id, ...settingsForm });
      toast.success("Team settings saved.");
      await reload();
      setManageTeam(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember() {
    if (!manageTeam) return;
    setBusy(true);
    try {
      await addTeamMember(manageTeam.id, memberForm.handle, memberForm.role);
      toast.success("Added to the team.");
      setMemberForm(emptyMemberForm);
      const fresh = await fetchMyTeams();
      setTeams(fresh);
      setManageTeam(fresh.find((t) => t.id === manageTeam.id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that person.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(twinId: string) {
    if (!manageTeam) return;
    setBusy(true);
    try {
      await removeTeamMember(manageTeam.id, twinId);
      const fresh = await fetchMyTeams();
      setTeams(fresh);
      setManageTeam(fresh.find((t) => t.id === manageTeam.id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave(teamId: string) {
    setBusy(true);
    try {
      await leaveTeam(teamId);
      toast.success("Left the team.");
      setManageTeam(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't leave the team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Teams</h3>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}><Plus /> New team</Button>
      </div>

      {teams === undefined ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : teams.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Not on a team yet. Pitching or building with others? Create a team so your shared work and scores show up together.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {teams.map((team) => (
            <li key={team.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {team.name} {team.visibility === "public" && team.slug && <span className="font-normal text-muted-foreground">· public</span>}
                  {team.pitch_scores.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <Trophy className="h-3 w-3" /> {team.pitch_scores[0]!.total_score}/100
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{team.members.map((m) => m.name ?? m.handle ?? "member").join(", ")}</p>
              </div>
              <div className="flex items-center gap-2">
                {team.visibility === "public" && team.slug && (
                  <Link to="/teams/$slug" params={{ slug: team.slug }} className="flex items-center gap-1 text-xs text-electric hover:underline">
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <Button variant="outline" size="sm" onClick={() => openManage(team)}>Manage</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a team</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" maxLength={120} value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. AquaLoop Team" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-description">What are you building? (optional)</Label>
              <Textarea id="team-description" rows={3} maxLength={1000} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating || !createForm.name.trim()}>{creating ? "Creating…" : "Create team"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageTeam} onOpenChange={(open) => !open && setManageTeam(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{manageTeam?.name}</DialogTitle></DialogHeader>
          {manageTeam && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
                <ul className="mt-2 space-y-1.5">
                  {manageTeam.members.map((m) => (
                    <li key={m.twin_id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
                      <span className="truncate">{m.name ?? m.handle ?? "Member"}{m.role && <span className="text-muted-foreground"> · {m.role}</span>}</span>
                      {manageTeam.is_creator && <button type="button" onClick={() => handleRemoveMember(m.twin_id)} disabled={busy} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="member-handle" className="text-xs">Add by MetaTwin handle</Label>
                    <Input id="member-handle" value={memberForm.handle} onChange={(e) => setMemberForm({ ...memberForm, handle: e.target.value })} placeholder="their-handle" />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label htmlFor="member-role" className="text-xs">Role (optional)</Label>
                    <Input id="member-role" value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} placeholder="Design" />
                  </div>
                  <Button size="sm" onClick={handleAddMember} disabled={busy || !memberForm.handle.trim()}>Add</Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">They need a MetaTwin handle set on their own profile first.</p>
              </div>

              {manageTeam.pitch_scores.length > 0 && (
                <div className="border-t pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Pitch scores</p>
                  <ul className="mt-2 space-y-2">
                    {manageTeam.pitch_scores.map((s) => (
                      <li key={s.id} className="rounded-md bg-muted/40 px-2.5 py-2 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">{s.competition_name}{s.round_name && <span className="text-muted-foreground"> · {s.round_name}</span>}</span>
                          <span className="font-display font-semibold">{s.total_score}/100</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Problem {s.problem_score} · Solution {s.solution_score} · Team {s.team_score} · Ask {s.ask_score}
                        </p>
                        {s.judge_comment && <p className="mt-1 text-xs text-muted-foreground">"{s.judge_comment}"{s.judge_name && <span> — {s.judge_name}</span>}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {manageTeam.is_creator ? (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team settings</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-name">Name</Label>
                    <Input id="settings-name" maxLength={120} value={settingsForm.name} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-description">Description</Label>
                    <Textarea id="settings-description" rows={2} maxLength={1000} value={settingsForm.description} onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant={settingsForm.visibility === "private" ? "default" : "outline"} size="sm" onClick={() => setSettingsForm({ ...settingsForm, visibility: "private" })}>Private</Button>
                    <Button type="button" variant={settingsForm.visibility === "public" ? "default" : "outline"} size="sm" onClick={() => setSettingsForm({ ...settingsForm, visibility: "public" })}>Public</Button>
                  </div>
                  {settingsForm.visibility === "public" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-slug">Public URL</Label>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span>metatwin.../teams/</span>
                        <Input id="settings-slug" className="h-8" value={settingsForm.slug} onChange={(e) => setSettingsForm({ ...settingsForm, slug: e.target.value.toLowerCase() })} placeholder="your-team" />
                      </div>
                    </div>
                  )}
                  <Button size="sm" onClick={handleSaveSettings} disabled={busy || !settingsForm.name.trim()}>Save settings</Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Only {manageTeam.members.find((m) => m.role === "Lead")?.name ?? "the team's creator"} can change team settings.</p>
              )}

              <Button variant="ghost" size="sm" onClick={() => handleLeave(manageTeam.id)} disabled={busy} className="text-muted-foreground">Leave this team</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
