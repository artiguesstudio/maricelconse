import { authorizeUserRequest } from "../../admin-auth";
import { createClient } from "../../../lib/supabase/server";

function clean(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function dateOrNull(value: unknown) {
  const date = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export async function PATCH(request: Request) {
  const user = await authorizeUserRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const supabase = await createClient();

    if (body.mode === "welcome") {
      const displayName = clean(body.displayName);
      const departureDate = dateOrNull(body.departureDate);
      if (!displayName || !departureDate) {
        return Response.json({ error: "Completá tu nombre y la fecha de partida." }, { status: 400 });
      }
      const { error } = await supabase.from("profiles").update({
        display_name: displayName,
        departure_date: departureDate,
        welcome_completed_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    const values = {
      display_name: clean(body.displayName),
      phone: clean(body.phone, 50),
      birth_date: dateOrNull(body.birthDate),
      document_type: clean(body.documentType, 40),
      document_number: clean(body.documentNumber, 50),
      country: clean(body.country, 80),
      province: clean(body.province, 80),
      city: clean(body.city, 80),
      address: clean(body.address, 180),
    };
    if (Object.values(values).some((value) => !value)) {
      return Response.json({ error: "Completá todos los datos personales antes de guardar." }, { status: 400 });
    }
    const { error } = await supabase.from("profiles").update({
      ...values,
      profile_completed_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("No se pudo guardar el perfil", error);
    return Response.json({ error: "No pudimos guardar tus datos. Intentá nuevamente." }, { status: 500 });
  }
}

