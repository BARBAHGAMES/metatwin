import { describe, expect, it } from "vitest";
import { LIMITS, MIN_PASSWORD_LENGTH, validateStudyYear } from "./limits";

describe("validateStudyYear", () => {
  it("allows null and the 1-10 range", () => {
    expect(validateStudyYear(null)).toBeNull();
    expect(validateStudyYear(LIMITS.studyYearMin)).toBeNull();
    expect(validateStudyYear(LIMITS.studyYearMax)).toBeNull();
  });
  it.each([0, -40, 11, 2.5, Number.NaN])("rejects %s", (y) => {
    expect(validateStudyYear(y)).toMatch(/between 1 and 10/);
  });
});

describe("limits", () => {
  it("matches the database CHECK constraints", () => {
    expect(LIMITS.name).toBe(100);
    expect(LIMITS.headline).toBe(160);
    expect(LIMITS.projectDescription).toBe(2000);
    expect(LIMITS.evidenceNote).toBe(1000);
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
