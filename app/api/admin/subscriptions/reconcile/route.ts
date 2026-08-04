import { authorizeAdminRequest } from "../../../../admin-auth";
import { reconcileMercadoPagoState } from "../../../../../lib/mercadopago/reconcile";

export async function POST() {
  const user = await authorizeAdminRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  try {
    const summary = await reconcileMercadoPagoState();
    return Response.json(summary, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("No se pudo actualizar Mercado Pago desde el backoffice", error);
    return Response.json(
      { error: "No se pudieron actualizar las suscripciones. Intenta nuevamente en unos minutos." },
      { status: 500 },
    );
  }
}
