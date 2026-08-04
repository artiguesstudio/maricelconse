import { getMercadoPagoAccessConfig } from "./config";

const API_BASE = "https://api.mercadopago.com";

export type MercadoPagoPreapproval = {
  id: string;
  preapproval_plan_id?: string | null;
  external_reference?: string | null;
  payer_email?: string | null;
  init_point?: string | null;
  status: string;
  next_payment_date?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
  } | null;
};

export type MercadoPagoAuthorizedPayment = {
  id: number;
  preapproval_id: string;
  external_reference?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  debit_date?: string | null;
  status?: string | null;
  summarized?: string | null;
  payment?: {
    id?: number;
    status?: string | null;
    status_detail?: string | null;
  } | null;
};

type MercadoPagoAuthorizedPaymentSearch = {
  results?: MercadoPagoAuthorizedPayment[];
};

export type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string | null;
  external_reference?: string | null;
  date_approved?: string | null;
};

type MercadoPagoPreapprovalSearch = {
  results?: MercadoPagoPreapproval[];
  paging?: { total?: number; offset?: number; limit?: number };
};

function subscriptionDate(subscription: MercadoPagoPreapproval) {
  return new Date(subscription.date_created || 0).getTime();
}

async function mercadoPagoRequest<T>(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string,
) {
  const { accessToken } = getMercadoPagoAccessConfig();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("content-type", "application/json");
  if (idempotencyKey) headers.set("x-idempotency-key", idempotencyKey);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null) as { message?: string } | T | null;

  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body && body.message
      ? body.message
      : `Mercado Pago respondió con estado ${response.status}.`;
    throw new Error(message);
  }

  return body as T;
}

export function createSubscription(input: {
  profileId: string;
  payerEmail: string;
  backUrl: string;
  idempotencyKey: string;
}) {
  const { planId } = getMercadoPagoAccessConfig();
  return mercadoPagoRequest<MercadoPagoPreapproval>(
    "/preapproval",
    {
      method: "POST",
      body: JSON.stringify({
        preapproval_plan_id: planId,
        external_reference: input.profileId,
        payer_email: input.payerEmail,
        back_url: input.backUrl,
      }),
    },
    input.idempotencyKey,
  );
}

export function getSubscription(providerSubscriptionId: string) {
  return mercadoPagoRequest<MercadoPagoPreapproval>(
    `/preapproval/${encodeURIComponent(providerSubscriptionId)}`,
  );
}

async function hydrateSubscriptions(results: MercadoPagoPreapproval[]) {
  const unique = [...new Map(results.filter((item) => item.id).map((item) => [item.id, item])).values()];
  const hydrated = await Promise.allSettled(unique.map((item) =>
    item.preapproval_plan_id && item.payer_email && item.date_created
      ? Promise.resolve(item)
      : getSubscription(item.id),
  ));
  return hydrated.map((result, index) => result.status === "fulfilled" ? result.value : unique[index]);
}

export async function searchSubscriptions(payerEmail: string, planId: string) {
  const params = new URLSearchParams({
    payer_email: payerEmail,
    limit: "100",
  });
  const result = await mercadoPagoRequest<MercadoPagoPreapprovalSearch>(`/preapproval/search?${params}`);
  const subscriptions = await hydrateSubscriptions(result.results || []);
  return subscriptions
    .filter((subscription) => subscription.preapproval_plan_id === planId)
    .sort((left, right) => subscriptionDate(right) - subscriptionDate(left));
}

export async function searchPlanSubscriptions(planId: string) {
  const params = new URLSearchParams({
    preapproval_plan_id: planId,
    limit: "100",
  });
  const result = await mercadoPagoRequest<MercadoPagoPreapprovalSearch>(`/preapproval/search?${params}`);
  return (result.results || [])
    .filter((subscription) => !subscription.preapproval_plan_id || subscription.preapproval_plan_id === planId)
    .sort((left, right) => subscriptionDate(right) - subscriptionDate(left));
}

export async function searchAuthorizedSubscriptions() {
  const params = new URLSearchParams({
    status: "authorized",
    limit: "100",
  });
  const result = await mercadoPagoRequest<MercadoPagoPreapprovalSearch>(`/preapproval/search?${params}`);
  return (result.results || [])
    .sort((left, right) => subscriptionDate(right) - subscriptionDate(left));
}

export async function inspectSubscriptionSearch(payerEmail: string, planId: string) {
  const normalizedEmail = payerEmail.trim().toLowerCase();
  const searches = [
    ["email", new URLSearchParams({ payer_email: normalizedEmail, limit: "100" })],
    ["query", new URLSearchParams({ q: normalizedEmail, limit: "100" })],
    ["recent", new URLSearchParams({ limit: "100", sort: "date_created", criteria: "desc" })],
    ["authorized", new URLSearchParams({ status: "authorized", limit: "100", sort: "date_created", criteria: "desc" })],
    ["plan", new URLSearchParams({ preapproval_plan_id: planId, limit: "100", sort: "date_created", criteria: "desc" })],
  ] as const;

  const diagnostics = [];
  for (const [name, params] of searches) {
    try {
      const result = await mercadoPagoRequest<MercadoPagoPreapprovalSearch>(`/preapproval/search?${params}`);
      const matches = (result.results || []).filter((subscription) =>
        subscription.payer_email?.trim().toLowerCase() === normalizedEmail,
      );
      diagnostics.push({
        name,
        returned: result.results?.length || 0,
        total: result.paging?.total || 0,
        matches: matches.map((subscription) => ({
          id: subscription.id,
          status: subscription.status,
          payerEmail: subscription.payer_email || null,
          dateCreated: subscription.date_created || null,
          planMatches: subscription.preapproval_plan_id === planId,
          hasPlan: Boolean(subscription.preapproval_plan_id),
          externalReference: subscription.external_reference || null,
        })),
      });
    } catch (error) {
      diagnostics.push({
        name,
        error: error instanceof Error ? error.message : "Error sin detalle.",
      });
    }
  }
  return diagnostics;
}

export function cancelSubscription(providerSubscriptionId: string) {
  return mercadoPagoRequest<MercadoPagoPreapproval>(
    `/preapproval/${encodeURIComponent(providerSubscriptionId)}`,
    { method: "PUT", body: JSON.stringify({ status: "canceled" }) },
  );
}

export function getAuthorizedPayment(providerPaymentId: string) {
  return mercadoPagoRequest<MercadoPagoAuthorizedPayment>(
    `/authorized_payments/${encodeURIComponent(providerPaymentId)}`,
  );
}

export async function searchAuthorizedPayments(providerSubscriptionId: string) {
  return searchAuthorizedPaymentsBy({ preapproval_id: providerSubscriptionId });
}

export async function searchAuthorizedPaymentsByPaymentId(providerPaymentId: string) {
  return searchAuthorizedPaymentsBy({ payment_id: providerPaymentId });
}

async function searchAuthorizedPaymentsBy(filters: Record<string, string>) {
  const params = new URLSearchParams(filters);
  const result = await mercadoPagoRequest<MercadoPagoAuthorizedPaymentSearch>(
    `/authorized_payments/search?${params}`,
  );
  return (result.results || []).sort((left, right) =>
    new Date(right.last_modified || right.debit_date || right.date_created || 0).getTime()
    - new Date(left.last_modified || left.debit_date || left.date_created || 0).getTime(),
  );
}

export function getPayment(providerPaymentId: string) {
  return mercadoPagoRequest<MercadoPagoPayment>(
    `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
  );
}
