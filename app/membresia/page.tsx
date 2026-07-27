import type { Metadata } from "next";
import { getContentBundle } from "../../db/content";
import membershipDocument from "../legacy/generated/membership.json";
import { LegacyDocument, type LegacySource } from "../legacy/LegacyDocument";
import { renderMembership } from "../legacy/render";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Membresía · Bienvenidas a bordo" };

export default async function MembershipPage() {
  const { settings } = await getContentBundle();
  const document = membershipDocument as LegacySource;
  return <LegacyDocument document={document} pageKey="membership" body={renderMembership(document, settings)} />;
}
