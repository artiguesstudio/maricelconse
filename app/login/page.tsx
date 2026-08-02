import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false, follow: false } };

function safeNextPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/mi-espacio";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <Link className="brand" href="/"><span>MARICEL</span><em>Conse</em></Link>
        <p className="eyebrow">Tu espacio privado</p>
        <h1>Ingresa sin contraseña.</h1>
        <p>Escribí tu email y vas a recibir un enlace seguro para entrar.</p>
        {params.error && <p className="login-message error">El enlace venció o ya fue utilizado. Pedí uno nuevo.</p>}
        <LoginForm nextPath={safeNextPath(params.next)} />
        <Link className="login-back" href="/">← Volver a la web</Link>
      </section>
    </main>
  );
}
