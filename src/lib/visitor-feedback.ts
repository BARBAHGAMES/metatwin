// Visitor feedback: shared, client-safe rules (no server imports). Used by the
// public feedback form for instant validation and by the server route
// (visitor-feedback-route.server.ts) as the real check. The database CHECK
// constraints in 20261015200100_add_project_feedback.sql are the final backstop.

export const FEEDBACK_ROLES = [
  { id: "business_owner", label: "Business owner" },
  { id: "investor", label: "Investor" },
  { id: "lecturer", label: "Lecturer" },
  { id: "mentor", label: "Mentor" },
  { id: "student", label: "Student" },
  { id: "other", label: "Other" },
] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number]["id"];

export const FEEDBACK_LIMITS = { comment: 500, name: 100, org: 120, email: 254 } as const;

export function feedbackRoleLabel(role: string): string {
  return FEEDBACK_ROLES.find((r) => r.id === role)?.label ?? "Other";
}

/**
 * Normalises a WhatsApp number to +<country><number> (E.164). Kenyan formats are
 * the default: 0712 345 678, 712345678, 254712345678 and +254 712 345 678 all become
 * +254712345678. Other countries must be entered with + and their country code.
 * Format check only: the number is not verified (pitch flow D8).
 */
export function normalizeWhatsapp(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  let e164: string;
  if (hasPlus) e164 = `+${digits}`;
  else if (/^0[17]\d{8}$/.test(digits)) e164 = `+254${digits.slice(1)}`;
  else if (/^[17]\d{8}$/.test(digits)) e164 = `+254${digits}`;
  else if (/^254[17]\d{8}$/.test(digits)) e164 = `+${digits}`;
  else return null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (!email || email.length > FEEDBACK_LIMITS.email) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

export const LINK_PATTERN = /(https?:\/\/|www\.)/i;

export type FeedbackInput = {
  handle: string;
  projectId: string;
  rating: number;
  comment: string;
  name: string;
  role: string;
  org: string;
  email: string;
  whatsapp: string;
  consent: boolean;
};

export type ValidFeedback = Omit<FeedbackInput, "org" | "role"> & { org: string | null; role: FeedbackRole };

/** Returns either the cleaned input or a map of field -> message for the form. */
export function validateFeedback(input: FeedbackInput): { ok: true; value: ValidFeedback } | { ok: false; errors: Partial<Record<keyof FeedbackInput, string>> } {
  const errors: Partial<Record<keyof FeedbackInput, string>> = {};
  const comment = input.comment.trim();
  const name = input.name.trim();
  const org = input.org.trim();
  const email = normalizeEmail(input.email);
  const whatsapp = normalizeWhatsapp(input.whatsapp);

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.rating = "Choose a rating from 1 to 5 stars.";
  if (!comment) errors.comment = "Add a short comment.";
  else if (comment.length > FEEDBACK_LIMITS.comment) errors.comment = `Keep it under ${FEEDBACK_LIMITS.comment} characters.`;
  else if (LINK_PATTERN.test(comment)) errors.comment = "Please leave out links.";
  if (!name) errors.name = "Add your name.";
  else if (name.length > FEEDBACK_LIMITS.name) errors.name = "That name is too long.";
  if (!FEEDBACK_ROLES.some((r) => r.id === input.role)) errors.role = "Choose your role.";
  if (org.length > FEEDBACK_LIMITS.org) errors.org = "That organisation name is too long.";
  if (!email) errors.email = "Enter a valid email. We'll send a link to confirm it.";
  if (!whatsapp) errors.whatsapp = "Enter a WhatsApp number, e.g. 0712 345 678 or +254 712 345 678.";
  if (!/^[0-9a-f-]{36}$/i.test(input.projectId) || !input.handle.trim()) errors.projectId = "Something went wrong. Reload the page.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      handle: input.handle.trim().toLowerCase(),
      projectId: input.projectId,
      rating: input.rating,
      comment,
      name,
      role: input.role as FeedbackRole,
      org: org || null,
      email: email!,
      whatsapp: whatsapp!,
      consent: input.consent === true,
    },
  };
}

/** Confirmation tokens are 32 random bytes, base64url (43 chars). */
export const CONFIRM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
