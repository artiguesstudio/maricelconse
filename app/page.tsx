import type { Metadata } from "next";
import { getContentBundle } from "../db/content";
import { LegacyDocument, type LegacySource } from "./legacy/LegacyDocument";
import homeDocument from "./legacy/generated/home.json";
import { renderHome } from "./legacy/render";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Salí a comerte el mundo",
  description:
    "Coaching para mujeres que están cansadas de esperar. Dejá de postergarte y andá por todo. Sesiones online 1:1.",
};

export default async function Home() {
  const { settings } = await getContentBundle();
  const document = homeDocument as LegacySource;
  return <LegacyDocument document={document} pageKey="home" body={renderHome(document, settings)} />;
}
