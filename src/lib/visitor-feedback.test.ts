import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizeWhatsapp, validateFeedback, type FeedbackInput } from "./visitor-feedback";

describe("normalizeWhatsapp", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["0712 345 678", "+254712345678"],
    ["712345678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["+254 712-345-678", "+254712345678"],
    ["0110123456", "+254110123456"],
    ["+1 (415) 555-0100", "+14155550100"],
    ["+44 7700 900123", "+447700900123"],
  ])("%s -> %s", (input, expected) => expect(normalizeWhatsapp(input)).toBe(expected));

  it.each(["", "12345", "0812345678", "abc", "+0123456789", "07123456789999", "+254 712 345 678 ext 9"])("rejects %j", (input) =>
    expect(normalizeWhatsapp(input)).toBeNull(),
  );
});

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => expect(normalizeEmail("  Wanjiru@Example.CO.KE ")).toBe("wanjiru@example.co.ke"));
  it.each(["", "no-at-sign", "a@b", "a b@c.de", `${"x".repeat(250)}@e.com`])("rejects %j", (e) => expect(normalizeEmail(e)).toBeNull());
});

const good: FeedbackInput = {
  handle: " Amina ",
  projectId: "bbbbbbbb-0000-4000-8000-000000000001",
  rating: 4,
  comment: "  Clear problem. Test pricing next.  ",
  name: " Wanjiru K ",
  role: "business_owner",
  org: "",
  email: "W@Example.com",
  whatsapp: "0712 345 678",
  consent: true,
};

describe("validateFeedback", () => {
  it("cleans valid input", () => {
    const r = validateFeedback(good);
    expect(r).toEqual({
      ok: true,
      value: { ...good, handle: "amina", comment: "Clear problem. Test pricing next.", name: "Wanjiru K", org: null, email: "w@example.com", whatsapp: "+254712345678", consent: true },
    });
  });

  it("reports every bad field at once", () => {
    const r = validateFeedback({ ...good, rating: 0, comment: "see www.spam.example", name: "", role: "ceo", email: "x", whatsapp: "123", projectId: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["comment", "email", "name", "projectId", "rating", "role", "whatsapp"]);
  });

  it("caps the comment at 500 characters and treats consent as opt-in", () => {
    expect(validateFeedback({ ...good, comment: "x".repeat(501) }).ok).toBe(false);
    const r = validateFeedback({ ...good, consent: "yes" as unknown as boolean });
    expect(r.ok && r.value.consent).toBe(false);
  });
});
