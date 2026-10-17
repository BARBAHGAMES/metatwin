import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { toEmbeddableDeckUrl, toVideoEmbed, describeDeckLink, describeVideoLink } from "@/lib/embed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Same inline-viewer pattern as the site footer's own pitch deck/video
// (site.tsx's Footer) — a click opens a Dialog that plays the content in
// place instead of navigating away. Falls back to a plain "open in a new
// tab" link when the URL isn't one we know how to embed.
export function PitchDeckButton({
  url,
  label = "View pitch deck (PDF)",
  className,
  onOpen,
}: {
  url: string;
  label?: string;
  className?: string;
  /** Called when a visitor opens the deck (used to record deck views on public pages). */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const embeddable = toEmbeddableDeckUrl(url);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
        className={className ?? "flex items-center gap-1.5 text-electric hover:underline"}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" /> {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4 pr-6">
              Pitch deck
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground">
                Open in a new tab <ExternalLink className="h-3 w-3" />
              </a>
            </DialogTitle>
          </DialogHeader>
          {embeddable ? (
            <iframe src={embeddable} title="Pitch deck" className="h-[75vh] w-full rounded-md border" />
          ) : (
            <p className="text-sm text-muted-foreground">
              This link can't be shown inline.{" "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-electric hover:underline">Open it in a new tab</a> instead.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PitchVideoButton({ url, label = "Watch pitch video", className }: { url: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const embed = toVideoEmbed(url);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "flex items-center gap-1.5 text-electric hover:underline"}>
        <PlayCircle className="h-3.5 w-3.5 shrink-0" /> {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4 pr-6">
              Pitch video
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground">
                Open in a new tab <ExternalLink className="h-3 w-3" />
              </a>
            </DialogTitle>
          </DialogHeader>
          {embed?.type === "iframe" ? (
            <div className="aspect-video w-full overflow-hidden rounded-md">
              <iframe
                src={embed.src}
                title="Pitch video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : embed?.type === "video" ? (
            <video controls preload="metadata" className="w-full rounded-md bg-black" src={embed.src}>
              Your browser can't play this video — <a href={url} className="underline">download it</a> instead.
            </video>
          ) : (
            <p className="text-sm text-muted-foreground">
              This link can't be played inline.{" "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-electric hover:underline">Open it in a new tab</a> instead.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const SHARING_ADVICE = {
  google: {
    title: "One step so others can see it",
    body: "In Google, tap Share → General access → “Anyone with the link” → Viewer, then copy the link again. Using a school Google account? Some schools block this. If it won't let you, use a personal Google account.",
  },
  youtube: {
    title: "Check the video's visibility",
    body: "Set it to Public or Unlisted on YouTube. Private videos won't play for anyone else.",
  },
  canva: {
    title: "Share it as a public view link",
    body: "In Canva, tap Share → “Public view link” → copy. Visitors will open it in a new tab.",
  },
} as const;

/** Live recognition + sharing advice shown under a pasted deck/video link. */
export function LinkHint({ url, kind }: { url: string; kind: "deck" | "video" | "writeup" }) {
  const described = kind === "video" ? describeVideoLink(url) : describeDeckLink(url);
  if (!described) return null;
  // Write-ups always open in a new tab (MediaTiles links out), so never promise inline play.
  const d = kind === "writeup" ? { ...described, inline: false } : described;
  const advice = d.sharing ? SHARING_ADVICE[d.sharing] : null;
  return (
    <div className="space-y-2 text-xs" aria-live="polite">
      {!d.valid ? (
        <p className="flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {d.label}</p>
      ) : d.inline ? (
        <p className="flex items-center gap-1.5 text-status-evidence"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {d.label}: plays inside your MetaTwin</p>
      ) : (
        <p className="flex items-center gap-1.5 text-muted-foreground"><ExternalLink className="h-3.5 w-3.5 shrink-0" /> {d.label}: visitors will open it in a new tab</p>
      )}
      {advice && (
        <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <p className="font-semibold">{advice.title}</p>
          <p className="mt-1">{advice.body}</p>
        </div>
      )}
    </div>
  );
}
