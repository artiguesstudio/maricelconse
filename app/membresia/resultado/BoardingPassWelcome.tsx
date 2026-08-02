"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function BoardingPassWelcome({ initialName, initialDepartureDate }: { initialName: string; initialDepartureDate: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [departureDate, setDepartureDate] = useState(initialDepartureDate || new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function beginJourney() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "welcome", displayName, departureDate }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar la tarjeta.");
      router.push("/mi-espacio");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la tarjeta.");
      setSaving(false);
    }
  }

  return (
    <div className="welcome-pass">
      <div className="welcome-pass__intro">
        <p className="eyebrow">Pago confirmado</p>
        <h1>¡Ya estás a bordo!</h1>
        <p>Personalizá tu tarjeta de bienvenida, guardala o imprimila y empezá tu viaje.</p>
      </div>
      <div className="welcome-pass__scroll">
        <div className="welcome-pass__canvas">
          <Image src="/images/boarding-pass.png" alt="Tarjeta de bienvenida Tu viaje hacia adentro" width={1680} height={945} priority unoptimized />
          <input
            aria-label="Pasajera"
            className="welcome-pass__name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Tu nombre y apellido"
            maxLength={120}
          />
          <input
            aria-label="Fecha de partida"
            className="welcome-pass__date"
            type="date"
            value={departureDate}
            onChange={(event) => setDepartureDate(event.target.value)}
          />
        </div>
      </div>
      <div className="welcome-pass__mobile-fields">
        <label><span>Pasajera</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
        <label><span>Fecha de partida</span><input type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} /></label>
      </div>
      {error && <p className="subscription-error" role="alert">{error}</p>}
      <div className="welcome-pass__actions">
        <button className="button button--outline" type="button" onClick={() => window.print()}>Imprimir tarjeta</button>
        <button className="button button--dark" type="button" disabled={saving} onClick={beginJourney}>{saving ? "Guardando…" : "Comenzar mi viaje →"}</button>
      </div>
    </div>
  );
}
