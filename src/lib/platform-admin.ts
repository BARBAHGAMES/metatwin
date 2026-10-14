import { supabase } from "@/integrations/supabase/client";

export type PlatformAdminStatus = {
  status: "pending" | "verified" | "rejected";
  full_name: string;
};

export async function fetchMyPlatformAdminStatus(userId: string): Promise<PlatformAdminStatus | null> {
  const { data, error } = await supabase.from("platform_admins").select("status, full_name").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PlatformAdminStatus | null;
}

export type AdminDashboardRow = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  name: string | null;
  headline: string | null;
  institution: string | null;
  programme: string | null;
  is_adult: boolean;
  is_active: boolean;
  deactivated_at: string | null;
  capability_count: number;
  evidence_count: number;
  project_count: number;
  has_public_profile: boolean;
};

export async function fetchAdminDashboardData(): Promise<AdminDashboardRow[]> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_data");
  if (error) throw new Error(error.message);
  return (data as unknown as AdminDashboardRow[] | null) ?? [];
}

export async function deactivateTwin(twinId: string): Promise<void> {
  const { error } = await supabase.rpc("deactivate_twin", { p_twin_id: twinId });
  if (error) throw new Error(error.message);
}

export async function reactivateTwin(twinId: string): Promise<void> {
  const { error } = await supabase.rpc("reactivate_twin", { p_twin_id: twinId });
  if (error) throw new Error(error.message);
}
