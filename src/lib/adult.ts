// v1 is 18+ only. Age is self-declared as a birth year plus an explicit
// "I am 18 or older" confirmation (the database re-checks both; see the
// P0-2 migration). Birth year alone can't separate a 17- from an 18-year-old
// born in the same year, so the explicit confirmation carries that edge.
export const UNDER_18_MESSAGE = "MetaTwin v1 is for students aged 18 or older.";

export function latestAdultBirthYear(now = new Date()): number {
  return now.getFullYear() - 18;
}

export function validateBirthYear(raw: string, now = new Date()): { year: number } | { error: string } {
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > now.getFullYear()) {
    return { error: "Enter a valid birth year." };
  }
  if (year > latestAdultBirthYear(now)) return { error: UNDER_18_MESSAGE };
  return { year };
}
