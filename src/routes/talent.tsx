import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { fetchPublicTwins, type PublicTwinListItem } from "@/lib/public-profile";
import { Card, HeroBackdrop, Section } from "@/components/site";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/Reveal";
import { LoadError } from "@/components/LoadError";

export const Route = createFileRoute("/talent")({
  head: () => ({
    meta: [
      { title: "Find Talent · MetaTwin" },
      { name: "description", content: "Browse public MetaTwins: students with verified capabilities and the evidence behind them." },
      { property: "og:title", content: "Find Talent · MetaTwin" },
      { property: "og:description", content: "Every MetaTwin here is public by choice — open one to see the evidence behind the skills." },
    ],
  }),
  component: Talent,
});

function Talent() {
  const [twins, setTwins] = useState<PublicTwinListItem[] | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [q, setQ] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchPublicTwins()
      .then((data) => {
        if (cancelled) return;
        setTwins(data);
        setState("ready");
      })
      .catch((err) => {
        console.error("[talent] load failed:", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const term = q.trim().toLowerCase();
  const rows = (twins ?? []).filter(
    (t) => !term || [t.name, t.headline, t.institution].some((v) => v?.toLowerCase().includes(term)),
  );

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-4xl px-5 py-16 md:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-electric">Find talent</p>
          <h1 className="mt-4 text-3xl font-bold md:text-5xl">People with proof, not just a CV.</h1>
          <p className="mt-3 max-w-xl text-ink-muted">Every MetaTwin here is public by choice. Open one to see the capabilities, projects and evidence behind it.</p>
        </div>
      </section>

      <Section>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, headline or institution" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {state === "error" && <div className="mt-8"><LoadError onRetry={() => setReloadKey((k) => k + 1)} /></div>}
        {state === "loading" && <p className="mt-8 text-muted-foreground">Loading…</p>}
        {state === "ready" && rows.length === 0 && (
          <p className="mt-8 text-muted-foreground">
            {twins && twins.length > 0 ? "No match for that search." : "No public MetaTwins yet."}{" "}
            <Link to="/build" className="text-electric hover:underline">Be the first.</Link>
          </p>
        )}
        {state === "ready" && rows.length > 0 && (
          <Reveal stagger={0.05} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((t) => (
              <Link key={t.handle} to="/t/$handle" params={{ handle: t.handle }}>
                <Card className="flex h-full items-start gap-3 transition-shadow duration-200 hover:shadow-card">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
                    {t.photo_url ? <img src={t.photo_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name ?? "MetaTwin"}</p>
                    {t.headline && <p className="truncate text-sm text-muted-foreground">{t.headline}</p>}
                    {t.institution && <p className="truncate text-xs text-muted-foreground">{t.institution}</p>}
                  </div>
                </Card>
              </Link>
            ))}
          </Reveal>
        )}
      </Section>
    </>
  );
}
