import { supabase } from "@/integrations/supabase/client";

export type MyCourse = {
  id: string;
  name: string;
  grade: string | null;
  term: string | null;
  certificate_url: string | null;
  created_at: string;
};

export async function fetchMyCourses(userId: string): Promise<MyCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, grade, term, certificate_url, created_at")
    .eq("twin_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as MyCourse[] | null) ?? [];
}

export async function addCourse(userId: string, fields: { name: string; grade: string; term: string; certificateUrl: string }): Promise<void> {
  const { error } = await supabase.from("courses").insert({
    twin_id: userId,
    name: fields.name.trim(),
    grade: fields.grade.trim() || null,
    term: fields.term.trim() || null,
    certificate_url: fields.certificateUrl.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function updateCourse(id: string, fields: { name: string; grade: string; term: string; certificateUrl: string }): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({
      name: fields.name.trim(),
      grade: fields.grade.trim() || null,
      term: fields.term.trim() || null,
      certificate_url: fields.certificateUrl.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
