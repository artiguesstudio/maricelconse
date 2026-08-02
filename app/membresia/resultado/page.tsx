import type { Metadata } from "next";
import Link from "next/link";
import { getSignedInSession } from "../../admin-auth";
import { SiteHeader } from "../../components/SiteHeader";
import { SubscriptionResult } from "./SubscriptionResult";
import { getMemberProfile } from "../../../db/profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estado de la membresía", robots: { index: false, follow: false } };

export default async function SubscriptionResultPage() {
  const user = await getSignedInSession("/membresia/resultado");
  const profile = await getMemberProfile(user.id);
  return (
    <main className="subscription-shell subscription-shell--welcome">
      <SiteHeader compact />
      <section className="subscription-card subscription-card--center subscription-card--welcome">
        <SubscriptionResult initialName={profile.displayName || user.fullName || ""} initialDepartureDate={profile.departureDate} />
        <Link className="login-back" href="/">← Volver a la web</Link>
      </section>
    </main>
  );
}
