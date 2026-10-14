import { describe, expect, it } from "vitest";
import { completionReasonLabel, nextInterviewTarget, STAGE_LABELS } from "./project-stage";

describe("STAGE_LABELS", () => {
  it("has a label for every stage", () => {
    expect(STAGE_LABELS).toEqual({
      idea: "Idea",
      in_progress: "In Progress",
      prototype: "Prototype",
      completed: "Completed",
    });
  });
});

describe("nextInterviewTarget", () => {
  it("is 10 at idea, 40 at in_progress, and null once there's no further interview gate", () => {
    expect(nextInterviewTarget("idea")).toBe(10);
    expect(nextInterviewTarget("in_progress")).toBe(40);
    expect(nextInterviewTarget("prototype")).toBeNull();
    expect(nextInterviewTarget("completed")).toBeNull();
  });
});

describe("completionReasonLabel", () => {
  it("maps known reasons to plain language and passes through anything else", () => {
    expect(completionReasonLabel("abandoned")).toBe("The team abandoned it");
    expect(completionReasonLabel("business_adopted")).toBe("A business adopted it");
    expect(completionReasonLabel(null)).toBeNull();
    expect(completionReasonLabel("something_unexpected")).toBe("something_unexpected");
  });
});
