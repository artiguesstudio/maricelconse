import { NextResponse } from "next/server";
import { authorizeUserRequest } from "../../../admin-auth";
import { createSubscription } from "../../../../lib/mercadopago/api";
import { getAppOrigin, getMercadoPagoAccessConfig } from "../../../../lib/mercadopago/config";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request) {
  const user = await authorizeUserRequest();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fmembresia%2Fsuscribirme", request.url),
      303,
    );
  }

  try {
    const { planId } = getMercadoPagoAccessConfig();
    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("subscriptions")
      .select("provider_subscription_id,checkout_url,status,access_until")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.access_until && new Date(existing.access_until) > new Date()) {
      return NextResponse.redirect(new URL("/mi-espacio/membresia?estado=vigente", request.url), 303);
    }
    if (existing?.status === "pending" && existing.checkout_url) {
      return NextResponse.redirect(existing.checkout_url, 303);
    }

    const origin = getAppOrigin(request.url);
    const subscription = await createSubscription({
      profileId: user.id,
      payerEmail: user.email.toLowerCase(),
      backUrl: `${origin}/membresia/resultado`,
      idempotencyKey: crypto.randomUUID(),
    });

    if (!subscription.id || !subscription.init_point) {
      throw new Error("Mercado Pago no devolvió el enlace de pago.");
    }

    const checkoutUrl = new URL(subscription.init_point);
    if (!checkoutUrl.hostname.endsWith("mercadopago.com.ar")) {
      throw new Error("Mercado Pago devolvió un destino inesperado.");
    }

    const { error: saveError } = await admin.from("subscriptions").upsert({
      profile_id: user.id,
      provider: "mercadopago",
      provider_subscription_id: subscription.id,
      provider_plan_id: subscription.preapproval_plan_id || planId,
      external_reference: user.id,
      payer_email: user.email.toLowerCase(),
      checkout_url: subscription.init_point,
      status: subscription.status || "pending",
      payment_status: "pending",
      next_payment_date: subscription.next_payment_date || null,
      last_provider_update_at: subscription.last_modified || subscription.date_created || new Date().toISOString(),
    }, { onConflict: "provider_subscription_id" });

    if (saveError) throw saveError;
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error("No se pudo iniciar la suscripción", error);
    return NextResponse.redirect(new URL("/membresia/suscribirme?error=checkout", request.url), 303);
  }
}
