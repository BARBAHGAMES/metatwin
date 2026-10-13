import { useState } from "react";
import { ExternalLink, FileText, PlayCircle } from "lucide-react";
import { toEmbeddableDeckUrl, toYouTubeEmbedUrl, isDirectVideoUrl } from "@/lib/embed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Same inline-viewer pattern as the site footer's own pitch deck/video
// (site.tsx's Footer) — a click opens a Dialog that plays the content in
// place instead of navigating away. Falls back to a plain "open in a new
// tab" link when the URL isn't one we know how to embed.
export function PitchDeckButton({ url, label = "View pitch deck (PDF)", className }: { url: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const embeddable = toEmbeddableDeckUrl(url);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "flex items-center gap-1.5 text-electric hover:underline"}>
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
  const youtube = toYouTubeEmbedUrl(url);
  const direct = !youtube && isDirectVideoUrl(url);
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
          {youtube ? (
            <div className="aspect-video w-full overflow-hidden rounded-md">
              <iframe
                src={youtube}
                title="Pitch video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : direct ? (
            <video controls preload="metadata" className="w-full rounded-md bg-black" src={url}>
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
