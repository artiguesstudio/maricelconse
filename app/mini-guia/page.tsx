import type { Metadata } from "next";
import { getContentBundle } from "../../db/content";
import miniGuideDocument from "../legacy/generated/miniGuide.json";
import { LegacyDocument, type LegacySource } from "../legacy/LegacyDocument";
import { renderMiniGuide } from "../legacy/render";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "El primer paso para volver a vos · Mini-guía" };

export default async function GuidePage() {
  const { settings } = await getContentBundle();
  const document = miniGuideDocument as LegacySource;
  return <LegacyDocument document={document} pageKey="mini-guide" body={renderMiniGuide(document, settings)} />;
}
