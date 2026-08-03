import {
  getAuthorizedPayment,
  getPayment,
  getSubscription,
  searchAuthorizedPaymentsByPaymentId,
} from "../../../../lib/mercadopago/api";
import { getMercadoPagoConfig } from "../../../../lib/mercadopago/config";
import { reconcilePreapproval } from "../../../../lib/mercadopago/reconcile";
import { syncPreapproval, syncProfileStatus } from "../../../../lib/mercadopago/sync";
import { addOneMonth, validateMercadoPagoSignature } from "../../../../lib/mercadopago/webhook";
import { createAdminClient } from "../../../../lib/supabase/admin";

type WebhookBody = {
  id?: string | number;
  action?: string;
  type?: string;
  live_mode?: boolean;
  data?: { id?: string | number };
};

async function processNotification(topic: string, resourceId: string) {
  if (topic === "subscription_preapproval") {
    await reconcilePreapproval(await getSubscription(resourceId));
    return;
  }

  if (topic === "subscription_authorized_payment") {
    const invoice = await getAuthorizedPayment(resourceId);
    const preapproval = await getSubscription(invoice.preapproval_id);
    const paymentStatus = invoice.payment?.status || invoice.summarized || invoice.status || "pending";
    const accessUntil = paymentStatus === "approved"
      ? preapproval.next_payment_date || addOneMonth(invoice.debit_date || new Date())
      : null;
    await syncPreapproval(preapproval, null, paymentStatus, accessUntil, String(invoice.id));
    return;
  }

  if (topic === "payment") {
    const payment = await getPayment(resourceId);
    const [invoice] = await searchAuthorizedPaymentsByPaymentId(resourceId);
    if (invoice?.preapproval_id) {
      const preapproval = await getSubscription(invoice.preapproval_id);
      const paymentStatus = payment.status || invoice.payment?.status || invoice.summarized || invoice.status || "pending";
      const accessUntil = paymentStatus === "approved"
        ? preapproval.next_payment_date || addOneMonth(payment.date_approved || invoice.debit_date || new Date())
        : null;
      await syncPreapproval(preapproval, null, paymentStatus, accessUntil, String(invoice.id));
      return;
    }
    if (!payment.external_reference || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payment.external_reference)) return;
    const admin = createAdminClient();
    const { data: latest, error } = await admin
      .from("subscriptions")
      .select("id,access_until")
      .eq("profile_id", payment.external_reference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!latest) return;
    const accessUntil = payment.status === "approved"
      ? addOneMonth(payment.date_approved || new Date())
      : latest.access_until;
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({ payment_status: payment.status, access_until: accessUntil })
      .eq("id", latest.id);
    if (updateError) throw updateError;
    await syncProfileStatus(payment.external_reference, accessUntil);
  }
}

export async function POST(request: Request) {
  let body: WebhookBody;
  let eventKey = "";
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    body = await request.json() as WebhookBody;
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const url = new URL(request.url);
  const resourceId = String(url.searchParams.get("data.id") || body.data?.id || "");
  const topic = String(url.searchParams.get("type") || body.type || "");
  const requestId = request.headers.get("x-request-id") || "";
  const signature = request.headers.get("x-signature") || "";
  if (!resourceId || !topic || !requestId || !signature) {
    console.warn("Webhook de Mercado Pago incompleto", {
      topic,
      hasResourceId: Boolean(resourceId),
      hasRequestId: Boolean(requestId),
      hasSignature: Boolean(signature),
    });
    return Response.json({ error: "Notificación incompleta." }, { status: 400 });
  }

  try {
    const { webhookSecret } = getMercadoPagoConfig();
    const valid = await validateMercadoPagoSignature({
      dataId: resourceId,
      requestId,
      signature,
      secret: webhookSecret,
    });
    if (!valid) {
      console.warn("Firma inválida en webhook de Mercado Pago", { topic, resourceId });
      return Response.json({ error: "Firma inválida." }, { status: 401 });
    }

    admin = createAdminClient();
    eventKey = `${topic}:${body.id || requestId}:${body.action || "update"}`;
    const { data: existing } = await admin
      .from("subscription_events")
      .select("processed_at")
      .eq("provider_event_key", eventKey)
      .maybeSingle();
    if (existing?.processed_at) return Response.json({ ok: true });

    const { error: eventError } = await admin.from("subscription_events").upsert({
      provider_event_key: eventKey,
      topic,
      action: body.action || "",
      provider_resource_id: resourceId,
      payload: body,
      error_message: null,
    }, { onConflict: "provider_event_key" });
    if (eventError) throw eventError;

    await processNotification(topic, resourceId);
    await admin
      .from("subscription_events")
      .update({ processed_at: new Date().toISOString(), error_message: null })
      .eq("provider_event_key", eventKey);
    return Response.json({ ok: true });
  } catch (error) {
    if (admin && eventKey) {
      const message = error instanceof Error ? error.message : "Error desconocido.";
      try {
        await admin
          .from("subscription_events")
          .update({ error_message: message.slice(0, 1000) })
          .eq("provider_event_key", eventKey);
      } catch {
        // El error original se conserva en los registros del Worker.
      }
    }
    console.error("No se pudo procesar el webhook de Mercado Pago", error);
    return Response.json({ error: "No se pudo procesar la notificación." }, { status: 500 });
  }
}
