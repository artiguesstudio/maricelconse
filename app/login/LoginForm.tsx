"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Step = "email" | "code";
type Status = "idle" | "sending" | "verifying";

function authErrorMessage(error: unknown, step: Step) {
  const technicalMessage = error instanceof Error ? error.message : "";
  const normalizedMessage = technicalMessage.toLowerCase();

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("security purposes")) {
    return "Pediste varios códigos seguidos. Espera 60 segundos y solicita uno nuevo.";
  }

  if (
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("invalid") ||
    normalizedMessage.includes("token")
  ) {
    return "El código es incorrecto o venció. Revisa el último correo recibido o solicita uno nuevo.";
  }

  if (normalizedMessage.includes("not authorized")) {
    return "Este correo todavía no está autorizado para ingresar.";
  }

  return step === "code"
    ? "No pudimos comprobar el código. Revisa los ocho números y vuelve a intentar."
    : "No pudimos enviar el código. Espera unos minutos y vuelve a intentar.";
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | null>(null);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function requestCode() {
    setStatus("sending");
    setMessage("");
    setMessageKind(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;

      setCode("");
      setStep("code");
      setMessage("Te enviamos un código de ocho dígitos. Copialo aquí para ingresar.");
      setMessageKind("success");
    } catch (error) {
      setMessage(authErrorMessage(error, "email"));
      setMessageKind("error");
    } finally {
      setStatus("idle");
    }
  }

  async function verifyCode() {
    setStatus("verifying");
    setMessage("");
    setMessageKind(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: "email",
      });
      if (error) throw error;

      window.location.replace(nextPath);
    } catch (error) {
      setMessage(authErrorMessage(error, "code"));
      setMessageKind("error");
      setStatus("idle");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "email") await requestCode();
    else await verifyCode();
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setMessage("");
    setMessageKind(null);
  }

  const busy = status !== "idle";

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {step === "email" ? (
        <>
          <label htmlFor="login-email">Tu email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nombre@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            required
          />
          <button className="button button--dark" disabled={busy}>
            {status === "sending" ? "Enviando…" : "Recibir código de acceso"}
          </button>
        </>
      ) : (
        <>
          <div className="login-code-heading">
            <label htmlFor="login-code">Código de acceso</label>
            <button type="button" className="login-inline-action" onClick={changeEmail} disabled={busy}>
              Cambiar email
            </button>
          </div>
          <p className="login-email-confirmation">Enviado a <strong>{normalizedEmail}</strong></p>
          <input
            id="login-code"
            name="code"
            className="login-code-input"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            placeholder="00000000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
            disabled={busy}
            autoFocus
            required
          />
          <button className="button button--dark" disabled={busy || code.length !== 8}>
            {status === "verifying" ? "Comprobando…" : "Ingresar a mi espacio"}
          </button>
          <button type="button" className="login-resend" onClick={requestCode} disabled={busy}>
            No recibí el código · Enviar otro
          </button>
        </>
      )}
      {message && (
        <p className={`login-message ${messageKind || "error"}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
