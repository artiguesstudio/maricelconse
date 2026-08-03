import { NextResponse } from "next/server";
import { authorizeUserRequest } from "../../../admin-auth";
import { getMercadoPagoAccessConfig } from "../../../../lib/mercadopago/config";
import { createAdminClient } from "../../../../lib/supabase/admin";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return phone.startsWith("+")
    && /^[+0-9 ()-]+$/.test(phone)
    && digits.length >= 10
    && digits.length <= 15;
}

export async function POST(request: Request) {
  const user = await authorizeUserRequest();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fmembresia%2Fsuscribirme", request.url),
      303,
    );
  }

  try {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
      return NextResponse.redirect(new URL("/membresia/suscribirme?error=contacto", request.url), 303);
    }

    const form = await request.formData();
    const displayName = clean(form.get("displayName"), 120);
    const phone = clean(form.get("phone"), 25);
    if (displayName.length < 2 || !validPhone(phone)) {
      return NextResponse.redirect(new URL("/membresia/suscribirme?error=contacto", request.url), 303);
    }

    const { planId } = getMercadoPagoAccessConfig();
    const admin = createAdminClient();
    const { error: profileError } = await admin
      .from("profiles")
      .update({ display_name: displayName, phone })
      .eq("id", user.id)
      .select("id")
      .single();
    if (profileError) throw profileError;

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

    const { data: intent, error: intentError } = await admin
      .from("subscription_checkout_intents")
      .insert({
        profile_id: user.id,
        email: user.email.toLowerCase(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (intentError || !intent?.id) throw intentError || new Error("No se pudo preparar el checkout.");

    // El checkout alojado por Mercado Pago captura y tokeniza la tarjeta de
    // forma segura. La API /preapproval exige card_token_id para planes
    // asociados y no debe llamarse antes de que la alumna complete ese paso.
    const checkoutUrl = new URL("https://www.mercadopago.com.ar/subscriptions/checkout");
    checkoutUrl.searchParams.set("preapproval_plan_id", planId);
    checkoutUrl.searchParams.set("payer_email", user.email.toLowerCase());
    checkoutUrl.searchParams.set("external_reference", intent.id);
    const response = NextResponse.redirect(checkoutUrl, 303);
    response.cookies.set("mc_checkout_intent", intent.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("No se pudo iniciar la suscripción", error);
    return NextResponse.redirect(new URL("/membresia/suscribirme?error=checkout", request.url), 303);
  }
}
