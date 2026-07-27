"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";

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
      setMessage(error instanceof Error ? error.message : "No pudimos enviar el enlace.");
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
