import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { TWIN_CHAT_PATH } from "@/lib/api-paths";
import { Card } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };

export function TwinChat({ handle, name }: { handle: string; name: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestions = ["What have they built?", "What skills are backed by evidence?", "What are they looking for?"];

  async function send(q: string) {
    if (!q.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: q.trim() }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch(TWIN_CHAT_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, messages: next }),
      });
      const body = (await res.json()) as { reply?: string; error?: string };
      setMsgs([...next, { role: "assistant", content: res.ok ? (body.reply ?? "") : (body.error ?? "Something went wrong.") }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-electric" /><h3 className="font-semibold">Ask {name}'s MetaTwin</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">An AI assistant that answers only from what's shown on this page. Not {name} themselves.</p>
      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-electric px-4 py-2 text-sm text-electric-foreground" : "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2 text-sm"}>
            {m.content}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>
      {msgs.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} className="cursor-pointer rounded-full border px-3 py-1 text-xs transition hover:border-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about skills, projects, evidence…" maxLength={1500} disabled={busy} />
        <Button type="submit" variant="hero" disabled={busy || !text.trim()} aria-label="Send"><Send /></Button>
      </form>
    </Card>
  );
}
