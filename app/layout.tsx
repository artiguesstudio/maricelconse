import type { Metadata } from "next";
import { Archivo, Caveat, Fraunces, Jost, Montserrat, Mulish } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const mulish = Mulish({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Maricel Conse · Coaching ontológico";
  const description = "Coaching para mujeres que quieren dejar de postergarse, recuperar la confianza y volver a elegirse.";
  return {
    metadataBase: new URL(origin),
    title: { default: title, template: "%s · Maricel Conse" },
    description,
    icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
    openGraph: {
      type: "website",
      locale: "es_AR",
      url: `${origin}/`,
      siteName: "Maricel Conse",
      title,
      description,
      images: [
        {
          url: `${origin}/images/maricel-pasaporte.jpg`,
          width: 720,
          height: 1280,
          type: "image/jpeg",
          alt: "Maricel Conse sonriendo con su pasaporte en la mano",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/images/maricel-pasaporte.jpg`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${mulish.variable} ${fraunces.variable} ${archivo.variable} ${jost.variable} ${montserrat.variable} ${caveat.variable}`}>
        {children}
      </body>
    </html>
  );
}
