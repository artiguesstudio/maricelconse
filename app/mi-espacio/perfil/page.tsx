import type { Metadata } from "next";
import { SiteHeader } from "../../components/SiteHeader";
import { getMemberSession } from "../../admin-auth";
import { getMemberProfile } from "../../../db/profile";
import { ProfileForm } from "./ProfileForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Completar perfil", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const { user, active } = await getMemberSession("/mi-espacio/perfil");
  if (!active) redirect("/mi-espacio/membresia");
  const profile = await getMemberProfile(user.id);
  return (
    <main className="subscription-shell profile-shell">
      <SiteHeader compact />
      <section className="subscription-card profile-card">
        <p className="eyebrow">Tu ficha de pasajera</p>
        <h1>Completá tu perfil.</h1>
        <p>Estos datos son privados y nos ayudan a acompañarte mejor dentro de la academia.</p>
        <ProfileForm profile={profile} />
      </section>
    </main>
  );
}
