"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BoardingPassWelcome } from "./BoardingPassWelcome";

export function SubscriptionResult({ initialName, initialDepartureDate }: { initialName: string; initialDepartureDate: string }) {
  const [active, setActive] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let attempts = 0;
    let stopped = false;
    async function check() {
      attempts += 1;
      try {
        const callback = new URLSearchParams(window.location.search);
        const preapprovalId = callback.get("preapproval_id") || callback.get("preapprovalId") || callback.get("subscription_id");
        const statusUrl = preapprovalId
          ? `/api/subscriptions/status?preapproval_id=${encodeURIComponent(preapprovalId)}`
          : "/api/subscriptions/status";
        const response = await fetch(statusUrl, { cache: "no-store" });
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
    return <BoardingPassWelcome initialName={initialName} initialDepartureDate={initialDepartureDate} />;
  }

  return (
    <>
      <h1>Estamos confirmando tu pago.</h1>
      <p>{checking ? "Esto suele demorar solo unos segundos. Podes dejar esta pantalla abierta." : "Mercado Pago todavía no confirmó la acreditación. No hace falta volver a pagar."}</p>
      <div className="subscription-actions">
        <button className="button button--outline" type="button" onClick={() => window.location.reload()}>Volver a comprobar</button>
        {!checking && <Link className="text-link" href="/mi-espacio/membresia">Ver estado de mi membresía</Link>}
      </div>
    </>
  );
}
