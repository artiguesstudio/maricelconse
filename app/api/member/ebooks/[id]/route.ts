import { authorizeUserRequest } from "../../../../admin-auth";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authorizeUserRequest();
  if (!user) return Response.json({ error: "Acceso no autorizado." }, { status: 401 });

  const supabase = await createClient();
  const { data: active, error: accessError } = await supabase.rpc("has_active_membership");
  if (accessError) throw accessError;
  if (!active) return Response.json({ error: "Necesitas una membresía vigente para acceder." }, { status: 403 });

  const { id } = await context.params;
  const ebookId = Number(id);
  if (!Number.isInteger(ebookId) || ebookId <= 0) {
    return Response.json({ error: "Ebook inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ebook, error } = await admin
    .from("ebooks")
    .select("title,member_file_path,member_url,is_published")
    .eq("id", ebookId)
    .single();
  if (error || !ebook?.is_published) return Response.json({ error: "Ebook no disponible." }, { status: 404 });

  if (ebook.member_file_path) {
    const downloadName = `${String(ebook.title || "ebook")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 -]+/g, "")
      .trim()
      .replace(/\s+/g, "-") || "ebook"}.pdf`;
    const { data, error: signedError } = await admin.storage
      .from("member-ebooks")
      .createSignedUrl(ebook.member_file_path, 300, { download: downloadName });
    if (signedError || !data?.signedUrl) return Response.json({ error: "No pudimos abrir el PDF." }, { status: 502 });
    return Response.redirect(data.signedUrl, 302);
  }
  if (ebook.member_url) return Response.redirect(new URL(ebook.member_url, request.url), 302);
  return Response.json({ error: "Maricel todavía no cargó este ebook." }, { status: 404 });
}
