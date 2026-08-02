import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSubscription } from "../../../db/subscriptions";
import { getSignedInSession } from "../../admin-auth";
import { SiteHeader } from "../../components/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar membresía", robots: { index: false, follow: false } };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" })
    .format(new Date(value));
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, params] = await Promise.all([
    getSignedInSession("/membresia/suscribirme"),
    searchParams,
  ]);
  const subscription = await getCurrentSubscription(session.id);
  const active = Boolean(subscription?.accessUntil && new Date(subscription.accessUntil) > new Date());

  return (
    <main className="subscription-shell">
      <SiteHeader compact />
      <section className="subscription-card">
        <p className="eyebrow">Bienvenidas a bordo</p>
        {active ? (
          <>
            <h1>Tu membresía ya está vigente.</h1>
            <p>Tenés acceso hasta el {formatDate(subscription!.accessUntil)}.</p>
            <div className="subscription-actions">
              <Link className="button button--dark" href="/mi-espacio">Entrar a mi espacio</Link>
              <Link className="text-link" href="/mi-espacio/membresia">Administrar membresía</Link>
            </div>
          </>
        ) : (
          <>
            <h1>Confirma tu embarque.</h1>
            <p>La suscripción se cobrará en la cuenta de Mercado Pago de Maricel y se renovará automáticamente cada mes.</p>
            <div className="subscription-summary">
              <span>Plan mensual</span>
              <strong>$51.999 ARS</strong>
              <small>Sin permanencia · podes cancelar cuando quieras</small>
            </div>
            <dl className="subscription-details">
              <div><dt>Cuenta</dt><dd>{session.email}</dd></div>
              <div><dt>Vigencia</dt><dd>Un mes desde cada pago acreditado</dd></div>
              <div><dt>Al cancelar</dt><dd>Conservas el acceso hasta terminar el período abonado</dd></div>
            </dl>
            {params.error && (
              <p className="subscription-error" role="alert">Todavía no pudimos abrir Mercado Pago. Intentá nuevamente o escribile a Maricel.</p>
            )}
            <form action="/api/subscriptions/checkout" method="post">
              <button className="button button--dark subscription-submit" type="submit">Continuar a Mercado Pago →</button>
            </form>
            <p className="subscription-fineprint">El medio de pago se carga de forma segura en Mercado Pago. Maricel Conse no recibe ni almacena los datos de tu tarjeta.</p>
          </>
        )}
        <Link className="login-back" href="/membresia">← Volver a la membresía</Link>
      </section>
    </main>
  );
}
