import { authorizeUserRequest } from "../../../admin-auth";
import { getCurrentSubscription } from "../../../../db/subscriptions";

export async function GET() {
  const user = await authorizeUserRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  const subscription = await getCurrentSubscription(user.id);
  const active = Boolean(
    subscription?.accessUntil
    && new Date(subscription.accessUntil).getTime() > Date.now(),
  );

  return Response.json(
    { active, subscription },
    { headers: { "cache-control": "no-store" } },
  );
}
