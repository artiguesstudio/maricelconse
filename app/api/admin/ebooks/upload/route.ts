import { authorizeAdminRequest } from "../../../../admin-auth";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { getContentBundle } from "../../../../../db/content";

export async function POST(request: Request) {
  const user = await authorizeAdminRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const ebookId = Number(form.get("ebookId"));
    const file = form.get("file");
    if (!Number.isInteger(ebookId) || ebookId <= 0 || !(file instanceof File)) {
      return Response.json({ error: "Primero guarda el ebook y elegi un PDF." }, { status: 400 });
    }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "El archivo debe ser un PDF." }, { status: 400 });
    }
    if (file.size > 52_428_800) {
      return Response.json({ error: "El PDF supera el límite de 50 MB." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: ebook, error: ebookError } = await admin
      .from("ebooks")
      .select("id,member_file_path")
      .eq("id", ebookId)
      .single();
    if (ebookError) throw ebookError;

    const safeName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ebook.pdf";
    const path = `${ebookId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await admin.storage.from("member-ebooks").upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await admin.from("ebooks").update({ member_file_path: path }).eq("id", ebookId);
    if (updateError) {
      await admin.storage.from("member-ebooks").remove([path]);
      throw updateError;
    }
    if (ebook.member_file_path && ebook.member_file_path !== path) {
      await admin.storage.from("member-ebooks").remove([ebook.member_file_path]);
    }
    return Response.json(await getContentBundle());
  } catch (error) {
    console.error("No se pudo subir el ebook", error);
    return Response.json({ error: "No pudimos subir el PDF. Intenta nuevamente." }, { status: 500 });
  }
}
