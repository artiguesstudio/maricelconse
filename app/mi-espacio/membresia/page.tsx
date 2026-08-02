import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSubscription } from "../../../db/subscriptions";
import { getSignedInSession } from "../../admin-auth";
import { SiteHeader } from "../../components/SiteHeader";
import { CancelSubscriptionButton } from "./CancelSubscriptionButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi membresía", robots: { index: false, follow: false } };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" })
    .format(new Date(value));
}

export default async function ManageSubscriptionPage() {
  const session = await getSignedInSession("/mi-espacio/membresia");
  const subscription = await getCurrentSubscription(session.id);
  const active = Boolean(subscription?.accessUntil && new Date(subscription.accessUntil) > new Date());
  const canceled = subscription?.status === "canceled" || subscription?.cancelAtPeriodEnd;

  return (
    <main className="subscription-shell">
      <SiteHeader compact />
      <section className="subscription-card">
        <p className="eyebrow">Tu cuenta</p>
        <h1>Mi membresía</h1>
        {!subscription ? (
          <>
            <p>Todavía no hay una suscripción de Mercado Pago vinculada a {session.email}.</p>
            <Link className="button button--dark" href="/membresia/suscribirme">Sumarme a la membresía</Link>
          </>
        ) : (
          <>
            <div className={`subscription-status ${active ? "active" : "inactive"}`}>
              <span>{active ? "Acceso vigente" : "Sin acceso vigente"}</span>
              <strong>{canceled ? "Renovación cancelada" : subscription.status === "authorized" ? "Renovación automática activa" : "Confirmación pendiente"}</strong>
            </div>
            <dl className="subscription-details">
              <div><dt>Cuenta</dt><dd>{subscription.payerEmail}</dd></div>
              <div><dt>Importe</dt><dd>$51.999 ARS por mes</dd></div>
              <div><dt>Acceso hasta</dt><dd>{subscription.accessUntil ? formatDate(subscription.accessUntil) : "Pendiente de acreditación"}</dd></div>
              {!canceled && subscription.nextPaymentDate && <div><dt>Próximo cobro</dt><dd>{formatDate(subscription.nextPaymentDate)}</dd></div>}
            </dl>
            {active && !canceled && <CancelSubscriptionButton />}
            {!active && !canceled && <Link className="button button--dark" href="/membresia/resultado">Comprobar acreditación</Link>}
          </>
        )}
        <div className="subscription-actions">
          <Link className="login-back" href="/mi-espacio">← Volver a mi espacio</Link>
        </div>
      </section>
    </main>
  );
}
