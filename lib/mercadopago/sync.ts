import { createAdminClient } from "../supabase/admin";
import { notifySubscriptionActivated, notifySubscriptionPaymentIssue } from "../email/notifications";
import type { MercadoPagoPreapproval } from "./api";

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function isUuid(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function syncProfileStatus(profileId: string, accessUntil: string | null) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ membership_status: isFuture(accessUntil) ? "active" : "inactive" })
    .eq("id", profileId)
    .neq("role", "admin");
  if (error) throw error;
}

export async function syncPreapproval(
  preapproval: MercadoPagoPreapproval,
  profileIdHint?: string | null,
  paymentStatus?: string | null,
  approvedAccessUntil?: string | null,
  paymentReference?: string | null,
) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("subscriptions")
    .select("id,profile_id,access_until,payment_status,payer_email")
    .eq("provider_subscription_id", preapproval.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.profile_id && profileIdHint && existing.profile_id !== profileIdHint) {
    throw new Error("La suscripción ya está asociada a otra alumna.");
  }
  let profileId = profileIdHint || existing?.profile_id || null;
  let checkoutIntentId: string | null = null;

  if (!profileId && isUuid(preapproval.external_reference)) {
    const reference = String(preapproval.external_reference);
    const { data: referencedProfile, error: referencedProfileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", reference)
      .maybeSingle();
    if (referencedProfileError) throw referencedProfileError;
    profileId = referencedProfile?.id || null;

    if (!profileId) {
      const { data: intent, error: intentError } = await admin
        .from("subscription_checkout_intents")
        .select("id,profile_id")
        .eq("id", reference)
        .maybeSingle();
      if (intentError) throw intentError;
      if (intent) {
        checkoutIntentId = intent.id;
        profileId = intent.profile_id;
      }
    }
  }

  if (!profileId && preapproval.payer_email) {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", preapproval.payer_email.trim())
      .maybeSingle();
    if (profileError) throw profileError;
    profileId = profile?.id || null;
  }
  if (!profileId) throw new Error("La suscripción no tiene una alumna asociada.");

  const providerNextPayment = preapproval.next_payment_date || null;
  let accessUntil = existing?.access_until || null;
  if (paymentReference && ["refunded", "charged_back"].includes(paymentStatus || "")) {
    accessUntil = null;
  }
  const explicitApprovedPayment = paymentStatus === "approved";
  const previouslyApprovedPayment = !paymentStatus && existing?.payment_status === "approved";
  if (explicitApprovedPayment && approvedAccessUntil) accessUntil = approvedAccessUntil;
  else if (
    (explicitApprovedPayment || previouslyApprovedPayment)
    && preapproval.status === "authorized"
    && isFuture(providerNextPayment)
  ) {
    accessUntil = providerNextPayment;
  }

  const inferredPaymentStatus = paymentStatus
    || existing?.payment_status
    || "pending";
  const { error: saveError } = await admin.from("subscriptions").upsert({
    profile_id: profileId,
    provider: "mercadopago",
    provider_subscription_id: preapproval.id,
    provider_plan_id: preapproval.preapproval_plan_id || null,
    external_reference: String(profileId),
    payer_email: preapproval.payer_email || existing?.payer_email || "",
    checkout_url: preapproval.init_point || null,
    status: preapproval.status || "pending",
    payment_status: inferredPaymentStatus,
    access_until: accessUntil,
    next_payment_date: providerNextPayment,
    cancel_at_period_end: preapproval.status === "canceled",
    canceled_at: preapproval.status === "canceled" ? new Date().toISOString() : null,
    last_provider_update_at: preapproval.last_modified || new Date().toISOString(),
  }, { onConflict: "provider_subscription_id" });
  if (saveError) throw saveError;
  if (checkoutIntentId) {
    await admin.from("subscription_checkout_intents")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", checkoutIntentId);
  }
  await syncProfileStatus(String(profileId), accessUntil);

  if (inferredPaymentStatus === "approved" && isFuture(accessUntil)) {
    await notifySubscriptionActivated({
      profileId: String(profileId),
      providerSubscriptionId: preapproval.id,
      payerEmail: preapproval.payer_email || existing?.payer_email || "",
      accessUntil: String(accessUntil),
    });
  } else if (
    paymentReference
    && ["rejected", "refunded", "cancelled", "canceled", "charged_back"].includes(inferredPaymentStatus)
  ) {
    await notifySubscriptionPaymentIssue({
      providerSubscriptionId: preapproval.id,
      payerEmail: preapproval.payer_email || existing?.payer_email || "Sin email informado",
      paymentStatus: inferredPaymentStatus,
      reference: paymentReference,
    }).catch((error) => console.error("No se pudo notificar el problema de cobro", error));
  }
}
