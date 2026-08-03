import { createClient } from "../lib/supabase/server";

export type AdminLeadRecord = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  birthDate: string;
  country: string;
  province: string;
  city: string;
  journeyArrival: string;
  membershipGoal: string;
  profileCompletedAt: string;
};

export async function getAdminLeads(): Promise<AdminLeadRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,email,phone,birth_date,country,province,city,journey_arrival,membership_goal,profile_completed_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data || [])
    .map((row) => ({
      id: String(row.id || ""),
      displayName: String(row.display_name || ""),
      email: String(row.email || ""),
      phone: String(row.phone || ""),
      birthDate: String(row.birth_date || ""),
      country: String(row.country || ""),
      province: String(row.province || ""),
      city: String(row.city || ""),
      journeyArrival: String(row.journey_arrival || ""),
      membershipGoal: String(row.membership_goal || ""),
      profileCompletedAt: String(row.profile_completed_at || ""),
    }))
    .filter((lead) => lead.journeyArrival || lead.membershipGoal);
}
