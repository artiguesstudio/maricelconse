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
  debit_date?: string | null;
  status?: string | null;
  summarized?: string | null;
  payment?: {
    id?: number;
    status?: string | null;
    status_detail?: string | null;
  } | null;
};

export type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string | null;
  external_reference?: string | null;
  date_approved?: string | null;
};

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

export function getPayment(providerPaymentId: string) {
  return mercadoPagoRequest<MercadoPagoPayment>(
    `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
  );
}
