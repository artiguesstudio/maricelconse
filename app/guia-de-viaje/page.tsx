import Link from "next/link";
import { redirect } from "next/navigation";
import { getMemberSession } from "../admin-auth";

export const dynamic = "force-dynamic";

const folders = [
  ["Próximo encuentro", "El acceso actualizado a la clase en vivo aparece arriba de todo."],
  ["Clases grabadas", "Cada clase queda guardada por mes para verla cuando puedas."],
  ["Actividades", "Ejercicios descargables para imprimir o completar en tu cuaderno."],
  ["Audios", "Prácticas guiadas para escuchar con auriculares y en un momento tranquilo."],
  ["Biblioteca", "Guías, lecturas y materiales para profundizar cuando tengas ganas."],
];

export default async function TravelGuidePage() {
  const { active } = await getMemberSession("/guia-de-viaje");
  if (!active) redirect("/sin-acceso?area=membresia");
  return <main className="travel-guide"><header><Link className="brand brand--light" href="/"><span>MARICEL</span><em>Conse</em></Link><Link href="/mi-espacio">← Volver a mi espacio</Link></header><section className="travel-guide__hero"><p className="eyebrow">Guía de viaje</p><h1>¿Cómo funciona este espacio?</h1><p>Te cuento dónde está cada cosa para que aproveches todo sin perderte nada.</p></section><section className="travel-guide__steps"><h2>Primeros pasos</h2>{[["Entrá a tu espacio", "Guardá el enlace en favoritos para volver cuando quieras."],["Mirá la parada del mes", "Arriba vas a encontrar la temática actual y el próximo encuentro."],["Abrí la carpeta que necesites", "Cada carpeta reúne materiales del mismo tipo."],["Elegí el contenido", "Los recursos están ordenados por mes y se abren en una nueva pestaña."]].map(([title,text],index)=><article key={title}><span>{String(index+1).padStart(2,"0")}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</section><section className="travel-guide__folders"><p className="eyebrow">¿Qué vas a encontrar?</p><h2>Cinco carpetas, siempre en el mismo lugar.</h2><div>{folders.map(([title,text])=><article key={title}><span>HQS–2802</span><h3>{title}</h3><p>{text}</p></article>)}</div></section><section className="guide-promise"><p className="eyebrow">Lista para despegar</p><h2>Explorá a tu ritmo. Este espacio es tuyo.</h2><Link className="button button--cream" href="/mi-espacio">Volver a mi espacio</Link></section></main>;
}
