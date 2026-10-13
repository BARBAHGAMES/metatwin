// Turns a pasted deck/video link into an inline-embeddable URL when we know
// how (a direct PDF, a Google Drive/Docs/Slides share link, a YouTube link),
// or returns null so the caller falls back to a plain "open in a new tab"
// link instead of forcing a broken iframe.
import { isHttpUrl } from "./url";

function parse(url: string): URL | null {
  if (!isHttpUrl(url)) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function toEmbeddableDeckUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "");

  if (/\.pdf$/i.test(u.pathname)) return url;

  if (host === "drive.google.com") {
    const file = u.pathname.match(/^\/file\/d\/([^/]+)/);
    if (file) return `https://drive.google.com/file/d/${file[1]}/preview`;
  }
  if (host === "docs.google.com") {
    const slides = u.pathname.match(/^\/presentation\/d\/([^/]+)/);
    if (slides) return `https://docs.google.com/presentation/d/${slides[1]}/embed`;
    const doc = u.pathname.match(/^\/document\/d\/([^/]+)/);
    if (doc) return `https://docs.google.com/document/d/${doc[1]}/preview`;
  }
  return null;
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
    if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    if (u.pathname.startsWith("/embed/")) return url;
  }
  return null;
}

export function isDirectVideoUrl(url: string): boolean {
  const u = parse(url);
  return !!u && /\.(mp4|webm|ogg)$/i.test(u.pathname);
}
