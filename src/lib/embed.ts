// Turns a pasted deck/video link into an inline-embeddable URL when we know
// how (a direct PDF, a Google Drive/Docs/Slides link, a YouTube or Drive
// video), or returns null so the caller falls back to a plain "open in a new
// tab" link instead of forcing a broken iframe. Also describes a link for the
// student while they paste it (what it is, whether it plays inline, and
// whether its sharing setting matters).
//
// Only hosts allowed by the CSP's frame-src (src/server.ts) may be returned as
// iframe sources: docs.google.com, drive.google.com, www.youtube.com.
import { isHttpUrl } from "./url";

function parse(url: string): URL | null {
  if (!isHttpUrl(url)) return null;
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

const hostOf = (u: URL) => u.hostname.replace(/^www\./, "").toLowerCase();
const ID = "([A-Za-z0-9_-]+)";

type GoogleRef =
  | { app: "slides" | "docs" | "drive"; id: string; published?: false }
  | { app: "slides" | "docs"; id: string; published: true };

// Google file id from any of the shapes students paste:
//   docs.google.com/presentation/d/<id>/edit?usp=sharing   (share link)
//   docs.google.com/presentation/u/1/d/<id>/edit           (second signed-in account)
//   docs.google.com/presentation/d/e/<pubId>/pub|embed     ("Publish to the web")
//   drive.google.com/file/d/<id>/view | open?id=<id> | uc?id=<id>
function googleRef(u: URL): GoogleRef | null {
  const host = hostOf(u);
  if (host === "docs.google.com") {
    const pub = u.pathname.match(new RegExp(`^/(presentation|document)/d/e/${ID}/`));
    if (pub) return { app: pub[1] === "presentation" ? "slides" : "docs", id: pub[2]!, published: true };
    const file = u.pathname.match(new RegExp(`^/(presentation|document)/(?:u/\\d+/)?d/${ID}(?:/|$)`));
    if (file) return { app: file[1] === "presentation" ? "slides" : "docs", id: file[2]! };
  }
  if (host === "drive.google.com") {
    const file = u.pathname.match(new RegExp(`^/(?:u/\\d+/)?file/(?:u/\\d+/)?d/${ID}(?:/|$)`));
    if (file) return { app: "drive", id: file[1]! };
    const qid = u.searchParams.get("id");
    if ((u.pathname === "/open" || u.pathname === "/uc") && qid && new RegExp(`^${ID}$`).test(qid)) return { app: "drive", id: qid };
  }
  return null;
}

export function toEmbeddableDeckUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  if (/\.pdf$/i.test(u.pathname)) return u.toString();
  const ref = googleRef(u);
  if (!ref) return null;
  if (ref.published) {
    return ref.app === "slides"
      ? `https://docs.google.com/presentation/d/e/${ref.id}/embed`
      : `https://docs.google.com/document/d/e/${ref.id}/pub?embedded=true`;
  }
  if (ref.app === "slides") return `https://docs.google.com/presentation/d/${ref.id}/embed`;
  if (ref.app === "docs") return `https://docs.google.com/document/d/${ref.id}/preview`;
  return `https://drive.google.com/file/d/${ref.id}/preview`;
}

// "30", "30s", "1m30s", "1h2m3s" -> seconds
function parseStart(t: string | null): number | null {
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const u = parse(url);
  if (!u) return null;
  const host = hostOf(u);
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    const path = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
    if (path) id = path[1]!;
  }
  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  const start = parseStart(u.searchParams.get("t") ?? u.searchParams.get("start"));
  return `https://www.youtube.com/embed/${id}${start ? `?start=${start}` : ""}`;
}

export function isDirectVideoUrl(url: string): boolean {
  const u = parse(url);
  return !!u && /\.(mp4|webm|ogg)$/i.test(u.pathname);
}

/** How to play a pitch video inline: an iframe (YouTube, Google Drive), a <video> (direct file), or null. */
export function toVideoEmbed(url: string): { type: "iframe" | "video"; src: string } | null {
  const yt = toYouTubeEmbedUrl(url);
  if (yt) return { type: "iframe", src: yt };
  const u = parse(url);
  if (!u) return null;
  const ref = googleRef(u);
  if (ref?.app === "drive") return { type: "iframe", src: `https://drive.google.com/file/d/${ref.id}/preview` };
  if (isDirectVideoUrl(url)) return { type: "video", src: u.toString() };
  return null;
}

export type LinkDescription = {
  /** Short name of what was recognised, e.g. "Google Slides". */
  label: string;
  /** True if MetaTwin can show it inside the page. */
  inline: boolean;
  /** Which sharing advice applies, if any. */
  sharing: "google" | "youtube" | "canva" | null;
  valid: boolean;
};

const NEW_TAB_PROVIDERS: Record<string, string> = {
  "canva.com": "Canva",
  "1drv.ms": "OneDrive / PowerPoint",
  "onedrive.live.com": "OneDrive / PowerPoint",
  "pitch.com": "Pitch",
  "gamma.app": "Gamma",
  "figma.com": "Figma",
  "loom.com": "Loom",
  "vimeo.com": "Vimeo",
  "tiktok.com": "TikTok",
  "dropbox.com": "Dropbox",
};

function newTabProvider(u: URL): string | null {
  const host = hostOf(u);
  for (const [domain, name] of Object.entries(NEW_TAB_PROVIDERS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  return null;
}

/** Describes a pasted pitch-deck link for the student (recognition + whether it plays inline). */
export function describeDeckLink(url: string): LinkDescription | null {
  if (!url.trim()) return null;
  const u = parse(url);
  if (!u) return { label: "Not a valid link (it should start with https://)", inline: false, sharing: null, valid: false };
  if (/\.pdf$/i.test(u.pathname)) return { label: "PDF file", inline: true, sharing: null, valid: true };
  const ref = googleRef(u);
  if (ref) {
    const label = ref.app === "slides" ? "Google Slides" : ref.app === "docs" ? "Google Docs" : "Google Drive file";
    return { label: ref.published ? `${label} (published to the web)` : label, inline: true, sharing: "google", valid: true };
  }
  const provider = newTabProvider(u);
  if (provider) return { label: provider, inline: false, sharing: provider === "Canva" ? "canva" : null, valid: true };
  return { label: "Link", inline: false, sharing: null, valid: true };
}

/** Describes a pasted pitch-video link for the student. */
export function describeVideoLink(url: string): LinkDescription | null {
  if (!url.trim()) return null;
  const u = parse(url);
  if (!u) return { label: "Not a valid link (it should start with https://)", inline: false, sharing: null, valid: false };
  if (toYouTubeEmbedUrl(url)) return { label: "YouTube video", inline: true, sharing: "youtube", valid: true };
  const ref = googleRef(u);
  if (ref?.app === "drive") return { label: "Google Drive video", inline: true, sharing: "google", valid: true };
  if (isDirectVideoUrl(url)) return { label: "Video file", inline: true, sharing: null, valid: true };
  const provider = newTabProvider(u);
  return { label: provider ?? "Link", inline: false, sharing: null, valid: true };
}
