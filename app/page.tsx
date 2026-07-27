import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getContentBundle } from "../db/content";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Volvé a elegirte",
  description:
    "Coaching ontológico, sesiones online, ebooks y una membresía para mujeres que quieren volver a elegirse.",
};

const promises = ["Animate", "Salí", "Empezá", "Volá alto", "Soltá el miedo", "Viví en grande"];

const benefits = [
  "Sentirte segura de lo que sentís y de las decisiones que tomás",
  "Poner límites sin quedarte atrapada en la culpa",
  "Confiar más en vos y menos en la aprobación de los demás",
  "Saber qué querés y animarte a ir por eso",
  "Atravesar los momentos difíciles sin volver a abandonarte",
];

const faqs = [
  [
    "¿Cómo son las sesiones?",
    "Son encuentros 1:1 por videollamada, de 45 minutos. Trabajamos eso que hoy te frena para que salgas con un paso concreto.",
  ],
  [
    "¿Necesito tener claro qué quiero trabajar?",
    "No. A veces el primer paso es animarte a escribir aunque todavía no sepas bien por dónde. Lo descubrimos juntas.",
  ],
  [
    "¿Esto reemplaza a la terapia psicológica?",
    "No. El coaching trabaja el hacia dónde voy y las acciones para avanzar. No trata cuadros clínicos.",
  ],
  [
    "¿Desde dónde puedo participar?",
    "Desde cualquier lugar. Todo el acompañamiento es online y se adapta a tu ritmo.",
  ],
];

export default async function Home() {
  const { settings, ebooks } = await getContentBundle();
  const featuredEbooks = ebooks.filter((ebook) => ebook.isPublished).slice(0, 3);
  const whatsapp = `${settings.whatsapp_url}?text=${encodeURIComponent("Hola Maricel, quiero empezar")}`;

  return (
    <main>
      <section className="hero-shell">
        <SiteHeader />
        <div className="hero">
          <div className="hero__copy">
            <p className="eyebrow">{settings.hero_eyebrow}</p>
            <h1>{settings.hero_title}</h1>
            <p className="hero__subtitle">{settings.hero_subtitle}</p>
            <div className="hero__actions">
              <Link className="button button--dark" href="/membresia">Conocé la membresía</Link>
              <a className="text-link" href={whatsapp} target="_blank" rel="noreferrer">Hablemos por WhatsApp <span>↗</span></a>
            </div>
            <div className="hero__proof" aria-label="Comunidad de Maricel Conse">
              <strong>+1.000</strong><span>Mujeres acompañadas</span>
              <i />
              <strong>+110K</strong><span>Comunidad en redes</span>
            </div>
          </div>
          <div className="hero__visual">
            <div className="hero__stamp">HQS<br /><strong>2802</strong></div>
            <div className="hero__photo-frame">
              <Image
                src="/images/maricel-pasaporte.jpg"
                alt="Maricel Conse con su pasaporte, lista para viajar"
                fill
                unoptimized
                priority
                sizes="(max-width: 760px) 88vw, 42vw"
              />
            </div>
            <div className="hero__ticket">
              <span>Próximo destino</span>
              <strong>Volver a vos</strong>
              <b>→</b>
            </div>
          </div>
        </div>
        <div className="promise-strip" aria-hidden="true">
          {[...promises, ...promises].map((promise, index) => <span key={`${promise}-${index}`}>{promise} ✦</span>)}
        </div>
      </section>

      <section className="story section" id="historia">
        <div className="story__images">
          <div className="story__image-main">
            <Image src="/images/maricel-paris.png" alt="Maricel frente a la Torre Eiffel" fill unoptimized sizes="(max-width: 760px) 90vw, 40vw" />
          </div>
          <div className="story__note">La vida que quería no estaba esperándome. Había que ir a buscarla.</div>
        </div>
        <div className="story__copy">
          <p className="eyebrow">Mi historia</p>
          <h2>{settings.story_title}</h2>
          <p>{settings.story_body}</p>
          <p>Si estás cansada de mirar tu vida desde afuera, estás en el lugar correcto.</p>
          <a className="button button--outline" href={whatsapp} target="_blank" rel="noreferrer">Quiero dar el primer paso</a>
        </div>
      </section>

      <section className="services section section--sage" id="servicios">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Este es tu punto de partida</p>
          <h2>¿Cómo puedo acompañarte?</h2>
          <p>No necesitás tener todo resuelto. Elegí la propuesta que más se acerque a lo que hoy necesitás.</p>
        </div>
        <div className="service-grid">
          <article className="service-card service-card--guide">
            <span className="service-card__number">01</span>
            <div className="service-card__image"><Image src="/images/mini-guia-portada.jpg" alt="Portada de la mini guía gratuita" fill unoptimized sizes="(max-width: 760px) 80vw, 28vw" /></div>
            <p className="card-kicker">Para empezar de a poco</p>
            <h3>Mini-guía gratuita</h3>
            <p>Cinco gestos simples para volver a vos cuando sentís que perdiste el rumbo.</p>
            <Link className="card-link" href="/mini-guia">Leer la guía <span>→</span></Link>
          </article>
          <article className="service-card service-card--session">
            <span className="service-card__number">02</span>
            <div className="service-card__image"><Image src="/images/maricel-sesiones.jpg" alt="Maricel preparando una sesión online" fill unoptimized sizes="(max-width: 760px) 80vw, 28vw" /></div>
            <p className="card-kicker">Acompañamiento personalizado</p>
            <h3>Sesiones online 1:1</h3>
            <p>Un encuentro enfocado en eso que hoy te frena y en el próximo paso que querés dar.</p>
            <Link className="card-link" href="/sesiones">Más información <span>→</span></Link>
          </article>
          <article className="service-card service-card--ebooks">
            <span className="service-card__number">03</span>
            <div className="service-card__image"><Image src="/images/ebooks-tablet.jpg" alt="Ebooks de Maricel Conse en una tablet" fill unoptimized sizes="(max-width: 760px) 80vw, 28vw" /></div>
            <p className="card-kicker">Para trabajar a tu ritmo</p>
            <h3>Ebooks</h3>
            <p>Recursos breves y prácticos para aplicar en tu día a día, estés donde estés.</p>
            <Link className="card-link" href="/ebooks">Ver los ebooks <span>→</span></Link>
          </article>
        </div>
      </section>

      <section className="membership-teaser section">
        <div className="membership-ticket">
          <div className="membership-ticket__top">
            <span>HQS · 2802</span><span>Tarjeta de embarque</span>
          </div>
          <div className="membership-ticket__body">
            <div>
              <p className="eyebrow">Membresía mensual</p>
              <h2>{settings.membership_title}</h2>
              <p>{settings.membership_body}</p>
              <Link className="button button--cream" href="/membresia">Quiero iniciar mi viaje</Link>
            </div>
            <div className="membership-ticket__route">
              <span>Origen</span><strong>La mujer que soy</strong>
              <i>✦</i>
              <span>Destino</span><strong>La mujer que elijo ser</strong>
            </div>
          </div>
          <div className="membership-ticket__barcode" aria-hidden="true" />
        </div>
        <div className="benefit-list">
          <p className="eyebrow">¿Te imaginás sentirte así?</p>
          {benefits.map((benefit, index) => (
            <div key={benefit}><span>0{index + 1}</span><p>{benefit}</p></div>
          ))}
        </div>
      </section>

      {featuredEbooks.length > 0 && (
        <section className="featured-ebooks section section--cream">
          <div className="section-heading">
            <p className="eyebrow">Tu proceso, a tu ritmo</p>
            <h2>Un ebook para el momento que estás viviendo</h2>
          </div>
          <div className="mini-ebook-grid">
            {featuredEbooks.map((ebook) => (
              <article key={ebook.id}>
                <div><Image src={ebook.coverImage} alt={`Portada de ${ebook.title}`} fill unoptimized sizes="(max-width: 760px) 60vw, 24vw" /></div>
                <h3>{ebook.title}</h3><p>{ebook.subtitle}</p>
              </article>
            ))}
          </div>
          <Link className="button button--outline" href="/ebooks">Explorar todos los ebooks</Link>
        </section>
      )}

      <section className="testimonials section">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Testimonios de mujeres como vos</p>
          <h2>Ellas también volvieron a elegirse</h2>
        </div>
        <div className="testimonial-track">
          {Array.from({ length: 8 }, (_, index) => (
            <figure key={index}>
              <Image src={`/images/testimonio-${String(index + 1).padStart(2, "0")}.jpg`} alt={`Testimonio ${index + 1} de una mujer acompañada por Maricel`} fill unoptimized sizes="(max-width: 760px) 74vw, 28vw" />
            </figure>
          ))}
        </div>
      </section>

      <section className="faq section section--sage">
        <div className="section-heading"><p className="eyebrow">Antes de empezar</p><h2>Preguntas frecuentes</h2></div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">Cuando quieras, empezamos</p>
        <h2>Estoy de este lado<br />para acompañarte.</h2>
        <a className="button button--cream" href={whatsapp} target="_blank" rel="noreferrer">Escribime por WhatsApp</a>
      </section>
      <SiteFooter instagramUrl={settings.instagram_url} whatsappUrl={settings.whatsapp_url} />
    </main>
  );
}
