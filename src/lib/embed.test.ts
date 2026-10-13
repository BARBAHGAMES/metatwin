import { describe, expect, it } from "vitest";
import { toEmbeddableDeckUrl, toYouTubeEmbedUrl, isDirectVideoUrl } from "./embed";

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

  it("converts a youtube.com/watch link", () => {
    expect(toYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
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
