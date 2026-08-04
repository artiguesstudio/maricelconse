"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentBundle, EbookRecord, ResourceRecord, SettingKey } from "../../db/content";
import type { AdminSubscriptionRecord } from "../../db/subscriptions";
import type { AdminLeadRecord } from "../../db/leads";

type Tab = "inicio" | "membresia" | "suscripciones" | "leads" | "ebooks" | "recursos";

const tabContent: Record<Tab, { title: string; description: string }> = {
  inicio: { title: "Inicio y contacto", description: "Edita el contenido con lenguaje simple. Guarda cuando esté listo." },
  membresia: { title: "Membresía", description: "Edita el contenido con lenguaje simple. Guarda cuando esté listo." },
  suscripciones: { title: "Suscripciones", description: "Consulta quién tiene acceso, cuándo renueva y qué alumnas solicitaron la baja." },
  leads: { title: "Leads", description: "Consulta todas las suscriptoras y sus datos de contacto, incluso si todavía no completaron el perfil." },
  ebooks: { title: "Ebooks", description: "Edita los e-books y sus archivos descargables." },
  recursos: { title: "Recursos de socias", description: "Publica clases, actividades, audios y guías dentro del área privada." },
};

const settingFields: { key: SettingKey; label: string; multiline?: boolean; group: Tab; hint?: string }[] = [
  { key: "hero_eyebrow", label: "Texto pequeño sobre el título", group: "inicio" },
  { key: "hero_title", label: "Título principal", group: "inicio" },
  { key: "hero_subtitle", label: "Texto de presentación", multiline: true, group: "inicio" },
  { key: "story_title", label: "Título de Mi historia", group: "inicio" },
  { key: "story_body", label: "Historia", multiline: true, group: "inicio" },
  { key: "whatsapp_url", label: "Enlace general de WhatsApp", group: "inicio", hint: "Usa el formato https://wa.me/…" },
  { key: "instagram_url", label: "Enlace de Instagram", group: "inicio" },
  { key: "membership_title", label: "Nombre de la membresía", group: "membresia" },
  { key: "membership_body", label: "Descripción", multiline: true, group: "membresia" },
  { key: "membership_price_regular", label: "Precio anterior", group: "membresia" },
  { key: "membership_price_sale", label: "Precio actual", group: "membresia" },
  { key: "membership_purchase_url", label: "Enlace alternativo para sumarse", group: "membresia", hint: "Solo se usa mientras Mercado Pago no esté activado." },
  { key: "current_theme", label: "Tema del mes", group: "membresia" },
  { key: "current_theme_description", label: "Descripción del tema", multiline: true, group: "membresia" },
  { key: "next_session_label", label: "Día y hora del próximo encuentro", group: "membresia" },
  { key: "next_session_url", label: "Enlace del próximo encuentro", group: "membresia" },
];

const resourceNames: Record<ResourceRecord["kind"], string> = { class: "Clase", activity: "Actividad", audio: "Audio", guide: "Guía", resource: "Recurso" };

function formatDate(value: string) {
  if (!value) return "Pendiente";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(value));
}

function subscriptionLabel(subscription: AdminSubscriptionRecord) {
  if (subscription.cancelAtPeriodEnd || subscription.status === "canceled") return "Baja solicitada";
  if (subscription.accessUntil && new Date(subscription.accessUntil) > new Date()) return "Activa";
  if (subscription.status === "pending") return "Pendiente";
  return "Sin acceso";
}

export function AdminPanel({ initialContent, initialSubscriptions, initialLeads }: { initialContent: ContentBundle; initialSubscriptions: AdminSubscriptionRecord[]; initialLeads: AdminLeadRecord[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inicio");
  const [content, setContent] = useState(initialContent);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(payload: unknown) {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as ContentBundle & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
      setContent(body); setNotice("Cambios guardados. La web ya está actualizada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally { setSaving(false); }
  }

  function updateSetting(key: SettingKey, value: string) {
    setContent((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }

  function updateEbook(index: number, patch: Partial<EbookRecord>) {
    setContent((current) => ({ ...current, ebooks: current.ebooks.map((ebook, position) => position === index ? { ...ebook, ...patch } : ebook) }));
  }

  function updateResource(index: number, patch: Partial<ResourceRecord>) {
    setContent((current) => ({ ...current, resources: current.resources.map((resource, position) => position === index ? { ...resource, ...patch } : resource) }));
  }

  async function uploadEbook(ebook: EbookRecord, file: File | undefined) {
    if (!file) return;
    if (!ebook.id) { setNotice("Primero guarda el ebook y después subi el PDF."); return; }
    setSaving(true); setNotice("");
    try {
      const form = new FormData();
      form.set("ebookId", String(ebook.id));
      form.set("file", file);
      const response = await fetch("/api/admin/ebooks/upload", { method: "POST", body: form });
      const body = await response.json() as ContentBundle & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo subir el PDF.");
      setContent(body); setNotice("Cambios guardados. El PDF ya está disponible para las suscriptoras.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo subir el PDF.");
    } finally { setSaving(false); }
  }

  function addEbook() {
    setContent((current) => ({ ...current, ebooks: [...current.ebooks, { id: 0, slug: "", title: "Nuevo ebook", subtitle: "", description: "", regularPrice: "", salePrice: "", purchaseUrl: "", memberUrl: "", memberFilePath: "", coverImage: "/images/ebooks-tablet.jpg", sortOrder: current.ebooks.length + 1, isPublished: false }] }));
  }

  function addResource() {
    setContent((current) => ({ ...current, resources: [...current.resources, { id: 0, kind: "resource", monthLabel: "", title: "Nuevo recurso", description: "", url: "", sortOrder: current.resources.length + 1, isPublished: false }] }));
  }

  const visibleFields = settingFields.filter((field) => field.group === tab);
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <p>Administración</p>
        <button className={tab === "inicio" ? "active" : ""} onClick={() => setTab("inicio")}><span>⌂</span> Inicio y contacto</button>
        <button className={tab === "membresia" ? "active" : ""} onClick={() => setTab("membresia")}><span>✦</span> Membresía</button>
        <button className={tab === "suscripciones" ? "active" : ""} onClick={() => setTab("suscripciones")}><span>◎</span> Suscripciones</button>
        <button className={tab === "leads" ? "active" : ""} onClick={() => setTab("leads")}><span>✎</span> Leads</button>
        <button className={tab === "ebooks" ? "active" : ""} onClick={() => setTab("ebooks")}><span>▤</span> Ebooks</button>
        <button className={tab === "recursos" ? "active" : ""} onClick={() => setTab("recursos")}><span>◇</span> Recursos</button>
        <div className="admin-future"><strong>Mercado Pago</strong><p>Las altas, renovaciones y bajas aparecerán en Suscripciones.</p><span>Sincronización automática</span></div>
      </aside>
      <section className="admin-content">
        <div className="admin-heading"><div><p className="eyebrow">Backoffice</p><h1>{tabContent[tab].title}</h1><p>{tabContent[tab].description}</p></div>{(tab === "inicio" || tab === "membresia") && <button className="button button--dark" disabled={saving} onClick={() => persist({ type: "settings", values: content.settings })}>{saving ? "Guardando…" : "Guardar cambios"}</button>}{(tab === "suscripciones" || tab === "leads") && <button className="button button--outline" onClick={() => router.refresh()}>Actualizar datos</button>}{tab === "ebooks" && <button className="button button--outline" onClick={addEbook}>+ Agregar ebook</button>}{tab === "recursos" && <button className="button button--outline" onClick={addResource}>+ Agregar recurso</button>}</div>
        {notice && <div className={`admin-notice ${notice.startsWith("Cambios") ? "success" : "error"}`} role="status">{notice}</div>}
        {(tab === "inicio" || tab === "membresia") && <div className="admin-form-card">{visibleFields.map((field) => <label key={field.key}><span>{field.label}</span>{field.multiline ? <textarea rows={4} value={content.settings[field.key]} onChange={(event) => updateSetting(field.key, event.target.value)} /> : <input value={content.settings[field.key]} onChange={(event) => updateSetting(field.key, event.target.value)} />}{field.hint && <small>{field.hint}</small>}</label>)}</div>}
        {tab === "suscripciones" && <div className="admin-subscriptions">{initialSubscriptions.length === 0 ? <div className="admin-empty"><h2>Todavía no hay suscripciones</h2><p>Las alumnas aparecerán aquí después de iniciar su pago en Mercado Pago.</p></div> : initialSubscriptions.map((subscription) => <article className="admin-subscription-row" key={subscription.id}><div><span className={`admin-status admin-status--${subscriptionLabel(subscription).toLowerCase().replaceAll(" ", "-")}`}>{subscriptionLabel(subscription)}</span><h2>{subscription.displayName || subscription.payerEmail || "Alumna sin identificar"}</h2><p>{subscription.payerEmail && <a href={`mailto:${subscription.payerEmail}`}>{subscription.payerEmail}</a>}{subscription.phone ? <> · <a href={`tel:${subscription.phone}`}>{subscription.phone}</a></> : " · Celular pendiente"}</p></div><dl><div><dt>Pago</dt><dd>{subscription.paymentStatus}</dd></div><div><dt>Acceso hasta</dt><dd>{formatDate(subscription.accessUntil)}</dd></div><div><dt>Próximo cobro</dt><dd>{subscription.cancelAtPeriodEnd ? "Cancelado" : formatDate(subscription.nextPaymentDate)}</dd></div></dl></article>)}</div>}
        {tab === "leads" && <div className="admin-leads">{initialLeads.length === 0 ? <div className="admin-empty"><h2>Todavía no hay suscriptoras</h2><p>Las alumnas aparecerán aquí cuando se confirme su pago.</p></div> : initialLeads.map((lead) => <article className="admin-lead-card" key={lead.id}><header><div><span>{lead.profileCompletedAt ? `Perfil completado · ${formatDate(lead.profileCompletedAt)}` : `Suscripción confirmada · ${formatDate(lead.subscriptionCreatedAt)}`}</span><h2>{lead.displayName || lead.email}</h2><p><a href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone ? <> · <a href={`tel:${lead.phone}`}>{lead.phone}</a></> : " · Celular pendiente"}</p></div><small>{[lead.city, lead.province, lead.country].filter(Boolean).join(", ") || (lead.profileCompletedAt ? "" : "Perfil pendiente")}</small></header><div className="admin-lead-answers"><div><h3>¿Cómo llegas a este viaje?</h3><p>{lead.journeyArrival || "Todavía no respondió."}</p></div><div><h3>¿Qué te gustaría lograr con esta membresía?</h3><p>{lead.membershipGoal || "Todavía no respondió."}</p></div></div></article>)}</div>}
        {tab === "ebooks" && <div className="admin-card-list">{content.ebooks.map((ebook, index) => <article className="admin-item-card" key={`${ebook.id}-${index}`}><div className="admin-item-card__top"><div><span>Ebook {String(index + 1).padStart(2, "0")}</span><h2>{ebook.title}</h2></div><label className="publish-toggle"><input type="checkbox" checked={ebook.isPublished} onChange={(event) => updateEbook(index, { isPublished: event.target.checked })} /><span>Publicado</span></label></div><div className="admin-grid-form"><label><span>Título</span><input value={ebook.title} onChange={(event) => updateEbook(index, { title: event.target.value })} /></label><label><span>Subtítulo</span><input value={ebook.subtitle} onChange={(event) => updateEbook(index, { subtitle: event.target.value })} /></label><label className="wide"><span>Descripción</span><textarea rows={3} value={ebook.description} onChange={(event) => updateEbook(index, { description: event.target.value })} /></label><label><span>Precio anterior</span><input value={ebook.regularPrice} onChange={(event) => updateEbook(index, { regularPrice: event.target.value })} /></label><label><span>Precio actual</span><input value={ebook.salePrice} onChange={(event) => updateEbook(index, { salePrice: event.target.value })} /></label><label className="wide"><span>Enlace de compra</span><input value={ebook.purchaseUrl} onChange={(event) => updateEbook(index, { purchaseUrl: event.target.value })} placeholder="https://…" /></label><label className="wide"><span>Enlace gratuito para suscriptoras (opcional)</span><input value={ebook.memberUrl} onChange={(event) => updateEbook(index, { memberUrl: event.target.value })} placeholder="https://…" /><small>Usalo solo si el ebook ya está alojado en otro servicio.</small></label><label className="wide"><span>PDF gratuito para suscriptoras</span><input type="file" accept="application/pdf,.pdf" disabled={saving || !ebook.id} onChange={(event) => void uploadEbook(ebook, event.target.files?.[0])} /><small>{ebook.memberFilePath ? "PDF cargado y protegido. Elegi otro archivo para reemplazarlo." : ebook.id ? "Máximo 50 MB. Solo las suscriptoras activas podrán abrirlo." : "Guarda primero este ebook para habilitar la carga."}</small></label><label className="wide"><span>Imagen de portada</span><input value={ebook.coverImage} onChange={(event) => updateEbook(index, { coverImage: event.target.value })} /></label></div><button className="button button--dark button--small" disabled={saving} onClick={() => persist({ type: "ebook", value: ebook })}>Guardar ebook</button></article>)}</div>}
        {tab === "recursos" && <div className="admin-card-list">{content.resources.map((resource, index) => <article className="admin-item-card" key={`${resource.id}-${index}`}><div className="admin-item-card__top"><div><span>{resourceNames[resource.kind]}</span><h2>{resource.title}</h2></div><label className="publish-toggle"><input type="checkbox" checked={resource.isPublished} onChange={(event) => updateResource(index, { isPublished: event.target.checked })} /><span>Visible para socias</span></label></div><div className="admin-grid-form"><label><span>Tipo</span><select value={resource.kind} onChange={(event) => updateResource(index, { kind: event.target.value as ResourceRecord["kind"] })}>{Object.entries(resourceNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Mes o sección</span><input value={resource.monthLabel} onChange={(event) => updateResource(index, { monthLabel: event.target.value })} /></label><label className="wide"><span>Título</span><input value={resource.title} onChange={(event) => updateResource(index, { title: event.target.value })} /></label><label className="wide"><span>Descripción</span><textarea rows={3} value={resource.description} onChange={(event) => updateResource(index, { description: event.target.value })} /></label><label className="wide"><span>Enlace al contenido</span><input value={resource.url} onChange={(event) => updateResource(index, { url: event.target.value })} placeholder="https://… o /guia-de-viaje" /></label></div><button className="button button--dark button--small" disabled={saving} onClick={() => persist({ type: "resource", value: resource })}>Guardar recurso</button></article>)}</div>}
      </section>
    </div>
  );
}
