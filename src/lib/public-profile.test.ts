import { describe, expect, it } from "vitest";
import { normalizeHandle, publicProfilePath, validateHandle } from "./public-profile";

describe("validateHandle (mirrors twins_handle_format)", () => {
  it.each(["abc", "a-b", "amina-o", "ok-handle-1", "a".repeat(30), "x9y"])("accepts %s", (h) => {
    expect(validateHandle(h)).toBeNull();
  });

  it.each(["", "ab", "-bad-", "bad-", "-bad", "has space", "a_b", "a.b", "a".repeat(31), "émile", "<script>"])(
    "rejects %j",
    (h) => expect(validateHandle(h)).not.toBeNull(),
  );

  it.each(["admin", "metatwin", "support", "login", "NULL"])("rejects reserved %s", (h) => {
    expect(validateHandle(h)).toMatch(/reserved/);
  });

  it("is case- and whitespace-insensitive like the database lookup", () => {
    expect(normalizeHandle("  Amina-O ")).toBe("amina-o");
    expect(validateHandle("  Amina-O ")).toBeNull();
  });
});

describe("publicProfilePath", () => {
  it("builds the shareable path", () => {
    expect(publicProfilePath("amina-o")).toBe("/t/amina-o");
  });
});
