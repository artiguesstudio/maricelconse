"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";

function authErrorMessage(error: unknown) {
  const technicalMessage = error instanceof Error ? error.message : "";
  const normalizedMessage = technicalMessage.toLowerCase();

  if (normalizedMessage.includes("rate limit")) {
    return "Se alcanzó el límite temporal de correos. Esperá hasta una hora antes de pedir otro enlace y usá siempre el más reciente.";
  }

  if (normalizedMessage.includes("not authorized")) {
    return "Este correo todavía no está autorizado para recibir el enlace de acceso.";
  }

  return "No pudimos enviar el enlace. Esperá unos minutos y volvé a intentar.";
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      setStatus("sent");
      setMessage("Te enviamos un enlace. Revisá tu correo y abrilo desde este dispositivo.");
    } catch (error) {
      setStatus("idle");
      setMessage(authErrorMessage(error));
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="login-email">Tu email</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="nombre@email.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={status !== "idle"}
        required
      />
      <button className="button button--dark" disabled={status !== "idle"}>
        {status === "sending" ? "Enviando…" : status === "sent" ? "Enlace enviado" : "Recibir enlace mágico"}
      </button>
      {message && <p className={status === "sent" ? "login-message success" : "login-message error"} role="status">{message}</p>}
    </form>
  );
}
