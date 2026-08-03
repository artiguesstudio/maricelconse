"use client";

import { useState } from "react";

export function CancelSubscriptionButton() {
  const [state, setState] = useState<"idle" | "confirm" | "saving" | "done" | "error">("idle");
  const [accessUntil, setAccessUntil] = useState("");

  async function cancel() {
    setState("saving");
    try {
      const response = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const body = await response.json() as { error?: string; accessUntil?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo completar la baja.");
      setAccessUntil(body.accessUntil || "");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="subscription-success">La renovación quedó cancelada. {accessUntil ? `Tu acceso continúa hasta el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(accessUntil))}.` : "Tu acceso continuará hasta finalizar el período abonado."}</p>;
  }

  if (state === "confirm") {
    return (
      <div className="subscription-cancel-confirm">
        <p>Se detendrán los próximos cobros, pero conservarás el acceso hasta finalizar el mes ya pagado.</p>
        <button className="button button--dark button--small" type="button" onClick={cancel}>Sí, cancelar renovación</button>
        <button className="text-link link-button" type="button" onClick={() => setState("idle")}>Volver</button>
      </div>
    );
  }

  return (
    <div>
      {state === "error" && <p className="subscription-error">No pudimos completar la baja. Intenta nuevamente o escribile a Maricel.</p>}
      <button className="button button--outline button--small" disabled={state === "saving"} type="button" onClick={() => setState("confirm")}>Cancelar renovación</button>
    </div>
  );
}
