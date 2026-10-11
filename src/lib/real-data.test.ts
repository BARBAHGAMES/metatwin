import { describe, expect, it } from "vitest";
import { buildProjectTimeline, formatDate, isUuid } from "./real-data";

describe("isUuid", () => {
  it("accepts uuids and rejects sample ids", () => {
    expect(isUuid("3f2b8c1e-9d4a-4b6e-8a1f-0c7d5e2a9b34")).toBe(true);
    expect(isUuid("aqualoop-filter")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("formatDate", () => {
  it("is deterministic (UTC, fixed month names)", () => {
    expect(formatDate("2026-10-11T23:30:00Z")).toBe("11 Oct 2026");
  });
});

describe("buildProjectTimeline", () => {
  const project = { title: "AquaLoop", description: "Greywater filter", created_at: "2026-09-01T10:00:00Z" };

  it("starts with the project and orders evidence by real date", () => {
    const steps = buildProjectTimeline(project, [
      { title: "Pilot results", note: "Lead modeller", link: "https://github.com/x/y", created_at: "2026-10-05T08:00:00Z" },
      { title: "First sketch", note: null, link: null, created_at: "2026-09-10T08:00:00Z" },
    ]);
    expect(steps.map((s) => s.step)).toEqual(["Project started", "Evidence added", "Evidence added"]);
    expect(steps[0]).toMatchObject({ date: "1 Sep 2026", text: "Greywater filter" });
    expect(steps[1]).toMatchObject({ text: "First sketch" });
    expect(steps[2]).toMatchObject({ text: "Pilot results — Lead modeller", material: "github.com" });
    expect(steps[1]).not.toHaveProperty("material");
  });

  it("falls back to the title when there is no description, and ignores bad links", () => {
    const steps = buildProjectTimeline({ ...project, description: null }, [
      { title: "Note", note: null, link: "not a url", created_at: "2026-09-02T00:00:00Z" },
    ]);
    expect(steps[0].text).toBe("AquaLoop");
    expect(steps[1]).not.toHaveProperty("material");
  });
});
