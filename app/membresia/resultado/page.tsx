import type { Metadata } from "next";
import Link from "next/link";
import { getSignedInSession } from "../../admin-auth";
import { SiteHeader } from "../../components/SiteHeader";
import { SubscriptionResult } from "./SubscriptionResult";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estado de la membresía", robots: { index: false, follow: false } };

export default async function SubscriptionResultPage() {
  await getSignedInSession("/membresia/resultado");
  return (
    <main className="subscription-shell">
      <SiteHeader compact />
      <section className="subscription-card subscription-card--center">
        <p className="eyebrow">Bienvenidas a bordo</p>
        <SubscriptionResult />
        <Link className="login-back" href="/">← Volver a la web</Link>
      </section>
    </main>
  );
}
