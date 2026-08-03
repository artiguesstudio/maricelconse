import { createClient } from "../lib/supabase/server";

export type SubscriptionRecord = {
  id: string;
  profileId: string;
  providerSubscriptionId: string;
  providerPlanId: string;
  payerEmail: string;
  status: string;
  paymentStatus: string;
  accessUntil: string;
  nextPaymentDate: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string;
  createdAt: string;
};

export type AdminSubscriptionRecord = SubscriptionRecord & {
  displayName: string;
};

const SUBSCRIPTION_COLUMNS = "id,profile_id,provider_subscription_id,provider_plan_id,payer_email,status,payment_status,access_until,next_payment_date,cancel_at_period_end,canceled_at,created_at" as const;
const ADMIN_SUBSCRIPTION_COLUMNS = "id,profile_id,provider_subscription_id,provider_plan_id,payer_email,status,payment_status,access_until,next_payment_date,cancel_at_period_end,canceled_at,created_at,profiles(display_name,email)" as const;

function mapSubscription(row: Record<string, unknown>): SubscriptionRecord {
  return {
    id: String(row.id || ""),
    profileId: String(row.profile_id || ""),
    providerSubscriptionId: String(row.provider_subscription_id || ""),
    providerPlanId: String(row.provider_plan_id || ""),
    payerEmail: String(row.payer_email || ""),
    status: String(row.status || "pending"),
    paymentStatus: String(row.payment_status || "pending"),
    accessUntil: String(row.access_until || ""),
    nextPaymentDate: String(row.next_payment_date || ""),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    canceledAt: String(row.canceled_at || ""),
    createdAt: String(row.created_at || ""),
  };
}

export async function getCurrentSubscription(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSubscription(data as unknown as Record<string, unknown>) : null;
}

export async function getAdminSubscriptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(ADMIN_SUBSCRIPTION_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => {
    const source = row as unknown as Record<string, unknown>;
    const profile = source.profiles as { display_name?: string; email?: string } | { display_name?: string; email?: string }[] | null;
    const displayName = Array.isArray(profile)
      ? String(profile[0]?.display_name || "")
      : String(profile?.display_name || "");
    const profileEmail = Array.isArray(profile)
      ? String(profile[0]?.email || "")
      : String(profile?.email || "");
    const subscription = mapSubscription(source);
    return {
      ...subscription,
      payerEmail: subscription.payerEmail || profileEmail,
      displayName,
    } satisfies AdminSubscriptionRecord;
  });
}
