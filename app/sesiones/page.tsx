import type { Metadata } from "next";
import { getContentBundle } from "../../db/content";
import sessionsDocument from "../legacy/generated/sessions.json";
import { LegacyDocument, type LegacySource } from "../legacy/LegacyDocument";
import { renderSessions } from "../legacy/render";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sesiones online 1:1" };

export default async function SessionsPage() {
  const { settings } = await getContentBundle();
  const document = sessionsDocument as LegacySource;
  return <LegacyDocument document={document} pageKey="sessions" body={renderSessions(document, settings)} />;
}
