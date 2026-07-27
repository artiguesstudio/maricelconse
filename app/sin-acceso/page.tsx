import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

export default function NoAccessPage() {
  return <main className="access-page"><SiteHeader compact /><section><p className="eyebrow">Acceso reservado</p><h1>Este espacio todavía no está habilitado para tu cuenta.</h1><p>Si ya sos parte de la membresía o administrás el sitio, escribile a Maricel para vincular tu acceso.</p><div><Link className="button button--dark" href="/">Volver al inicio</Link><a className="text-link" href="https://wa.me/5492964406552" target="_blank" rel="noreferrer">Pedir ayuda por WhatsApp ↗</a></div></section></main>;
}
