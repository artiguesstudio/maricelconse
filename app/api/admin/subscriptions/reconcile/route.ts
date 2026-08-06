import { authorizeAdminRequest } from "../../../../admin-auth";
import { getSubscription, inspectSubscriptionSearch } from "../../../../../lib/mercadopago/api";
import { getMercadoPagoAccessConfig } from "../../../../../lib/mercadopago/config";
import { reconcileMercadoPagoState, reconcilePreapproval } from "../../../../../lib/mercadopago/reconcile";
import { createAdminClient } from "../../../../../lib/supabase/admin";

function tokensMatch(provided: string, expected: string) {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < provided.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function diagnosticMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.code, record.message, record.details, record.hint]
      .filter((value) => typeof value === "string" && value)
      .join(" · ") || "Error interno sin detalle.";
  }
  return String(error || "Error interno sin detalle.");
}

export async function POST(request: Request) {
  const maintenanceToken = process.env.RECONCILE_API_TOKEN?.trim() || "";
  const providedToken = request.headers.get("x-reconcile-token") || "";
  const maintenanceAccess = tokensMatch(providedToken, maintenanceToken);
  const user = maintenanceAccess ? true : await authorizeAdminRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const providerSubscriptionId = url.searchParams.get("subscription_id")?.trim() || "";
    if (providerSubscriptionId) {
      if (!maintenanceAccess || !/^[a-zA-Z0-9_-]{10,80}$/.test(providerSubscriptionId)) {
        return Response.json({ error: "Conciliación puntual no autorizada." }, { status: 403 });
      }
      const admin = createAdminClient();
      const { data: subscription, error } = await admin
        .from("subscriptions")
        .select("profile_id")
        .eq("provider_subscription_id", providerSubscriptionId)
        .maybeSingle();
      if (error) throw error;
      if (!subscription?.profile_id) {
        return Response.json({ error: "Suscripción no encontrada." }, { status: 404 });
      }
      return Response.json(
        await reconcilePreapproval(
          await getSubscription(providerSubscriptionId),
          String(subscription.profile_id),
        ),
        { headers: { "cache-control": "no-store" } },
      );
    }

    const diagnosticEmail = url.searchParams.get("email")?.trim().toLowerCase() || "";
    if (diagnosticEmail) {
      if (!maintenanceAccess || !/^\S+@\S+\.\S+$/.test(diagnosticEmail)) {
        return Response.json({ error: "Diagnóstico no autorizado." }, { status: 403 });
      }
      const { planId } = getMercadoPagoAccessConfig();
      return Response.json(
        { searches: await inspectSubscriptionSearch(diagnosticEmail, planId) },
        { headers: { "cache-control": "no-store" } },
      );
    }
    const summary = await reconcileMercadoPagoState();
    return Response.json(summary, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("No se pudo actualizar Mercado Pago desde el backoffice", error);
    return Response.json(
      {
        error: "No se pudieron actualizar las suscripciones. Intenta nuevamente en unos minutos.",
        ...(maintenanceAccess && {
          diagnostic: diagnosticMessage(error),
        }),
      },
      { status: 500 },
    );
  }
}
