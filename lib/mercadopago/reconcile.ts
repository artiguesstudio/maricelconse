import { retryFailedEmails } from "../email/resend";
import { createAdminClient } from "../supabase/admin";
import {
  getSubscription,
  searchAuthorizedPayments,
  searchPlanSubscriptions,
  searchSubscriptions,
  type MercadoPagoPreapproval,
} from "./api";
import { getMercadoPagoAccessConfig } from "./config";
import { syncPreapproval } from "./sync";
import { addOneMonth } from "./webhook";

function isUuid(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function isFinalPaymentIssue(status: string) {
  return ["rejected", "refunded", "cancelled", "canceled", "charged_back"].includes(status);
}

export async function reconcilePreapproval(
  preapproval: MercadoPagoPreapproval,
  profileIdHint?: string | null,
) {
  const invoices = await searchAuthorizedPayments(preapproval.id);
  const invoice = invoices[0] || null;
  const paymentStatus = invoice
    ? invoice.payment?.status || invoice.summarized || invoice.status || "pending"
    : null;
  const accessUntil = paymentStatus === "approved"
    ? preapproval.next_payment_date || addOneMonth(invoice?.debit_date || new Date())
    : null;

  await syncPreapproval(
    preapproval,
    profileIdHint,
    paymentStatus,
    accessUntil,
    invoice ? String(invoice.id) : null,
  );
  return { paymentStatus: paymentStatus || "pending", accessUntil, invoiceId: invoice?.id || null };
}

export async function reconcileMercadoPagoState() {
  const admin = createAdminClient();
  const { planId } = getMercadoPagoAccessConfig();
  const summary = { subscriptionsChecked: 0, intentsChecked: 0, intentsMatched: 0, emailRetries: 0, errors: 0 };
  const reconciled = new Set<string>();

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("subscriptions")
    .select("provider_subscription_id,profile_id")
    .eq("provider", "mercadopago")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (subscriptionsError) throw subscriptionsError;

  for (const row of subscriptions || []) {
    try {
      const providerId = String(row.provider_subscription_id || "");
      if (!providerId) continue;
      await reconcilePreapproval(await getSubscription(providerId), String(row.profile_id));
      reconciled.add(providerId);
      summary.subscriptionsChecked += 1;
    } catch (error) {
      summary.errors += 1;
      console.error("No se pudo reconciliar una suscripción existente", row.provider_subscription_id, error);
    }
  }

  let planCandidates: MercadoPagoPreapproval[] = [];
  try {
    planCandidates = await searchPlanSubscriptions(planId);
  } catch (error) {
    summary.errors += 1;
    console.error("No se pudo obtener el listado del plan de Mercado Pago", error);
  }

  const oldestIntent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: intents, error: intentsError } = await admin
    .from("subscription_checkout_intents")
    .select("id,profile_id,email,created_at,expires_at,consumed_at")
    .is("consumed_at", null)
    .gte("created_at", oldestIntent)
    .order("created_at", { ascending: true })
    .limit(250);
  if (intentsError) throw intentsError;

  for (const intent of intents || []) {
    summary.intentsChecked += 1;
    try {
      const normalizedEmail = String(intent.email).trim().toLowerCase();
      const emailCandidates = await searchSubscriptions(normalizedEmail, planId);
      const candidates = [...new Map([...emailCandidates, ...planCandidates]
        .map((candidate) => [candidate.id, candidate])).values()];
      const createdAt = new Date(intent.created_at).getTime();
      const expiresAt = new Date(intent.expires_at).getTime();
      const eligible = candidates.filter((candidate) => {
        if (reconciled.has(candidate.id)) return false;
        return candidate.preapproval_plan_id === planId;
      });
      const matchesWindow = (candidate: MercadoPagoPreapproval) => {
        const candidateDate = new Date(candidate.date_created || 0).getTime();
        return candidateDate >= createdAt - 5 * 60 * 1000
          && candidateDate <= expiresAt + 24 * 60 * 60 * 1000;
      };
      const referenceMatch = eligible.find((candidate) =>
        candidate.external_reference === intent.id
        || candidate.external_reference === intent.profile_id,
      );
      const emailMatches = eligible.filter((candidate) =>
        candidate.payer_email?.trim().toLowerCase() === normalizedEmail,
      );
      const match = referenceMatch
        || emailMatches.find(matchesWindow)
        || (emailMatches.length === 1 ? emailMatches[0] : undefined);
      if (!match) continue;

      const result = await reconcilePreapproval(match, String(intent.profile_id));
      reconciled.add(match.id);
      const shouldConsume = match.status !== "pending"
        || result.paymentStatus === "approved"
        || isFinalPaymentIssue(result.paymentStatus)
        || isUuid(match.external_reference);
      if (shouldConsume) {
        const { error } = await admin.from("subscription_checkout_intents")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", intent.id);
        if (error) throw error;
      }
      summary.intentsMatched += 1;
    } catch (error) {
      summary.errors += 1;
      console.error("No se pudo reconciliar un intento de checkout", intent.id, error);
    }
  }

  summary.emailRetries = await retryFailedEmails();
  return summary;
}
