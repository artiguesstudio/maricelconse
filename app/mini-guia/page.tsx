import type { Metadata } from "next";
import { getContentBundle } from "../../db/content";
import homeDocument from "../legacy/generated/home.json";
import miniGuideDocument from "../legacy/generated/miniGuide.json";
import { LegacyDocument, type LegacySource } from "../legacy/LegacyDocument";
import { renderMiniGuide } from "../legacy/render";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "El primer paso para volver a vos · Mini-guía" };

function withIndexAirplaneBackground(source: LegacySource, indexSource: LegacySource): LegacySource {
  const airplanePattern = indexSource.styles.match(/\.sesiones\{[^}]*background-image:url\("([^"]+)"\)/)?.[1];
  if (!airplanePattern) return source;

  return {
    ...source,
    styles: source.styles
      .replace(/url\("data:image\/svg\+xml,[^"]*florcita[^"]*"\)/, `url("${airplanePattern}")`)
      .replace("background-size:340px 340px, cover;", "background-size:380px 380px, cover;"),
  };
}

export default async function GuidePage() {
  const { settings } = await getContentBundle();
  const document = withIndexAirplaneBackground(
    miniGuideDocument as LegacySource,
    homeDocument as LegacySource,
  );
  return <LegacyDocument document={document} pageKey="mini-guide" body={renderMiniGuide(document, settings)} />;
}
