import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, FileText, PlayCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { statusMeta, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import metatwinLogo from "@/assets/metatwin_logo_transparent.png";
import heroBackdrop from "@/assets/hero-backdrop.jpg";

// Phone-sized (800px) versions of the 1600px hero photos, generated next to
// each original as hero-*-800.jpg. Keyed by the original's URL so every
// existing <HeroBackdrop image={...}> / <PageHero image={...}> call gets a
// srcset with no call-site changes. ~69% fewer bytes for the LCP image on phones.
const heroOriginals = import.meta.glob<string>(["/src/assets/hero-*.jpg", "!/src/assets/hero-*-800.jpg"], { eager: true, import: "default" });
const heroSmall = import.meta.glob<string>("/src/assets/hero-*-800.jpg", { eager: true, import: "default" });
const smallHeroByUrl: Record<string, string> = {};
for (const [path, url] of Object.entries(heroOriginals)) {
  const small = heroSmall[path.replace(/\.jpg$/, "-800.jpg")];
  if (small) smallHeroByUrl[url] = small;
}

export function HeroBackdrop({
  image = heroBackdrop,
  imageClassName,
}: {
  image?: string | null | undefined;
  imageClassName?: string | undefined;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {image && (
        <img
          src={image}
          srcSet={smallHeroByUrl[image] ? `${smallHeroByUrl[image]} 800w, ${image} 1600w` : undefined}
          sizes={smallHeroByUrl[image] ? "100vw" : undefined}
          alt=""
          width={1600}
          height={907}
          // Hero backdrops are always above the fold and are usually the
          // page's LCP element — fetch them before lower-priority assets.
          fetchPriority="high"
          decoding="async"
          className={cn(
            "hero-drift absolute inset-0 h-full w-full object-cover object-center opacity-80 sm:object-right-top",
            imageClassName,
          )}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/10" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}

// Ambient, on-brand alternative to HeroBackdrop for hero sections where a
// photo would just sit behind foreground UI and add nothing visible (e.g.
// the homepage hero, where ProfileMockup covers most of the frame) — a
// slow-drifting gradient field plus the same grid-lines pattern used
// elsewhere (AITeam), instead of a photo nobody actually sees.
export function HeroField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="grid-lines absolute inset-0 opacity-70" />
      <div className="hero-field-blob hero-field-blob-a absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-electric/30 blur-3xl" />
      <div className="hero-field-blob hero-field-blob-b absolute -right-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-violet/25 blur-3xl" />
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
        width={548}
        height={168}
        className="h-10 w-auto shrink-0 sm:h-12"
      />
    </Link>
  );
}

const nav = [
  { to: "/", label: "Home" },
  { to: "/profile", label: "My MetaTwin" },
  { to: "/projects", label: "Projects" },
  { to: "/talent", label: "Find Talent" },
  // Pairing is a signed-in student feature (browsing other students' real,
  // non-public project data) -- /pair itself already redirects a signed-out
  // visitor to /login, but it has no business being advertised in the public
  // marketing nav either.
  { to: "/pair", label: "Find a Co-founder", authOnly: true },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const visibleNav = nav.filter((n) => !("authOnly" in n && n.authOnly) || user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Signed-in users already have a MetaTwin: send them to it rather than
  // back into the first-run /build wizard.
  const cta = user ? { to: "/dashboard" as const, label: "My dashboard" } : { to: "/build" as const, label: "Build Your MetaTwin" };

  // Close the phone menu on any navigation (incl. back/forward) and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-foreground/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {visibleNav.map((n) => (
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
            <Link to={cta.to}>{cta.label}</Link>
          </Button>
        </div>
        <button
          className="-mr-2 cursor-pointer rounded-md p-2.5 text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="max-h-[calc(100svh-4rem)] overflow-y-auto overscroll-contain border-t border-ink-foreground/10 px-5 pb-5 lg:hidden">
          {visibleNav.map((n) => (
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
              className="block w-full py-3 text-left text-ink-muted"
            >
              Log out
            </button>
          ) : (
            <Link to="/login" onClick={() => setOpen(false)} className="block py-3 text-ink-muted">
              Log in
            </Link>
          )}
          <Button asChild variant="hero" className="mt-2 w-full">
            <Link to={cta.to} onClick={() => setOpen(false)}>{cta.label}</Link>
          </Button>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [deckOpen, setDeckOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
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
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm">
            The Future of the CV. Don't just tell the world what you can do — show the evidence.
          </p>
          <p className="mt-6 text-xs">A product of MetaGlobe Technologies Ltd.</p>
        </div>
        <div className="space-y-0.5 text-sm md:space-y-2">
          <p className="pb-1 font-display text-ink-foreground">Product</p>
          <Link to="/profile" className="block py-2 hover:text-ink-foreground md:py-0.5">Sample profile</Link>
          <Link to="/projects" className="block py-2 hover:text-ink-foreground md:py-0.5">Projects</Link>
          <Link to="/journey" className="block py-2 hover:text-ink-foreground md:py-0.5">The Journey of Your Work</Link>
          <Link to="/dashboard" className="block py-2 hover:text-ink-foreground md:py-0.5">Owner dashboard</Link>
        </div>
        <div className="space-y-0.5 text-sm md:space-y-2">
          <p className="pb-1 font-display text-ink-foreground">Company</p>
          <Link to="/talent" className="block py-2 hover:text-ink-foreground md:py-0.5">Find Talent</Link>
          <Link to="/how-it-works" className="block py-2 hover:text-ink-foreground md:py-0.5">How It Works</Link>
          <Link to="/pricing" className="block py-2 hover:text-ink-foreground md:py-0.5">Pricing</Link>
          <Link to="/about" className="block py-2 hover:text-ink-foreground md:py-0.5">About</Link>
          <Link to="/privacy" className="block py-2 hover:text-ink-foreground md:py-0.5">Privacy Policy</Link>
          <Link to="/terms" className="block py-2 hover:text-ink-foreground md:py-0.5">Terms of Service</Link>
        </div>
        <div className="space-y-0.5 text-sm md:space-y-2">
          <p className="pb-1 font-display text-ink-foreground">Pitch Deck</p>
          <button type="button" onClick={() => setDeckOpen(true)} className="flex items-center gap-1.5 py-2 hover:text-ink-foreground md:py-0.5">
            <FileText className="h-3.5 w-3.5 shrink-0" /> View the deck (PDF)
          </button>
          <button type="button" onClick={() => setVideoOpen(true)} className="flex items-center gap-1.5 py-2 hover:text-ink-foreground md:py-0.5">
            <PlayCircle className="h-3.5 w-3.5 shrink-0" /> Watch the pitch (video)
          </button>
        </div>
      </div>
      {!showsRealData && (
        <div className="border-t border-ink-foreground/10 px-5 py-5 text-center text-xs">
          Prototype · All people, projects and reviews shown are fictional demonstration data.
        </div>
      )}

      <Dialog open={deckOpen} onOpenChange={setDeckOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4 pr-6">
              MetaTwin Pitch Deck
              <a href="/MetaTwin_Pitch_Deck.pdf" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground">
                Open in a new tab <ExternalLink className="h-3 w-3" />
              </a>
            </DialogTitle>
          </DialogHeader>
          <iframe src="/MetaTwin_Pitch_Deck.pdf" title="MetaTwin Pitch Deck" className="h-[75vh] w-full rounded-md border" />
        </DialogContent>
      </Dialog>

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>MetaTwin Pitch</DialogTitle></DialogHeader>
          <video controls preload="metadata" className="w-full rounded-md bg-black" src="/MetaTwin_Pitch_Deck.mp4">
            Your browser can't play this video — <a href="/MetaTwin_Pitch_Deck.mp4" className="underline">download it</a> instead.
          </video>
        </DialogContent>
      </Dialog>
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
  image?: string | null | undefined;
  imageClassName?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <section className={cn("relative overflow-hidden bg-gradient-ink text-ink-foreground", className)}>
      <HeroBackdrop image={image} imageClassName={imageClassName} />
      <div className="relative mx-auto max-w-7xl px-5 py-16 md:py-20">
        <p className="hero-rise font-mono text-xs uppercase tracking-[0.2em] text-electric">{eyebrow}</p>
        <h1 className="hero-rise-delay-1 mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{title}</h1>
        {children && <div className="hero-rise-delay-2 mt-5 max-w-2xl text-ink-muted">{children}</div>}
      </div>
    </section>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("mx-auto max-w-7xl px-5 py-16 md:py-24", className)}>{children}</section>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("reveal-card rounded-2xl border bg-card p-6 shadow-card transition-shadow duration-300 hover:shadow-glow", className)}>{children}</div>;
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
