import type { EbookRecord, ResourceRecord, SiteSettings } from "../../db/content";
import { applyReplacements, escapeHtml, type LegacySource } from "./LegacyDocument";

function emphasizeLastWord(value: string) {
  const clean = value.trim();
  const match = clean.match(/^(.*?)([^\s]+)([.!?…]*)$/u);
  if (!match || !match[1].trim()) return escapeHtml(clean);
  return `${escapeHtml(match[1])}<em>${escapeHtml(match[2])}</em>${escapeHtml(match[3])}`;
}

function withContactLinks(body: string, settings: SiteSettings) {
  return applyReplacements(body, [
    ["https://instagram.com/maricelconse", escapeHtml(settings.instagram_url)],
    ["https://wa.me/5492964406552", escapeHtml(settings.whatsapp_url)],
  ]);
}

function withPrivateAccess(body: string) {
  if (body.includes("legacy-space-link")) return body;
  const accessLink = '<a href="/mi-espacio" class="nav-cta legacy-space-link"><span class="legacy-space-link__desktop">Ingresar a mi espacio</span><span class="legacy-space-link__mobile">Mi espacio</span></a>';
  if (body.includes('<div class="nav-links">')) {
    return body.replace(
      /(<div class="nav-links">[\s\S]*?)(<\/div>\s*<\/nav>)/,
      (_, links: string, closing: string) => `${links}${accessLink}${closing}`,
    );
  }
  return `<nav class="legacy-access-nav"><a href="/" class="logo">MARICEL <em>Conse</em></a><div class="nav-links">${accessLink}</div></nav>${body}`;
}

function withPublicHeader(body: string, settings: SiteSettings) {
  return withPrivateAccess(withContactLinks(body, settings));
}

export function renderHome(source: LegacySource, settings: SiteSettings) {
  let body = withContactLinks(source.body, settings);
  body = body.replace(/\s*<a href="#empezar" class="nav-cta">Empeza hoy<\/a>/i, "");
  body = withPrivateAccess(body);
  body = body.replaceAll('loading="lazy"', 'loading="eager"');
  body = body.replace(/<div class="welcome">[\s\S]*?<\/div>/, () => `<div class="welcome">${escapeHtml(settings.hero_eyebrow)}</div>`);
  if (settings.hero_title.trim().toLowerCase() !== "sali a comerte el mundo") {
    body = body.replace(/<h1>[\s\S]*?<\/h1>/, () => `<h1>${escapeHtml(settings.hero_title)}</h1>`);
  }
  const subtitleParts = settings.hero_subtitle.split(/(?<=\.)\s+/, 2);
  const subtitleHtml = subtitleParts.length > 1
    ? `<b>${escapeHtml(subtitleParts[0])}</b><br><em>${escapeHtml(subtitleParts[1])}</em>`
    : `<em>${escapeHtml(settings.hero_subtitle)}</em>`;
  body = body.replace(/<p class="hero-frase">[\s\S]*?<\/p>/, () => `<p class="hero-frase">${subtitleHtml}</p>`);
  body = body.replace(/<h2>Toqué fondo y elegí[\s\S]*?<\/h2>/, () => `<h2>${emphasizeLastWord(settings.story_title)}</h2>`);
  body = body.replace(
    /<p>Hubo una etapa[\s\S]*?<\/p>\s*<p>Me reconstruí[\s\S]*?<\/p>/,
    () => settings.story_body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join(""),
  );
  body = body.replace(/<h2 class="memb-title">[\s\S]*?<\/h2>/, () => `<h2 class="memb-title">${escapeHtml(settings.membership_title)}</h2>`);
  body = body.replace(/(<div class="memb-desc">\s*)<p>[\s\S]*?<\/p>/, (_, prefix: string) => `${prefix}<p>${escapeHtml(settings.membership_body)}</p>`);
  return body;
}

export function renderMembership(source: LegacySource, settings: SiteSettings) {
  const checkout = process.env.MERCADOPAGO_PLAN_ID
    ? "/membresia/suscribirme"
    : settings.membership_purchase_url || `${settings.whatsapp_url}?text=${encodeURIComponent("Hola Maricel, quiero sumarme a Bienvenidas a bordo")}`;
  let body = applyReplacements(withPublicHeader(source.body, settings), [
    ["REEMPLAZAR-LINK-MERCADOPAGO", escapeHtml(checkout)],
    ["$70.000", escapeHtml(settings.membership_price_regular)],
    ["$51.999", escapeHtml(settings.membership_price_sale)],
  ]);
  if (checkout.startsWith("/")) {
    body = body.replaceAll(`href="${escapeHtml(checkout)}" target="_blank" rel="noopener"`, `href="${escapeHtml(checkout)}"`);
  }
  return body;
}

export function renderSessions(source: LegacySource, settings: SiteSettings) {
  return withPublicHeader(source.body, settings);
}

export function renderMiniGuide(source: LegacySource, settings: SiteSettings) {
  return withPublicHeader(source.body, settings);
}

export function renderEbooks(source: LegacySource, settings: SiteSettings, ebooks: EbookRecord[]) {
  const visible = ebooks.filter((ebook) => ebook.isPublished);
  const cards = visible.map((ebook, index) => {
    const href = ebook.purchaseUrl || `${settings.whatsapp_url}?text=${encodeURIComponent(`Hola Maricel, quiero el ebook «${ebook.title}»`)}`;
    return `
        <article class="eb-card">
          <div class="eb-cover"><img src="${escapeHtml(ebook.coverImage || "/images/ebooks-tablet.jpg")}" alt="Portada del ebook ${escapeHtml(ebook.title)}" loading="lazy"></div>
          <div class="eb-body">
            <span class="eb-ed">Edición ${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(ebook.title)}</h3>
            <p class="eb-sub">${escapeHtml(ebook.subtitle)}</p>
            <p class="eb-for"><strong>Es para vos si…</strong> ${escapeHtml(ebook.description)}</p>
            <p class="eb-price"><span class="eb-old">${escapeHtml(ebook.regularPrice)}</span><span class="eb-new">${escapeHtml(ebook.salePrice)}</span></p>
            <a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="btn btn-fire eb-btn">Comprar <span class="arw">→</span></a>
          </div>
        </article>`;
  }).join("");

  let body = withPublicHeader(source.body, settings);
  body = body.replace(
    /(<div class="carousel-track">)[\s\S]*?(<\/div>\s*<div class="carousel-ctrl">)/,
    (_, opening: string, closing: string) => `${opening}${cards}\n      ${closing}`,
  );
  return body;
}

function renderResourceMonths(resources: ResourceRecord[]) {
  const grouped = new Map<string, ResourceRecord[]>();
  resources.filter((resource) => resource.isPublished).forEach((resource) => {
    const label = resource.monthLabel || "Contenido disponible";
    grouped.set(label, [...(grouped.get(label) || []), resource]);
  });
  if (!grouped.size) return "";

  const months = [...grouped.entries()].map(([month, items]) => {
    const links = items.map((item) => {
      const text = `${escapeHtml(item.title)}${item.description ? ` — ${escapeHtml(item.description)}` : ""}`;
      if (!item.url) return `<li><span>${text}</span></li>`;
      const target = item.url.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
      return `<li><a href="${escapeHtml(item.url)}"${target}>${text}</a></li>`;
    }).join("");
    return `<details class="mes legacy-managed-month" open><summary><b>${escapeHtml(month)}</b><span class="cant">${items.length} ${items.length === 1 ? "recurso" : "recursos"}</span><span class="signo">+</span></summary><div class="mes-cuerpo"><div><ul>${links}</ul></div></div></details>`;
  }).join("");
  return `<div class="meses legacy-managed-resources">${months}</div>`;
}

function insertResources(body: string, heading: string, resources: ResourceRecord[]) {
  const html = renderResourceMonths(resources);
  if (!html) return body;
  const headingIndex = body.indexOf(`<span class="c-txt"><b>${heading}</b>`);
  if (headingIndex < 0) return body;
  const marker = '<div class="c-inner">';
  const innerIndex = body.indexOf(marker, headingIndex);
  if (innerIndex < 0) return body;
  const insertion = innerIndex + marker.length;
  return `${body.slice(0, insertion)}${html}${body.slice(insertion)}`;
}

function renderMemberProfilePrompt(profileCompleted: boolean) {
  if (profileCompleted) return "";
  return `<section class="member-profile-tools"><div class="member-managed-tools__inner"><aside class="member-profile-prompt"><div><span>Antes de continuar</span><h2>Completa tu perfil de pasajera.</h2><p>Contanos tus datos para poder acompañarte mejor.</p></div><a href="/mi-espacio/perfil">Completar perfil →</a></aside></div></section>`;
}

function renderMemberLibrary(ebooks: EbookRecord[]) {
  const cards = ebooks.filter((ebook) => ebook.isPublished).map((ebook) => {
    const available = Boolean(ebook.memberFilePath || ebook.memberUrl);
    return `<article class="member-ebook-card"><img src="${escapeHtml(ebook.coverImage || "/images/ebooks-tablet.jpg")}" alt="Portada de ${escapeHtml(ebook.title)}"><div><span>Incluido en tu membresía</span><h3>${escapeHtml(ebook.title)}</h3><p>${escapeHtml(ebook.subtitle)}</p>${available ? `<a href="/api/member/ebooks/${ebook.id}" target="_blank" rel="noopener">Descargar ebook ↓</a>` : `<small>Disponible próximamente</small>`}</div></article>`;
  }).join("");
  return `<details class="carpeta ancha member-ebook-library">
        <span class="c-tag">Incluidos</span>
        <summary>
          <span class="c-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11a1.6 1.6 0 0 1 1.6 1.6v13.8a1.6 1.6 0 0 1-1.6 1.6h-11A1.6 1.6 0 0 1 5 18.9V5.1a1.6 1.6 0 0 1 1.5-1.6z"/><path d="M8.6 3.5v17"/><path d="M11.6 8.4h4.4M11.6 11.8h4.4"/></svg></span>
          <span class="c-txt"><b>E-books</b><span>Tu biblioteca completa, incluida sin costo extra en la membresía.</span></span>
          <span class="c-cta">Ver e-books <span class="signo">+</span></span>
        </summary>
        <div class="c-cuerpo"><div><div class="c-inner">
          <p class="member-library-intro">Puedes descargar todos los e-books publicados mientras tu membresía esté activa.</p>
          <div class="member-ebook-grid">${cards || "<p>Muy pronto vas a encontrar tus e-books acá.</p>"}</div>
        </div></div></div>
      </details>`;
}

export function renderMember(source: LegacySource, settings: SiteSettings, resources: ResourceRecord[], ebooks: EbookRecord[], profileCompleted: boolean) {
  let body = withContactLinks(source.body, settings);
  body = body.replace(
    /(<div class="nav-links">[\s\S]*?)(<\/div>\s*<\/nav>)/,
    (_, links: string, closing: string) => `${links}<a href="/mi-espacio/membresia">Mi membresía</a><form action="/auth/signout" method="post"><button class="legacy-nav-button" type="submit">Salir</button></form>${closing}`,
  );
  body = body.replace("</nav>", `</nav>${renderMemberProfilePrompt(profileCompleted)}`);
  body = body.replace(/<h2>Reconstruir mi[\s\S]*?<\/h2>/, () => `<h2>${emphasizeLastWord(settings.current_theme)}</h2>`);
  body = body.replace(
    /<p>Un mes para reconocer lo que vales[\s\S]*?<\/p>/,
    () => `<p>${escapeHtml(settings.current_theme_description)}</p>`,
  );
  body = body.replace(/<span>Sábado · 19:00 h<\/span>/, () => `<span>${escapeHtml(settings.next_session_label)}</span>`);
  if (settings.next_session_url) {
    body = body.replace('href="#" target="_blank" rel="noopener">Entrar al encuentro', `href="${escapeHtml(settings.next_session_url)}" target="_blank" rel="noopener">Entrar al encuentro`);
  } else {
    body = body.replace('href="#" target="_blank" rel="noopener">Entrar al encuentro', 'href="#" aria-disabled="true">Acceso próximamente');
  }
  body = insertResources(body, "Clases grabadas", resources.filter((resource) => resource.kind === "class"));
  body = insertResources(body, "Actividades", resources.filter((resource) => resource.kind === "activity"));
  body = insertResources(body, "Audios de reprogramación", resources.filter((resource) => resource.kind === "audio"));
  body = insertResources(body, "Recursos", resources.filter((resource) => resource.kind === "guide" || resource.kind === "resource"));
  const library = renderMemberLibrary(ebooks);
  const helpMarker = '    </div>\n\n    <section class="ayuda">';
  body = body.includes(helpMarker)
    ? body.replace(helpMarker, `      ${library}\n    </div>\n\n    <section class="ayuda">`)
    : body.replace('<section class="ayuda">', `${library}<section class="ayuda">`);
  return body;
}
