import { describe, expect, it } from "vitest";
import { isHttpUrl, safeHref } from "./url";

describe("isHttpUrl", () => {
  it.each([
    "https://example.com",
    "http://example.com/path?q=1#frag",
    "HTTPS://Example.com/A",
    "https://drive.google.com/file/d/abc/view?usp=sharing",
  ])("accepts %s", (url) => expect(isHttpUrl(url)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "vbscript:x",
    "//evil.com",
    "ftp://example.com/f",
    "https://",
    "https://exa mple.com",
    "https://example.com\n",
    "",
  ])("rejects %j", (url) => expect(isHttpUrl(url)).toBe(false));

  it("rejects URLs over 2048 characters", () => {
    expect(isHttpUrl("https://e.com/" + "a".repeat(2100))).toBe(false);
  });
});

describe("safeHref", () => {
  it("passes http(s) through and drops everything else", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});
