import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years — long-lived so the link doesn't need refreshing

// Uploads to a private bucket and returns a long-lived signed URL, stored
// directly on twins.photo_url — public profile pages can then render the
// photo without the bucket itself needing to be public.
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_BYTES) throw new Error("Image must be under 5MB.");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error: signError } = await supabase.storage.from("avatars").createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signError || !data) throw new Error(signError?.message ?? "Could not create a link for the photo.");
  return data.signedUrl;
}
