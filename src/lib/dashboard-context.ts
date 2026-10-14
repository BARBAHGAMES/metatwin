import { createContext, useContext } from "react";

export type DashboardTwin = {
  id: string;
  name: string | null;
  first_name: string | null;
  institution: string | null;
  programme: string | null;
  year: number | null;
  headline: string | null;
  bio: string | null;
  city_id: string | null;
  visibility: "private" | "public";
  is_adult: boolean;
  is_active: boolean;
  plan_status: string;
  plan_paid_until: string | null;
  handle: string | null;
  public_show_evidence_details: boolean;
  photo_url: string | null;
  gender: string | null;
  gender_self_described: string | null;
  mbti_type: string | null;
};

export type DashboardContextValue = {
  userId: string;
  twin: DashboardTwin;
  reload: () => void;
};

// Shared across every /dashboard/* tab — the layout route (dashboard.tsx)
// fetches the twin row once (needed for the gates it already enforces) and
// provides it here so tabs don't each re-fetch the same row.
export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within the /dashboard layout route");
  return ctx;
}
