import { authorizeAdminRequest } from "../../../../admin-auth";
import { reconcileMercadoPagoState } from "../../../../../lib/mercadopago/reconcile";

function tokensMatch(provided: string, expected: string) {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < provided.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(request: Request) {
  const maintenanceToken = process.env.RECONCILE_API_TOKEN?.trim() || "";
  const providedToken = request.headers.get("x-reconcile-token") || "";
  const maintenanceAccess = tokensMatch(providedToken, maintenanceToken);
  const user = maintenanceAccess ? true : await authorizeAdminRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  try {
    const summary = await reconcileMercadoPagoState();
    return Response.json(summary, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("No se pudo actualizar Mercado Pago desde el backoffice", error);
    return Response.json(
      {
        error: "No se pudieron actualizar las suscripciones. Intenta nuevamente en unos minutos.",
        ...(maintenanceAccess && {
          diagnostic: error instanceof Error ? error.message : "Error interno sin detalle.",
        }),
      },
      { status: 500 },
    );
  }
}
