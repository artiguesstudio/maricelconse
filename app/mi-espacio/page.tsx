import type { Metadata } from "next";
import { getContentBundle } from "../../db/content";
import { getMemberSession } from "../admin-auth";
import memberDocument from "../legacy/generated/member.json";
import { LegacyDocument, type LegacySource } from "../legacy/LegacyDocument";
import { renderMember } from "../legacy/render";
import { getMemberProfile } from "../../db/profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi espacio · Bienvenida a bordo" };

export default async function MemberAreaPage() {
  const { active, user } = await getMemberSession();
  const [{ settings, resources, ebooks }, profile] = await Promise.all([getContentBundle(), getMemberProfile(user.id)]);

  if (!active) {
    return (
      <main className="member-shell">
        <section className="member-gate">
          <p className="eyebrow">Tu cuenta está creada</p>
          <h1>Falta vincular tu membresía.</h1>
          <p>Cuando se confirme tu suscripción, este espacio se habilitará automáticamente. Si ya pagaste, escribinos y lo revisamos.</p>
          <div className="subscription-actions">
            <a className="button button--cream" href="/membresia/suscribirme">Sumarme a la membresía</a>
            <a className="text-link" href="/mi-espacio/membresia">Ver estado</a>
            <a className="text-link" href={settings.whatsapp_url}>Pedir ayuda</a>
          </div>
        </section>
      </main>
    );
  }

  const document = memberDocument as LegacySource;
  const profileCompleted = Boolean(profile.profileCompletedAt && profile.journeyArrival && profile.membershipGoal);
  return <LegacyDocument document={document} pageKey="member" body={renderMember(document, settings, resources, ebooks, profileCompleted)} />;
}
