import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getContentBundle } from "../../db/content";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sesiones online 1:1" };

const topics = [
  ["Dejar de postergarte", "Soltar las excusas y empezar con pasos posibles."],
  ["Recuperar la confianza", "Reconocer lo que ya superaste y volver a creer en vos."],
  ["Darle forma a tus metas", "Tener claridad y dejar de mirar tu vida desde afuera."],
  ["Salir de la zona cómoda", "Atravesar ese miedo que aparece justo antes de crecer."],
  ["Animarte a volar", "Expandirte y construir una vida que te entusiasme."],
  ["Reconectar con vos", "Bajar el ruido externo y escuchar lo que necesitás."],
];

export default async function SessionsPage() {
  const { settings } = await getContentBundle();
  const whatsapp = `${settings.whatsapp_url}?text=${encodeURIComponent("Hola Maricel, quiero reservar una sesión online")}`;
  return (
    <main>
      <div className="inner-hero inner-hero--sessions">
        <SiteHeader compact />
        <div className="inner-hero__grid">
          <div>
            <Link className="back-link" href="/">← Volver al inicio</Link>
            <p className="eyebrow">Sesiones online 1:1</p>
            <h1>Un espacio para dejar de frenarte.</h1>
            <p className="lead">Encuentros por videollamada para entender eso que hoy te frena y empezar a moverte hacia la vida que querés.</p>
            <a className="button button--dark" href={whatsapp} target="_blank" rel="noreferrer">Reservar mi sesión</a>
          </div>
          <div className="inner-hero__photo"><Image src="/images/maricel-sesiones.jpg" alt="Maricel Conse en su espacio de trabajo" fill unoptimized priority sizes="(max-width: 760px) 90vw, 40vw" /></div>
        </div>
      </div>
      <section className="topics section">
        <div className="section-heading"><p className="eyebrow">Un encuentro hecho para vos</p><h2>¿Qué podemos trabajar juntas?</h2></div>
        <div className="topic-grid">
          {topics.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="session-details section section--sage">
        <div className="section-heading"><p className="eyebrow">¿En qué consiste?</p><h2>Una pausa con dirección.</h2></div>
        <div className="detail-grid">
          <article><strong>01</strong><h3>Videollamada</h3><p>Desde donde estés, en un espacio cómodo y tranquilo.</p></article>
          <article><strong>02</strong><h3>45 minutos</h3><p>Acompañamiento personalizado y enfocado en lo que hoy necesitás.</p></article>
          <article><strong>03</strong><h3>Acción concreta</h3><p>Ejercicios y propuestas para trasladar lo trabajado a tu día a día.</p></article>
        </div>
      </section>
      <section className="final-cta"><p className="eyebrow">Tu próximo paso puede ser hoy</p><h2>No necesitás tener todo claro para empezar.</h2><a className="button button--cream" href={whatsapp} target="_blank" rel="noreferrer">Hablar con Maricel</a></section>
      <SiteFooter instagramUrl={settings.instagram_url} whatsappUrl={settings.whatsapp_url} />
    </main>
  );
}
