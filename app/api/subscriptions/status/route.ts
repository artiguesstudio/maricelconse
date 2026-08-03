import { authorizeUserRequest } from "../../../admin-auth";
import { getCurrentSubscription } from "../../../../db/subscriptions";
import { getSubscription, searchSubscriptions } from "../../../../lib/mercadopago/api";
import { getMercadoPagoAccessConfig } from "../../../../lib/mercadopago/config";
import { reconcilePreapproval } from "../../../../lib/mercadopago/reconcile";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const user = await authorizeUserRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  let subscription = await getCurrentSubscription(user.id);
  let active = Boolean(subscription?.accessUntil && new Date(subscription.accessUntil).getTime() > Date.now());

  if (!active) {
    try {
      const { planId } = getMercadoPagoAccessConfig();
      const url = new URL(request.url);
      const requestedId = url.searchParams.get("preapproval_id")
        || url.searchParams.get("preapprovalId")
        || url.searchParams.get("subscription_id");
      const intentId = (await cookies()).get("mc_checkout_intent")?.value || "";
      let validIntent = false;
      if (requestedId && /^[0-9a-f-]{36}$/i.test(intentId)) {
        const admin = createAdminClient();
        const { data: intent } = await admin
          .from("subscription_checkout_intents")
          .select("id")
          .eq("id", intentId)
          .eq("profile_id", user.id)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        validIntent = Boolean(intent);
      }
      const candidates = requestedId && /^[a-zA-Z0-9_-]{10,80}$/.test(requestedId)
        ? [await getSubscription(requestedId)]
        : await searchSubscriptions(user.email.toLowerCase(), planId);
      const match = candidates.find((candidate) =>
        candidate.preapproval_plan_id === planId
        && (validIntent || candidate.payer_email?.toLowerCase() === user.email.toLowerCase()),
      );
      if (match) {
        await reconcilePreapproval(match, user.id);
        if (intentId && validIntent) {
          await createAdminClient().from("subscription_checkout_intents")
            .update({ consumed_at: new Date().toISOString() })
            .eq("id", intentId)
            .eq("profile_id", user.id);
        }
        subscription = await getCurrentSubscription(user.id);
        active = Boolean(subscription?.accessUntil && new Date(subscription.accessUntil).getTime() > Date.now());
      }
    } catch (error) {
      console.error("No se pudo reconciliar la suscripción", error);
    }
  }

  return Response.json(
    { active, subscription },
    { headers: { "cache-control": "no-store" } },
  );
}
