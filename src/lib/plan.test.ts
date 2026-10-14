import { describe, expect, it } from "vitest";
import { hasActivePlan, hasActiveTeamPlan, teamSeatCap } from "./plan";

describe("hasActivePlan", () => {
  it("grandfathered twins are always active, regardless of plan_paid_until", () => {
    expect(hasActivePlan({ plan_status: "grandfathered", plan_paid_until: null })).toBe(true);
    expect(hasActivePlan({ plan_status: "grandfathered", plan_paid_until: "2000-01-01T00:00:00Z" })).toBe(true);
  });

  it("unpaid twins are never active", () => {
    expect(hasActivePlan({ plan_status: "unpaid", plan_paid_until: null })).toBe(false);
  });

  it("paid twins are active only while plan_paid_until is in the future", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(hasActivePlan({ plan_status: "paid", plan_paid_until: future })).toBe(true);
    expect(hasActivePlan({ plan_status: "paid", plan_paid_until: past })).toBe(false);
  });

  it("a paid twin with no plan_paid_until is not active (shouldn't happen, but fail closed)", () => {
    expect(hasActivePlan({ plan_status: "paid", plan_paid_until: null })).toBe(false);
  });
});

describe("hasActiveTeamPlan", () => {
  it("has no 'grandfathered' status — unpaid is never active", () => {
    expect(hasActiveTeamPlan({ plan_status: "unpaid", plan_paid_until: null })).toBe(false);
  });

  it("paid teams are active only while plan_paid_until is in the future", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(hasActiveTeamPlan({ plan_status: "paid", plan_paid_until: future })).toBe(true);
    expect(hasActiveTeamPlan({ plan_status: "paid", plan_paid_until: past })).toBe(false);
  });
});

describe("teamSeatCap", () => {
  it("maps each package to its member count", () => {
    expect(teamSeatCap("duo")).toBe(2);
    expect(teamSeatCap("studio")).toBe(3);
    expect(teamSeatCap("launch")).toBe(5);
  });

  it("an unpaid/no-package team caps at 1 (just the creator)", () => {
    expect(teamSeatCap(null)).toBe(1);
    expect(teamSeatCap("something-unexpected")).toBe(1);
  });
});
