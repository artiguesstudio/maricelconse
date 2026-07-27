import type { Metadata } from "next";
import Link from "next/link";
import { getContentBundle } from "../../db/content";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Membresía Bienvenidas a bordo" };

const includes = [
  ["Comunidad privada", "Un espacio seguro para compartir y sentirte acompañada."],
  ["Tres clases en vivo", "Cada mes trabajamos una temática con herramientas concretas."],
  ["Mentoría grupal", "Un encuentro mensual para preguntas y situaciones personales."],
  ["Ejercicios semanales", "Propuestas para llevar lo aprendido a tu vida cotidiana."],
  ["Clases grabadas", "Acceso a cada encuentro para verlo cuando tengas tiempo."],
  ["Audios y bitácora", "Prácticas guiadas y un registro de tu transformación."],
];

export default async function MembershipPage() {
  const { settings } = await getContentBundle();
  const checkout = settings.membership_purchase_url || `${settings.whatsapp_url}?text=${encodeURIComponent("Hola Maricel, quiero sumarme a Bienvenidas a bordo")}`;
  return (
    <main>
      <div className="membership-page-hero">
        <SiteHeader compact />
        <div className="boarding-pass">
          <div className="boarding-pass__brand"><span>HQS · 2802</span><span>Tarjeta de embarque</span></div>
          <div className="boarding-pass__main">
            <div>
              <Link className="back-link back-link--light" href="/">← Volver al inicio</Link>
              <p className="eyebrow">Membresía mensual</p>
              <h1>{settings.membership_title}</h1>
              <p>{settings.membership_body}</p>
            </div>
            <div className="route-map"><span>La mujer que soy</span><i>✦ · · · ✈</i><span>La mujer que elijo ser</span></div>
          </div>
          <div className="boarding-pass__price">
            <div><span>Pasajera</span><strong>Vos</strong></div>
            <div><span>Duración</span><strong>Mes a mes</strong></div>
            <div className="price"><del>{settings.membership_price_regular}</del><strong>{settings.membership_price_sale}</strong><small>por mes</small></div>
            <a className="button button--cream" href={checkout} target="_blank" rel="noreferrer">Quiero embarcar</a>
          </div>
        </div>
      </div>
      <section className="membership-includes section">
        <div className="section-heading section-heading--center"><p className="eyebrow">Todo lo que te espera adentro</p><h2>Un espacio que te acompaña entre encuentro y encuentro.</h2></div>
        <div className="include-grid">{includes.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className="how-it-works section section--sage">
        <div className="section-heading"><p className="eyebrow">Estás a punto de abordar</p><h2>Sumarte es muy simple.</h2></div>
        <ol><li><span>1</span><div><h3>Elegís cómo sumarte</h3><p>Completás el pago desde el enlace seguro.</p></div></li><li><span>2</span><div><h3>Recibís tu bienvenida</h3><p>Te llega por email todo lo necesario para ingresar.</p></div></li><li><span>3</span><div><h3>Entrás a la comunidad</h3><p>Explorás el contenido y empezás tu viaje.</p></div></li></ol>
      </section>
      <section className="final-cta"><p className="eyebrow">Tu viaje hacia adentro</p><h2>El viaje más importante empieza cuando dejás de huir de vos.</h2><a className="button button--cream" href={checkout} target="_blank" rel="noreferrer">Estoy lista para volver</a></section>
      <SiteFooter instagramUrl={settings.instagram_url} whatsappUrl={settings.whatsapp_url} />
    </main>
  );
}
