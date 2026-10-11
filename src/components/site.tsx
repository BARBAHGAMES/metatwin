import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusMeta, type Status } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import metatwinLogo from "@/assets/metatwin-logo-dark.png";
import heroBackdrop from "@/assets/hero-backdrop.jpg";

export function HeroBackdrop({ image = heroBackdrop, imageClassName }: { image?: string | undefined; imageClassName?: string | undefined }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <img
        src={image}
        alt=""
        width={1920}
        height={1088}
        className={cn("hero-drift absolute inset-0 h-full w-full object-cover object-right opacity-80", imageClassName)}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/10" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center">
      <img
        src={metatwinLogo}
        alt="MetaTwin"
        className="h-10 w-auto shrink-0 sm:h-12"
      />
    </Link>
  );
}

const nav = [
  { to: "/", label: "Home" },
  { to: "/profile", label: "My MetaTwin" },
  { to: "/projects", label: "Explore Capabilities" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-ink-foreground/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo />
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
        <button
          className="-mr-2 cursor-pointer rounded-md p-2.5 text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  // The "fictional demonstration data" line is true on marketing/sample pages
  // but false where a real student's data is shown.
  // Signed-in students see their own data on these pages (examples there carry
  // their own "Fictional sample data" tag).
  const realDataPaths = ["/profile", "/projects", "/journey", "/capability"];
  const showsRealData =
    pathname.startsWith("/t/") ||
    pathname.startsWith("/dashboard") ||
    (!!user && realDataPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
  return (
    <footer className="bg-ink text-ink-muted">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
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
          <Link to="/pricing" className="block hover:text-ink-foreground">Pricing</Link>
          <Link to="/about" className="block hover:text-ink-foreground">About</Link>
          <Link to="/privacy" className="block hover:text-ink-foreground">Privacy Policy</Link>
          <Link to="/terms" className="block hover:text-ink-foreground">Terms of Service</Link>
        </div>
      </div>
      {!showsRealData && (
        <div className="border-t border-ink-foreground/10 px-5 py-5 text-center text-xs">
          Prototype · All people, projects and reviews shown are fictional demonstration data.
        </div>
      )}
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

// For features shown on REAL accounts that are not built yet. Unlike
// SampleTag (fictional data on marketing pages), this says the feature itself
// is a preview, so a student never reads it as something working for them.
export function PreviewTag({ children = "Preview · coming soon" }: { children?: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-electric/50 bg-electric/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-electric">
      {children}
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

export function PageHero({
  eyebrow,
  title,
  children,
  image,
  imageClassName,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  image?: string | undefined;
  imageClassName?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <section className={cn("relative overflow-hidden bg-gradient-ink text-ink-foreground", className)}>
      <HeroBackdrop image={image} imageClassName={imageClassName} />
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
