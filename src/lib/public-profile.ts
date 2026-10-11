import { supabase } from "@/integrations/supabase/client";

// Mirrors twins_handle_format in the public_profile_handle_and_function
// migration (P1-5): 3-30 chars, lowercase letters/digits/hyphens, starting and
// ending with a letter or digit, minus a small reserved list. The database is
// the enforcement; this gives instant feedback.
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED_HANDLES = new Set([
  "admin", "api", "www", "metatwin", "support", "help", "login", "signup",
  "dashboard", "profile", "about", "pricing", "null", "undefined",
]);

export const HANDLE_HELP =
  "3–30 characters: lowercase letters, numbers and hyphens, starting and ending with a letter or number.";

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateHandle(raw: string): string | null {
  const handle = normalizeHandle(raw);
  if (!HANDLE_RE.test(handle)) return HANDLE_HELP;
  if (RESERVED_HANDLES.has(handle)) return "That handle is reserved. Please choose another.";
  return null;
}

export function publicProfilePath(handle: string): string {
  return `/t/${handle}`;
}

export type PublicEvidence = { id: string; title: string; link?: string | null; note?: string | null };
export type PublicCapability = {
  id: string;
  skill: string;
  category: string | null;
  level: number;
  evidence_count: number;
  evidence: PublicEvidence[];
};
export type PublicProject = { id: string; title: string; description: string | null; artifact_url?: string | null };
export type PublicProfile = {
  handle: string;
  name: string | null;
  headline: string | null;
  institution: string | null;
  programme: string | null;
  show_evidence_details: boolean;
  capabilities: PublicCapability[];
  projects: PublicProject[];
};

// The only anonymous read path: one handle in, a fixed set of fields out.
// Returns null for unknown, private, or non-adult profiles alike, so a visitor
// can't tell which handles exist.
export async function fetchPublicProfile(handle: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { p_handle: handle });
  if (error) throw new Error(error.message);
  return (data as PublicProfile | null) ?? null;
}
