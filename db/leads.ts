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
  subscriptionCreatedAt: string;
  accessUntil: string;
};

export async function getAdminLeads(): Promise<AdminLeadRecord[]> {
  const supabase = await createClient();
  const [profilesResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,email,phone,birth_date,country,province,city,journey_arrival,membership_goal,profile_completed_at,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("profile_id,access_until,created_at")
      .eq("payment_status", "approved")
      .order("created_at", { ascending: false }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const subscriptionByProfile = new Map<string, { createdAt: string; accessUntil: string }>();
  for (const subscription of subscriptionsResult.data || []) {
    const profileId = String(subscription.profile_id || "");
    if (!profileId || subscriptionByProfile.has(profileId)) continue;
    subscriptionByProfile.set(profileId, {
      createdAt: String(subscription.created_at || ""),
      accessUntil: String(subscription.access_until || ""),
    });
  }

  return (profilesResult.data || [])
    .map((row) => {
      const id = String(row.id || "");
      const subscription = subscriptionByProfile.get(id);
      return {
        id,
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
        subscriptionCreatedAt: subscription?.createdAt || "",
        accessUntil: subscription?.accessUntil || "",
      };
    })
    .filter((lead) => lead.subscriptionCreatedAt || lead.journeyArrival || lead.membershipGoal)
    .sort((left, right) => new Date(right.subscriptionCreatedAt || right.profileCompletedAt || 0).getTime()
      - new Date(left.subscriptionCreatedAt || left.profileCompletedAt || 0).getTime());
}
