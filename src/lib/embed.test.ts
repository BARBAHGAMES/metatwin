import { describe, expect, it } from "vitest";
import { toEmbeddableDeckUrl, toYouTubeEmbedUrl, isDirectVideoUrl, toVideoEmbed, describeDeckLink, describeVideoLink } from "./embed";

describe("toEmbeddableDeckUrl", () => {
  it("passes through a direct PDF link", () => {
    expect(toEmbeddableDeckUrl("https://example.com/deck.pdf")).toBe("https://example.com/deck.pdf");
  });

  it("rewrites a Google Drive share link to its preview form", () => {
    expect(toEmbeddableDeckUrl("https://drive.google.com/file/d/abc123/view?usp=sharing")).toBe("https://drive.google.com/file/d/abc123/preview");
  });

  it("rewrites a Google Slides link to its embed form", () => {
    expect(toEmbeddableDeckUrl("https://docs.google.com/presentation/d/xyz789/edit#slide=id.p")).toBe("https://docs.google.com/presentation/d/xyz789/embed");
  });

  it("rewrites a Google Docs link to its preview form", () => {
    expect(toEmbeddableDeckUrl("https://docs.google.com/document/d/qqq111/edit")).toBe("https://docs.google.com/document/d/qqq111/preview");
  });

  it.each(["https://example.com/deck", "javascript:alert(1)", "not a url", ""])("returns null for %j", (url) =>
    expect(toEmbeddableDeckUrl(url)).toBeNull(),
  );
});

describe("toYouTubeEmbedUrl", () => {
  it("converts a youtu.be short link", () => {
    expect(toYouTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("converts a youtube.com/watch link, keeping the start time", () => {
    expect(toYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?start=10");
  });

  it("converts a shorts link", () => {
    expect(toYouTubeEmbedUrl("https://youtube.com/shorts/abc123")).toBe("https://www.youtube.com/embed/abc123");
  });

  it("passes through an already-embed link", () => {
    expect(toYouTubeEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it.each(["https://vimeo.com/123", "https://example.com/deck.pdf", "javascript:alert(1)", ""])("returns null for %j", (url) =>
    expect(toYouTubeEmbedUrl(url)).toBeNull(),
  );
});

describe("isDirectVideoUrl", () => {
  it.each(["https://example.com/pitch.mp4", "https://example.com/pitch.webm", "https://example.com/pitch.ogg"])("accepts %s", (url) =>
    expect(isDirectVideoUrl(url)).toBe(true),
  );

  it.each(["https://youtu.be/dQw4w9WgXcQ", "https://example.com/pitch.pdf", "javascript:alert(1)", ""])("rejects %j", (url) =>
    expect(isDirectVideoUrl(url)).toBe(false),
  );
});

// Link shapes students actually paste (PITCH_FLOW_AUDIT.md §2B).
const SLIDES_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg";
describe("toEmbeddableDeckUrl: real-world Google shapes", () => {
  it("handles a 'Publish to the web' Slides link (was rewritten to /d/e/embed)", () => {
    expect(toEmbeddableDeckUrl("https://docs.google.com/presentation/d/e/2PACX-1vQabc_def-123/pub?start=false&loop=false&delayms=3000"))
      .toBe("https://docs.google.com/presentation/d/e/2PACX-1vQabc_def-123/embed");
    expect(toEmbeddableDeckUrl("https://docs.google.com/presentation/d/e/2PACX-1vQabc_def-123/embed?start=false"))
      .toBe("https://docs.google.com/presentation/d/e/2PACX-1vQabc_def-123/embed");
  });
  it("handles a published Google Doc", () => {
    expect(toEmbeddableDeckUrl("https://docs.google.com/document/d/e/2PACX-1vDoc123/pub")).toBe("https://docs.google.com/document/d/e/2PACX-1vDoc123/pub?embedded=true");
  });
  it("handles a second-account (/u/1/) Slides link", () => {
    expect(toEmbeddableDeckUrl(`https://docs.google.com/presentation/u/1/d/${SLIDES_ID}/edit`)).toBe(`https://docs.google.com/presentation/d/${SLIDES_ID}/embed`);
  });
  it("handles Drive open?id= and uc?id= links", () => {
    expect(toEmbeddableDeckUrl("https://drive.google.com/open?id=1FiLeIdAbCdEfGhIjKlMnOp")).toBe("https://drive.google.com/file/d/1FiLeIdAbCdEfGhIjKlMnOp/preview");
    expect(toEmbeddableDeckUrl("https://drive.google.com/uc?id=1FiLeIdAbCdEfGhIjKlMnOp&export=download")).toBe("https://drive.google.com/file/d/1FiLeIdAbCdEfGhIjKlMnOp/preview");
  });
  it("never returns a URL on a host outside the CSP frame-src allow-list", () => {
    for (const url of ["https://www.canva.com/design/DAF1/view", "https://evil.example/presentation/d/abc/edit", "https://docs.google.com.evil.example/presentation/d/abc/edit"]) {
      expect(toEmbeddableDeckUrl(url), url).toBeNull();
    }
  });
});

describe("toVideoEmbed", () => {
  it("plays YouTube (incl. /live/ and youtu.be with tracking params)", () => {
    expect(toVideoEmbed("https://www.youtube.com/live/dQw4w9WgXcQ?si=x")).toEqual({ type: "iframe", src: "https://www.youtube.com/embed/dQw4w9WgXcQ" });
    expect(toVideoEmbed("https://youtu.be/dQw4w9WgXcQ?si=abc&t=1m5s")).toEqual({ type: "iframe", src: "https://www.youtube.com/embed/dQw4w9WgXcQ?start=65" });
  });
  it("plays a video uploaded to Google Drive", () => {
    expect(toVideoEmbed("https://drive.google.com/file/d/1ViDeOiDaBcDeF/view?usp=drive_link")).toEqual({ type: "iframe", src: "https://drive.google.com/file/d/1ViDeOiDaBcDeF/preview" });
  });
  it("plays a direct video file and refuses unknown hosts", () => {
    expect(toVideoEmbed("https://example.com/pitch.mp4")).toEqual({ type: "video", src: "https://example.com/pitch.mp4" });
    expect(toVideoEmbed("https://vimeo.com/123456789")).toBeNull();
    expect(toVideoEmbed("javascript:alert(1)")).toBeNull();
  });
});

describe("describeDeckLink / describeVideoLink", () => {
  it("flags Google links for the 'Anyone with the link' sharing prompt", () => {
    expect(describeDeckLink(`https://docs.google.com/presentation/d/${SLIDES_ID}/edit?usp=sharing`)).toMatchObject({ label: "Google Slides", inline: true, sharing: "google" });
    expect(describeVideoLink("https://drive.google.com/file/d/1ViDeOiDaBcDeF/view")).toMatchObject({ label: "Google Drive video", inline: true, sharing: "google" });
  });
  it("names new-tab providers instead of failing silently", () => {
    expect(describeDeckLink("https://www.canva.com/design/DAFabcd1234/view")).toMatchObject({ label: "Canva", inline: false, sharing: "canva" });
    expect(describeVideoLink("https://www.loom.com/share/abc")).toMatchObject({ label: "Loom", inline: false });
  });
  it("rejects non-http input and ignores empty input", () => {
    expect(describeDeckLink("javascript:alert(1)")).toMatchObject({ valid: false });
    expect(describeDeckLink("   ")).toBeNull();
  });
});
