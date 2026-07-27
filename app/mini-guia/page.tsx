import type { Metadata } from "next";
import Link from "next/link";
import { getContentBundle } from "../../db/content";
import { SiteFooter } from "../components/SiteFooter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mini-guía · El primer paso para volver a vos" };

const steps = [
  ["Frená y date cuenta", "Antes de cambiar nada, reconocé sin culpa que hoy te perdiste un poco de vista.", "Apoyá una mano en el pecho y decite: «Acá estoy. Vuelvo a mí»."],
  ["Respirá tres veces", "Respirar consciente es la forma más rápida de volver al presente, al único lugar donde podés elegir.", "Inhalá en 4, sostené 2 y exhalá en 6. Repetilo tres veces."],
  ["Poné en palabras lo que sentís", "Nombrar lo que sentís le saca el poder de manejarte por dentro.", "Completá: «Ahora mismo me siento… y lo que necesito es…»."],
  ["Hacé una sola cosa por vos", "Volver no es un cambio enorme: es un gesto que elegís, sin pedir permiso.", "Elegí cinco minutos para un té, una caminata o una canción."],
  ["Hablate como a una amiga", "Sos la única persona con la que vas a convivir toda la vida. Empezá a estar de tu lado.", "Decite eso mismo que le dirías a una amiga en tu lugar."],
];

export default async function GuidePage() {
  const { settings } = await getContentBundle();
  const whatsapp = `${settings.whatsapp_url}?text=${encodeURIComponent("Hola Maricel, terminé la mini-guía y quiero dar el próximo paso")}`;
  return (
    <main className="guide-page">
      <header className="guide-cover">
        <Link className="brand" href="/"><span>MARICEL</span><em>Conse</em></Link>
        <p className="eyebrow">Mini-guía · Un regalo para vos</p>
        <h1>El primer paso<br />para volver a vos</h1>
        <p>Pequeños pasos para reconectar con vos misma, justo cuando sentís que perdés el rumbo.</p>
        <a href="#guia" className="guide-scroll">Empezar la guía ↓</a>
      </header>
      <section className="guide-intro section" id="guia"><p className="eyebrow">Antes de empezar</p><h2>Leé esto despacio, es para vos.</h2><p>Hay días en que funcionás en automático: cumplís con todo y con todos, menos con vos. No estás rota. Perderte un poco no fue tu culpa, pero volver sí es tu decisión. Y puede empezar hoy, con algo tan chico que cabe en cinco minutos.</p></section>
      <section className="guide-steps section">{steps.map(([title, text, practice], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{title}</h2><p>{text}</p><aside><strong>Probá esto</strong><p>{practice}</p></aside></div></article>)}</section>
      <section className="guide-promise section"><p className="eyebrow">Tu primer paso, hoy</p><h2>Elegí uno solo de los cinco.</h2><p>Tu vida no cambia el día que entendés todo. Cambia el día que hacés algo. Volver a vos no es un destino: es una decisión que tomás, un paso a la vez.</p><a className="button button--cream" href={whatsapp} target="_blank" rel="noreferrer">Quiero seguir acompañada</a></section>
      <SiteFooter instagramUrl={settings.instagram_url} whatsappUrl={settings.whatsapp_url} />
    </main>
  );
}
