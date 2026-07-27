import type { Metadata } from "next";
import Link from "next/link";
import { getContentBundle, type ResourceRecord } from "../../db/content";
import { getMemberSession } from "../admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi espacio" };

const resourceLabels: Record<ResourceRecord["kind"], { title: string; description: string; mark: string }> = {
  class: { title: "Clases grabadas", description: "Todo lo que ya recorrimos, guardado mes a mes.", mark: "▶" },
  activity: { title: "Actividades", description: "Ejercicios para llevar lo trabajado a tu vida.", mark: "✎" },
  audio: { title: "Audios", description: "Prácticas guiadas para escuchar con calma.", mark: "◉" },
  guide: { title: "Guías", description: "Primeros pasos y materiales para orientarte.", mark: "◇" },
  resource: { title: "Biblioteca", description: "Lecturas y recursos complementarios.", mark: "＋" },
};

export default async function MemberAreaPage() {
  const { user, active } = await getMemberSession();
  const { settings, resources } = await getContentBundle();
  if (!active) {
    return (
      <main className="member-shell">
        <MemberTopbar name={user.displayName} />
        <section className="member-gate"><p className="eyebrow">Tu cuenta está creada</p><h1>Falta vincular tu membresía.</h1><p>Cuando se confirme tu suscripción, este espacio se habilitará automáticamente. Si ya pagaste, escribinos y lo revisamos.</p><a className="button button--cream" href={settings.whatsapp_url}>Pedir ayuda</a></section>
      </main>
    );
  }
  const published = resources.filter((resource) => resource.isPublished);
  const grouped = Object.keys(resourceLabels).map((kind) => ({
    kind: kind as ResourceRecord["kind"],
    items: published.filter((resource) => resource.kind === kind),
  })).filter((group) => group.items.length > 0);
  return (
    <main className="member-shell">
      <MemberTopbar name={user.displayName} />
      <section className="member-welcome">
        <div><p className="eyebrow">¡Tu viaje ya comenzó!</p><h1>Bienvenida a bordo.</h1><p>No llegaste hasta acá para seguir siendo la misma. Llegaste para volver a vos y animarte a ir por más.</p></div>
        <div className="member-pass"><span>Vuelo interior</span><strong>HQS · 2802</strong><small>Acceso activo</small></div>
      </section>
      <section className="current-month">
        <div><span>Parada de este mes</span><h2>{settings.current_theme}</h2><p>{settings.current_theme_description}</p></div>
        <div className="next-session"><span>Próximo encuentro</span><strong>{settings.next_session_label}</strong>{settings.next_session_url ? <a className="button button--dark" href={settings.next_session_url} target="_blank" rel="noreferrer">Entrar al encuentro</a> : <small>El acceso aparecerá acá cuando esté listo.</small>}</div>
      </section>
      <section className="member-library">
        <div className="section-heading"><p className="eyebrow">Tu viaje hacia adentro</p><h2>Todo en un mismo lugar.</h2></div>
        <div className="member-folders">
          {grouped.map(({ kind, items }) => {
            const meta = resourceLabels[kind];
            return <details key={kind} open={kind === "guide"}><summary><span className="folder-mark">{meta.mark}</span><div><h3>{meta.title}</h3><p>{meta.description}</p></div><b>+</b></summary><div className="folder-items">{items.map((item) => <article key={item.id}><div><small>{item.monthLabel}</small><h4>{item.title}</h4><p>{item.description}</p></div>{item.url ? <a href={item.url} target={item.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">Abrir →</a> : <span>Próximamente</span>}</article>)}</div></details>;
          })}
        </div>
      </section>
      <footer className="member-footer"><p>El viaje puede desordenarte antes de llevarte hacia una nueva versión de vos.</p><Link href="/guia-de-viaje">Ver guía de viaje →</Link></footer>
    </main>
  );
}

function MemberTopbar({ name }: { name: string }) {
  return <header className="member-topbar"><Link className="brand brand--light" href="/"><span>MARICEL</span><em>Conse</em></Link><nav><Link href="/">Ver web</Link><span>{name}</span><form action="/auth/signout" method="post"><button className="link-button link-button--light" type="submit">Salir</button></form></nav></header>;
}
