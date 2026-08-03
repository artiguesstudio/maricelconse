import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getContentBundle } from "../../db/content";
import { getMemberSession } from "../admin-auth";
import travelGuideDocument from "../legacy/generated/travelGuide.json";
import { LegacyDocument, applyReplacements, escapeHtml, type LegacySource } from "../legacy/LegacyDocument";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guía de viaje · Cómo funciona este espacio" };

function updateTravelGuide(body: string) {
  let updated = body.replace("Cinco carpetas, siempre en el mismo lugar.", "Seis carpetas, siempre en el mismo lugar.");
  const resourceStart = updated.indexOf('<a class="bp bp5" href="/mi-espacio">');
  if (resourceStart >= 0) {
    const resourceEnd = updated.indexOf("</a>", resourceStart);
    if (resourceEnd >= 0) {
      const resourceCard = updated.slice(resourceStart, resourceEnd + 4);
      const ebookCard = resourceCard
        .replace('class="bp bp5"', 'class="bp bp6"')
        .replace("Equipaje de recursos", "Biblioteca incluida")
        .replace("<h3>Recursos</h3>", "<h3>E-books</h3>")
        .replace(
          "Guías, materiales complementarios y lecturas para profundizar cuando tengas ganas.",
          "Todos los e-books publicados, incluidos para descargar mientras tu membresía esté activa.",
        )
        .replace('<span class="bp-w">Biblioteca</span>', '<span class="bp-w">Descargar</span>');
      updated = `${updated.slice(0, resourceEnd + 4)}\n        ${ebookCard}${updated.slice(resourceEnd + 4)}`;
    }
  }
  return updated
    .replace(/\s*<section class="bloque bloque-faq">[\s\S]*?<\/section>/, "")
    .replace(/\s*<section class="ayuda">[\s\S]*?<\/section>/, "");
}

export default async function TravelGuidePage() {
  const { active } = await getMemberSession("/guia-de-viaje");
  if (!active) redirect("/sin-acceso?area=membresia");
  const { settings } = await getContentBundle();
  const document = travelGuideDocument as LegacySource;
  const body = updateTravelGuide(applyReplacements(document.body, [
    ["https://instagram.com/maricelconse", escapeHtml(settings.instagram_url)],
    ["https://wa.me/5492964406552", escapeHtml(settings.whatsapp_url)],
  ]));
  return <LegacyDocument document={document} pageKey="travel-guide" body={body} />;
}
