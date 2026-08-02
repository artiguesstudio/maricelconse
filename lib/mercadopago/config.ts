export const MEMBERSHIP_AMOUNT_ARS = 51_999;
export const MEMBERSHIP_REASON = "Bienvenidas a bordo · Maricel Conse";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

export function getMercadoPagoConfig() {
  return {
    accessToken: required("MERCADOPAGO_ACCESS_TOKEN"),
    planId: required("MERCADOPAGO_PLAN_ID"),
    webhookSecret: required("MERCADOPAGO_WEBHOOK_SECRET"),
  };
}

export function getMercadoPagoAccessConfig() {
  return {
    accessToken: required("MERCADOPAGO_ACCESS_TOKEN"),
    planId: required("MERCADOPAGO_PLAN_ID"),
  };
}

export function getAppOrigin(requestUrl?: string) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (requestUrl) return new URL(requestUrl).origin;
  return "https://www.maricelconse.com.ar";
}
