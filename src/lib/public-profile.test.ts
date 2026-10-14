import { describe, expect, it } from "vitest";
import { buildPublicProjectJourney, normalizeHandle, publicProfilePath, validateHandle, type PublicProject } from "./public-profile";

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

describe("buildPublicProjectJourney", () => {
  const project: PublicProject = {
    id: "p1",
    title: "AquaLoop",
    description: "Greywater filter",
    created_at: "2026-09-01T10:00:00Z",
    problem_statement: null,
    proposed_solution: null,
    stage: "idea",
  };

  it("never includes pitches (business names/notes aren't public) but does include updates and grades", () => {
    const steps = buildPublicProjectJourney({
      ...project,
      project_updates: [{ id: "u1", kind: "pivot", title: "Changed direction", description: null, created_at: "2026-10-01T00:00:00Z" }],
      grades: [{ rating_label: "Good", rating_score: 3, graded_at: "2026-09-20" }],
    });
    expect(steps.map((s) => s.step)).toEqual(["Project started", "Academic grade", "Pivot"]);
  });

  it("is just the start event when there's nothing else public yet", () => {
    const steps = buildPublicProjectJourney(project);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ step: "Project started", text: "Greywater filter" });
  });
});
