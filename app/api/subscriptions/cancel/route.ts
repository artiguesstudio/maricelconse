import { authorizeUserRequest } from "../../../admin-auth";
import { cancelSubscription, getSubscription } from "../../../../lib/mercadopago/api";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request) {
  const user = await authorizeUserRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("subscriptions")
      .select("id,provider_subscription_id,status,access_until,next_payment_date")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) return Response.json({ error: "No encontramos una suscripción para cancelar." }, { status: 404 });
    if (current.status === "canceled") {
      return Response.json({ ok: true, accessUntil: current.access_until });
    }

    const beforeCancel = await getSubscription(current.provider_subscription_id);
    const accessUntil = current.access_until
      || current.next_payment_date
      || beforeCancel.next_payment_date
      || null;
    const canceled = await cancelSubscription(current.provider_subscription_id);
    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        status: canceled.status || "canceled",
        cancel_at_period_end: true,
        canceled_at: now,
        access_until: accessUntil,
        next_payment_date: accessUntil,
        last_provider_update_at: canceled.last_modified || now,
      })
      .eq("id", current.id);

    if (updateError) throw updateError;
    return Response.json({ ok: true, accessUntil });
  } catch (error) {
    console.error("No se pudo cancelar la suscripción", error);
    return Response.json(
      { error: "No pudimos completar la baja. Intenta nuevamente o escribile a Maricel." },
      { status: 502 },
    );
  }
}
