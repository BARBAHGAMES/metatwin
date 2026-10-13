import { supabase } from "@/integrations/supabase/client";

export const MKU_EMAIL_DOMAIN = "mku.ac.ke";

export function isValidSchoolAdminEmail(email: string): boolean {
  return new RegExp(`^[^@\\s]+@${MKU_EMAIL_DOMAIN.replace(".", "\\.")}$`, "i").test(email.trim());
}

export type MyCampus = { id: string; name: string };

// Pre-filtered to Mount Kenya University's own campuses — v1 is MKU-only.
export async function fetchMkuCampuses(): Promise<MyCampus[]> {
  const { data, error } = await supabase.from("universities").select("id, name").ilike("name", "%Mount Kenya University%").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type SchoolAdminStatus = {
  status: "pending" | "verified" | "rejected";
  full_name: string;
  university_id: string;
};

export async function fetchMySchoolAdminStatus(userId: string): Promise<SchoolAdminStatus | null> {
  const { data, error } = await supabase.from("school_admins").select("status, full_name, university_id").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SchoolAdminStatus | null;
}

export type InstitutionGrade = {
  id: string;
  student_name: string | null;
  student_handle: string | null;
  project_id: string;
  project_title: string;
  rating_label: string;
  rating_score: number;
  grader_name: string | null;
  comment: string | null;
  graded_at: string;
};

export async function fetchMyInstitutionGrades(): Promise<InstitutionGrade[]> {
  const { data, error } = await supabase.rpc("get_my_institution_grades");
  if (error) throw new Error(error.message);
  return (data as unknown as InstitutionGrade[] | null) ?? [];
}

export type MyProjectGrade = {
  id: string;
  project_id: string;
  rating_label: string;
  rating_score: number;
  grader_name: string | null;
  comment: string | null;
  graded_at: string;
};

export async function fetchMyProjectGrades(): Promise<MyProjectGrade[]> {
  const { data, error } = await supabase.rpc("get_my_project_grades");
  if (error) throw new Error(error.message);
  return (data as unknown as MyProjectGrade[] | null) ?? [];
}
