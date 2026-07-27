import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getContentBundle } from "../../db/content";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ebooks" };

export default async function EbooksPage() {
  const { settings, ebooks } = await getContentBundle();
  const visibleEbooks = ebooks.filter((ebook) => ebook.isPublished);
  return (
    <main>
      <div className="inner-hero inner-hero--ebooks">
        <SiteHeader compact />
        <div className="ebook-intro">
          <Link className="back-link" href="/">← Volver al inicio</Link>
          <p className="eyebrow">Para trabajar a tu ritmo</p>
          <h1>Ebooks para volver a vos.</h1>
          <p className="lead">Guías breves y prácticas para el momento que estás atravesando, con ejercicios que podés llevar a tu vida real.</p>
        </div>
      </div>
      <section className="ebook-catalog section">
        {visibleEbooks.map((ebook, index) => {
          const href = ebook.purchaseUrl || `${settings.whatsapp_url}?text=${encodeURIComponent(`Hola Maricel, quiero el ebook «${ebook.title}»`)}`;
          return (
            <article className="ebook-row" key={ebook.id}>
              <div className="ebook-row__cover"><Image src={ebook.coverImage || "/images/ebooks-tablet.jpg"} alt={`Portada de ${ebook.title}`} fill unoptimized sizes="(max-width: 760px) 72vw, 28vw" /></div>
              <div className="ebook-row__copy">
                <p className="eyebrow">Edición {String(index + 1).padStart(2, "0")}</p>
                <h2>{ebook.title}</h2>
                <h3>{ebook.subtitle}</h3>
                <p>{ebook.description}</p>
                <div className="ebook-price"><del>{ebook.regularPrice}</del><strong>{ebook.salePrice}</strong></div>
                <a className="button button--dark" href={href} target="_blank" rel="noreferrer">Quiero este ebook</a>
              </div>
            </article>
          );
        })}
      </section>
      <SiteFooter instagramUrl={settings.instagram_url} whatsappUrl={settings.whatsapp_url} />
    </main>
  );
}
