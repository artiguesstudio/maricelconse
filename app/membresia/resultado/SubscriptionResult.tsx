"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SubscriptionResult() {
  const [active, setActive] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let attempts = 0;
    let stopped = false;
    async function check() {
      attempts += 1;
      try {
        const response = await fetch("/api/subscriptions/status", { cache: "no-store" });
        const body = await response.json() as { active?: boolean };
        if (body.active) {
          setActive(true);
          setChecking(false);
          return;
        }
      } catch {
        // Se permite reintentar mientras Mercado Pago confirma el cobro.
      }
      if (!stopped && attempts < 20) window.setTimeout(check, 3000);
      else if (!stopped) setChecking(false);
    }
    void check();
    return () => { stopped = true; };
  }, []);

  if (active) {
    return (
      <>
        <h1>¡Ya estás a bordo!</h1>
        <p>Mercado Pago confirmó tu suscripción y tu espacio ya está habilitado.</p>
        <Link className="button button--dark" href="/mi-espacio">Entrar a mi espacio →</Link>
      </>
    );
  }

  return (
    <>
      <h1>Estamos confirmando tu pago.</h1>
      <p>{checking ? "Esto suele demorar solo unos segundos. Podés dejar esta pantalla abierta." : "Mercado Pago todavía no confirmó la acreditación. No hace falta volver a pagar."}</p>
      <div className="subscription-actions">
        <button className="button button--outline" type="button" onClick={() => window.location.reload()}>Volver a comprobar</button>
        {!checking && <Link className="text-link" href="/mi-espacio/membresia">Ver estado de mi membresía</Link>}
      </div>
    </>
  );
}
