import { supabase } from "@/integrations/supabase/client";

export type AiEmployee = {
  id: string;
  name: string;
  role: string | null;
  platform: string | null;
  description: string | null;
  link_url: string | null;
};

export async function fetchMyAiEmployees(userId: string): Promise<AiEmployee[]> {
  const { data, error } = await supabase
    .from("ai_employees")
    .select("id, name, role, platform, description, link_url")
    .eq("twin_id", userId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addAiEmployee(
  userId: string,
  fields: { name: string; role: string; platform: string; description: string; link_url: string },
): Promise<void> {
  const { error } = await supabase.from("ai_employees").insert({
    twin_id: userId,
    name: fields.name.trim(),
    role: fields.role.trim() || null,
    platform: fields.platform.trim() || null,
    description: fields.description.trim() || null,
    link_url: fields.link_url.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function removeAiEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("ai_employees").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
