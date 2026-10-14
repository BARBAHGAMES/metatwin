// Mirrors the twins.mbti_type CHECK constraint (the 16 standard MBTI types).
export const MBTI_TYPES: { code: string; label: string }[] = [
  { code: "INTJ", label: "Architect" },
  { code: "INTP", label: "Logician" },
  { code: "ENTJ", label: "Commander" },
  { code: "ENTP", label: "Debater" },
  { code: "INFJ", label: "Advocate" },
  { code: "INFP", label: "Mediator" },
  { code: "ENFJ", label: "Protagonist" },
  { code: "ENFP", label: "Campaigner" },
  { code: "ISTJ", label: "Logistician" },
  { code: "ISFJ", label: "Defender" },
  { code: "ESTJ", label: "Executive" },
  { code: "ESFJ", label: "Consul" },
  { code: "ISTP", label: "Virtuoso" },
  { code: "ISFP", label: "Adventurer" },
  { code: "ESTP", label: "Entrepreneur" },
  { code: "ESFP", label: "Entertainer" },
];

// Mirrors the twins.gender CHECK constraint. Private — never shown on the
// public profile, same treatment as birth_year.
export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "self_described", label: "Self-describe" },
] as const;
