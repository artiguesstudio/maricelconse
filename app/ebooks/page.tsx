import type { Metadata } from "next";
import { getContentBundle } from "../../db/content";
import ebooksDocument from "../legacy/generated/ebooks.json";
import { LegacyDocument, type LegacySource } from "../legacy/LegacyDocument";
import { renderEbooks } from "../legacy/render";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ebooks" };

export default async function EbooksPage() {
  const { settings, ebooks } = await getContentBundle();
  const document = ebooksDocument as LegacySource;
  return <LegacyDocument document={document} pageKey="ebooks" body={renderEbooks(document, settings, ebooks)} />;
}
