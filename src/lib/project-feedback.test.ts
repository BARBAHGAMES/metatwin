import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const { aboutEarlierVersion, averageRating, newFeedback } = await import("./project-feedback");

const f = (project_id: string, confirmed_at: string | null, hidden_by_owner = false) => ({ project_id, confirmed_at, hidden_by_owner });

describe("newFeedback (tracked per project)", () => {
  it("only counts feedback confirmed after that project's panel was last opened", () => {
    const items = [f("p1", "2026-10-10T10:00:00Z"), f("p1", "2026-10-12T10:00:00Z"), f("p2", "2026-10-11T10:00:00Z")];
    const seen = { p1: Date.parse("2026-10-11T00:00:00Z") };
    expect(newFeedback(items, seen).map((x) => x.confirmed_at)).toEqual(["2026-10-12T10:00:00Z", "2026-10-11T10:00:00Z"]);
  });
  it("opening one project doesn't clear another's", () => {
    const items = [f("p1", "2026-10-12T10:00:00Z"), f("p2", "2026-10-12T10:00:00Z")];
    expect(newFeedback(items, { p1: Date.parse("2026-10-13T00:00:00Z") })).toEqual([items[1]]);
  });
  it("ignores hidden and unconfirmed feedback", () => {
    expect(newFeedback([f("p1", "2026-10-12T10:00:00Z", true), f("p1", null)], {})).toEqual([]);
  });
});

describe("averageRating / aboutEarlierVersion", () => {
  it("rounds to one decimal and handles empty", () => {
    expect(averageRating([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toBe(4.3);
    expect(averageRating([])).toBeNull();
  });
  it("flags feedback given on a different problem/solution, ignoring whitespace", () => {
    const current = { problem_statement: "Kiosks lose orders", proposed_solution: "WhatsApp bot" };
    expect(aboutEarlierVersion({ problem_statement: " Kiosks lose orders ", proposed_solution: "WhatsApp bot" }, current)).toBe(false);
    expect(aboutEarlierVersion({ problem_statement: "Old text", proposed_solution: "WhatsApp bot" }, current)).toBe(true);
    expect(aboutEarlierVersion(null, { problem_statement: null, proposed_solution: null })).toBe(false);
  });
});
