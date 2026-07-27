import { authorizeAdminRequest } from "../../admin-auth";
import { getContentBundle, updateSettings, upsertEbook, upsertResource, type EbookRecord, type ResourceRecord, type SiteSettings } from "../../../db/content";

export async function GET() {
  const user = await authorizeAdminRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });
  return Response.json(await getContentBundle());
}

export async function PATCH(request: Request) {
  const user = await authorizeAdminRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });
  try {
    const body = await request.json() as { type?: string; values?: Partial<SiteSettings>; value?: unknown };
    if (body.type === "settings" && body.values) await updateSettings(body.values);
    else if (body.type === "ebook" && body.value) await upsertEbook(body.value as Partial<EbookRecord>);
    else if (body.type === "resource" && body.value) await upsertResource(body.value as Partial<ResourceRecord>);
    else return Response.json({ error: "Solicitud incompleta." }, { status: 400 });
    return Response.json(await getContentBundle());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron guardar los cambios." }, { status: 500 });
  }
}
