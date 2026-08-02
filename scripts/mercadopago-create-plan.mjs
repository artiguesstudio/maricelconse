const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
const appBaseUrl = (process.env.APP_BASE_URL || "https://www.maricelconse.com.ar").replace(/\/$/, "");

if (!accessToken) {
  throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN.");
}

const response = await fetch("https://api.mercadopago.com/preapproval_plan", {
  method: "POST",
  headers: {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "x-idempotency-key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    reason: "Bienvenidas a bordo · Maricel Conse",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 51999,
      currency_id: "ARS",
    },
    back_url: `${appBaseUrl}/membresia/resultado`,
  }),
});

const body = await response.json();
if (!response.ok) {
  throw new Error(body?.message || `Mercado Pago respondió con estado ${response.status}.`);
}

process.stdout.write(JSON.stringify({
  id: body.id,
  status: body.status,
  amount: body.auto_recurring?.transaction_amount,
  currency: body.auto_recurring?.currency_id,
  frequency: `${body.auto_recurring?.frequency} ${body.auto_recurring?.frequency_type}`,
  initPoint: body.init_point,
}, null, 2));
