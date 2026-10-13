import { describe, expect, it } from "vitest";
import { isValidSchoolAdminEmail } from "./school-admin";

describe("isValidSchoolAdminEmail", () => {
  it.each(["staff@mku.ac.ke", "Jane.Doe@MKU.AC.KE", "  lecturer@mku.ac.ke  "])("accepts %s", (email) =>
    expect(isValidSchoolAdminEmail(email)).toBe(true),
  );

  it.each([
    "staff@gmail.com",
    "staff@fakemku.ac.ke",
    "staff@mku.ac.ke.evil.com",
    "staff@sub.mku.ac.ke",
    "@mku.ac.ke",
    "staff mku.ac.ke",
    "",
  ])("rejects %j", (email) => expect(isValidSchoolAdminEmail(email)).toBe(false));
});
