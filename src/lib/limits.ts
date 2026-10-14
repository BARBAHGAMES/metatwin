// Mirrors the CHECK constraints in the text_length_and_range_limits migration
// (P1-7). Keep the two in sync: the database is the enforcement, these give
// the UI matching maxLength attributes and friendly messages.
export const LIMITS = {
  name: 100,
  firstName: 60,
  lastName: 60,
  headline: 160,
  institution: 120,
  programme: 120,
  bio: 500,
  studyYearMin: 1,
  studyYearMax: 10,
  projectTitle: 120,
  projectDescription: 2000,
  projectProblemStatement: 1000,
  projectProposedSolution: 1000,
  projectUpdateTitle: 120,
  projectUpdateDescription: 1000,
  evidenceTitle: 120,
  evidenceNote: 1000,
  developmentGoal: 300,
  collaborationRequestMessage: 500,
  genderSelfDescribed: 60,
} as const;

export const MIN_PASSWORD_LENGTH = 8;

export function validateStudyYear(year: number | null): string | null {
  if (year === null) return null;
  if (!Number.isInteger(year) || year < LIMITS.studyYearMin || year > LIMITS.studyYearMax) {
    return `Year of study must be between ${LIMITS.studyYearMin} and ${LIMITS.studyYearMax}.`;
  }
  return null;
}
