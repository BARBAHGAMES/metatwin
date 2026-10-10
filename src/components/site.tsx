import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusMeta, type Status } from "@/lib/data";
import { cn } from "@/lib/utils";
import { CareerGraph } from "@/components/CareerGraph";
import { useAuth } from "@/lib/auth";

export function HeroBackdrop() {
  return (
    <>
      <div className="absolute inset-0 opacity-70" aria-hidden><CareerGraph /></div>
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/20" aria-hidden />
    </>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="mtg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--electric)" />
            <stop offset="1" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
        <circle cx="11" cy="16" r="8" fill="none" stroke="url(#mtg)" strokeWidth="2.5" />
        <circle cx="21" cy="16" r="8" fill="none" stroke={light ? "var(--ink-foreground)" : "var(--ink)"} strokeWidth="2.5" strokeDasharray="3 2.5" />
        <circle cx="16" cy="16" r="2.4" fill="url(#mtg)" />
      </svg>
      <span className={cn("font-display text-lg font-semibold tracking-tight", light ? "text-ink-foreground" : "text-foreground")}>
        Meta<span className="text-gradient-electric">Twin</span>
      </span>
    </Link>
  );
}

const nav = [
  { to: "/", label: "Home" },
  { to: "/profile", label: "My MetaTwin" },
  { to: "/projects", label: "Explore Capabilities" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-ink-foreground/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo light />
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-full px-3.5 py-1.5 text-sm text-ink-muted transition hover:text-ink-foreground"
              activeProps={{ className: "bg-ink-foreground/10 text-ink-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <Button variant="heroOutline" size="sm" onClick={() => signOut()}>
              Log out
            </Button>
          ) : (
            <Link to="/login" className="rounded-full px-3.5 py-1.5 text-sm text-ink-muted transition hover:text-ink-foreground">
              Log in
            </Link>
          )}
          <Button asChild variant="hero" size="sm" className="px-4">
            <Link to="/build">Build Your MetaTwin</Link>
          </Button>
        </div>
        <button className="text-ink-foreground lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-ink-foreground/10 px-5 pb-5 lg:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block py-3 text-ink-muted" activeProps={{ className: "text-ink-foreground" }} activeOptions={{ exact: n.to === "/" }}>
              {n.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={() => {
                signOut();
                setOpen(false);
              }}
              className="block py-3 text-left text-ink-muted"
            >
              Log out
            </button>
          ) : (
            <Link to="/login" onClick={() => setOpen(false)} className="block py-3 text-ink-muted">
              Log in
            </Link>
          )}
          <Button asChild variant="hero" className="mt-2 w-full">
            <Link to="/build" onClick={() => setOpen(false)}>Build Your MetaTwin</Link>
          </Button>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink text-ink-muted">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm">
            The Future of the CV. Don't just tell the world what you can do — show the evidence.
          </p>
          <p className="mt-6 text-xs">A product of MetaGlobe Technologies Ltd.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-display text-ink-foreground">Product</p>
          <Link to="/profile" className="block hover:text-ink-foreground">Sample profile</Link>
          <Link to="/projects" className="block hover:text-ink-foreground">Projects</Link>
          <Link to="/journey" className="block hover:text-ink-foreground">The Journey of Your Work</Link>
          <Link to="/dashboard" className="block hover:text-ink-foreground">Owner dashboard</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-display text-ink-foreground">Company</p>
          <Link to="/how-it-works" className="block hover:text-ink-foreground">How It Works</Link>
          <Link to="/about" className="block hover:text-ink-foreground">About</Link>
        </div>
      </div>
      <div className="border-t border-ink-foreground/10 px-5 py-5 text-center text-xs">
        Prototype · All people, projects and reviews shown are fictional demonstration data.
      </div>
    </footer>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const styles: Record<Status, string> = {
    self: "bg-status-self-bg text-status-self border-dashed border-status-self/40",
    evidence: "bg-status-evidence-bg text-status-evidence border-status-evidence/30",
    reviewed: "bg-status-reviewed-bg text-status-reviewed border-status-reviewed/30",
  };
  const dot: Record<Status, string> = {
    self: "border border-status-self bg-transparent",
    evidence: "bg-status-evidence",
    reviewed: "bg-status-reviewed ring-2 ring-status-reviewed/25",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", styles[status], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status])} />
      {statusMeta[status].label}
    </span>
  );
}

export function SampleTag() {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-electric/40 bg-electric-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-foreground">
      Fictional sample data
    </span>
  );
}

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-gradient-ink text-ink-foreground">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-20">
        <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">{eyebrow}</p>
        <h1 className="hero-rise-delay-1 mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
        {children && <div className="hero-rise-delay-2 mt-5 max-w-2xl text-ink-muted">{children}</div>}
      </div>
    </section>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mx-auto max-w-7xl px-5 py-16 md:py-24", className)}>{children}</section>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border bg-card p-6 shadow-card", className)}>{children}</div>;
}

// Stand-in for a profile photo on sample/demo content — avoids shipping a
// fictional person's photo as a binary asset. Real user profiles will use a
// real uploaded photo or this same initials fallback.
export function SampleAvatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div className={cn("grid shrink-0 place-items-center bg-gradient-electric font-display font-semibold text-primary-foreground", className)}>
      {initials}
    </div>
  );
}
