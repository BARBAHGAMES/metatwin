// Parse a Google Form response sheet (published as CSV) into average scores
// per numeric question. Pure functions — safe to import from client or
// server code; the actual network fetch of the CSV happens server-side (see
// pitch-feedback-sync-route.server.ts), this only parses the text.
export type PitchScores = { responses: number; questions: { label: string; average: number; max: number }[]; overall: number | null };

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

export function summarizeScores(csv: string): PitchScores {
  const [header, ...body] = parseCsv(csv);
  if (!header) return { responses: 0, questions: [], overall: null };
  const questions: PitchScores["questions"] = [];
  header.forEach((label, col) => {
    if (/timestamp|email|name/i.test(label)) return;
    const vals = body.map((r) => r[col]?.trim() ?? "").filter((v) => v !== "");
    if (vals.length === 0) return;
    const nums = vals.map(Number);
    if (nums.some((n) => Number.isNaN(n))) return;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const max = Math.max(...nums) <= 5 ? 5 : 10;
    questions.push({ label: label.trim(), average: Math.round(avg * 10) / 10, max });
  });
  const overall = questions.length
    ? Math.round((questions.reduce((a, q) => a + (q.average / q.max) * 10, 0) / questions.length) * 10) / 10
    : null;
  return { responses: body.length, questions, overall };
}
