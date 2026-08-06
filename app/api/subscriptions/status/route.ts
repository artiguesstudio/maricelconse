import { authorizeUserRequest } from "../../../admin-auth";
import { getCurrentSubscription } from "../../../../db/subscriptions";
import {
  getSubscription,
  searchPlanSubscriptions,
  searchSubscriptions,
  type MercadoPagoPreapproval,
} from "../../../../lib/mercadopago/api";
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
      let validIntent: {
        id: string;
        created_at: string;
        expires_at: string;
      } | null = null;
      if (/^[0-9a-f-]{36}$/i.test(intentId)) {
        const admin = createAdminClient();
        const { data: intent } = await admin
          .from("subscription_checkout_intents")
          .select("id,created_at,expires_at")
          .eq("id", intentId)
          .eq("profile_id", user.id)
          .is("consumed_at", null)
          .gt("expires_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .maybeSingle();
        validIntent = intent;
      }
      const candidates = requestedId
        && validIntent
        && /^[a-zA-Z0-9_-]{10,80}$/.test(requestedId)
          ? [await getSubscription(requestedId)]
          : await searchSubscriptions(user.email.toLowerCase(), planId);
      let match: MercadoPagoPreapproval | undefined = candidates.find((candidate) =>
        candidate.preapproval_plan_id === planId
        && (Boolean(validIntent) || candidate.payer_email?.toLowerCase() === user.email.toLowerCase()),
      );

      if (!match && validIntent) {
        const admin = createAdminClient();
        const { data: linked, error: linkedError } = await admin
          .from("subscriptions")
          .select("provider_subscription_id,profile_id")
          .eq("provider", "mercadopago");
        if (linkedError) throw linkedError;
        const linkedSubscriptions = new Map((linked || []).map((row) => [
          String(row.provider_subscription_id || ""),
          String(row.profile_id || ""),
        ]));
        const createdAt = new Date(validIntent.created_at).getTime();
        const expiresAt = new Date(validIntent.expires_at).getTime();
        const timeMatches = (await searchPlanSubscriptions(planId)).filter((candidate) => {
          const candidateDate = new Date(candidate.date_created || 0).getTime();
          const linkedProfileId = linkedSubscriptions.get(candidate.id);
          return candidate.status === "authorized"
            && (!linkedProfileId || linkedProfileId === user.id)
            && candidateDate >= createdAt - 5 * 60 * 1000
            && candidateDate <= expiresAt + 30 * 60 * 1000;
        });
        if (timeMatches.length === 1) {
          const hydrated = await getSubscription(timeMatches[0].id);
          if (hydrated.preapproval_plan_id === planId) match = hydrated;
        }
      }

      if (match) {
        await reconcilePreapproval(match, user.id);
        subscription = await getCurrentSubscription(user.id);
        active = Boolean(subscription?.accessUntil && new Date(subscription.accessUntil).getTime() > Date.now());
        if (active && validIntent) {
          await createAdminClient().from("subscription_checkout_intents")
            .update({ consumed_at: new Date().toISOString() })
            .eq("id", validIntent.id)
            .eq("profile_id", user.id);
        }
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
