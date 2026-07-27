import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getContentBundle } from "../../db/content";
import { getMemberSession } from "../admin-auth";
import travelGuideDocument from "../legacy/generated/travelGuide.json";
import { LegacyDocument, applyReplacements, escapeHtml, type LegacySource } from "../legacy/LegacyDocument";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guía de viaje · Cómo funciona este espacio" };

export default async function TravelGuidePage() {
  const { active } = await getMemberSession("/guia-de-viaje");
  if (!active) redirect("/sin-acceso?area=membresia");
  const { settings } = await getContentBundle();
  const document = travelGuideDocument as LegacySource;
  const body = applyReplacements(document.body, [
    ["https://instagram.com/maricelconse", escapeHtml(settings.instagram_url)],
    ["https://wa.me/5492964406552", escapeHtml(settings.whatsapp_url)],
  ]);
  return <LegacyDocument document={document} pageKey="travel-guide" body={body} />;
}
