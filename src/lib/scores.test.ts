import { describe, expect, it } from "vitest";
import { parseCsv, summarizeScores } from "./scores";

describe("parseCsv", () => {
  it("splits a simple csv into rows and cells", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted cells containing commas and escaped quotes", () => {
    expect(parseCsv('"hello, world","she said ""hi"""\n1,2')).toEqual([
      ["hello, world", 'she said "hi"'],
      ["1", "2"],
    ]);
  });

  it("handles CRLF and bare LF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("drops fully blank rows", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("summarizeScores", () => {
  it("averages numeric columns and skips timestamp/email/name columns", () => {
    const csv = ["Timestamp,Email,Judge name,Clarity (1-5),Execution (1-10)", "t1,a@b.com,Judge A,4,8", "t2,c@d.com,Judge B,5,6"].join("\n");
    const result = summarizeScores(csv);
    expect(result.responses).toBe(2);
    expect(result.questions).toEqual([
      { label: "Clarity (1-5)", average: 4.5, max: 5 },
      { label: "Execution (1-10)", average: 7, max: 10 },
    ]);
    expect(result.overall).toBeCloseTo(((4.5 / 5) * 10 + (7 / 10) * 10) / 2, 5);
  });

  it("skips a column that contains any non-numeric value", () => {
    const csv = ["Name,Score,Comment", "a,8,great", "b,9,n/a"].join("\n");
    const result = summarizeScores(csv);
    expect(result.questions.map((q) => q.label)).toEqual(["Score"]);
  });

  it("returns a null overall and empty questions for a header-only csv", () => {
    const result = summarizeScores("Timestamp,Email,Name");
    expect(result).toEqual({ responses: 0, questions: [], overall: null });
  });

  it("returns a null overall for completely empty input", () => {
    expect(summarizeScores("")).toEqual({ responses: 0, questions: [], overall: null });
  });
});
