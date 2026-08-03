"use client";

import { useState } from "react";
import Link from "next/link";
import type { MemberProfile } from "../../../db/profile";

export function ProfileForm({ profile }: { profile: MemberProfile }) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  function set(key: keyof MemberProfile, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar el perfil.");
      setNotice("Perfil completo. Tus datos quedaron guardados.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={save}>
      <div className="profile-form__grid">
        <label><span>Nombre y apellido</span><input required value={form.displayName} onChange={(event) => set("displayName", event.target.value)} /></label>
        <label><span>Email</span><input value={form.email} disabled /></label>
        <label><span>Teléfono</span><input required type="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
        <label><span>Fecha de nacimiento</span><input required type="date" value={form.birthDate} onChange={(event) => set("birthDate", event.target.value)} /></label>
        <label><span>Tipo de documento</span><select required value={form.documentType} onChange={(event) => set("documentType", event.target.value)}><option value="">Elegi una opción</option><option>DNI</option><option>Pasaporte</option><option>Otro</option></select></label>
        <label><span>Número de documento</span><input required value={form.documentNumber} onChange={(event) => set("documentNumber", event.target.value)} /></label>
        <label><span>País</span><input required value={form.country} onChange={(event) => set("country", event.target.value)} /></label>
        <label><span>Provincia / Estado</span><input required value={form.province} onChange={(event) => set("province", event.target.value)} /></label>
        <label><span>Ciudad</span><input required value={form.city} onChange={(event) => set("city", event.target.value)} /></label>
        <label><span>Domicilio</span><input required value={form.address} onChange={(event) => set("address", event.target.value)} /></label>
      </div>
      {notice && <p className={notice.startsWith("Perfil completo") ? "subscription-success" : "subscription-error"} role="status">{notice}</p>}
      <div className="subscription-actions">
        <button className="button button--dark" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar perfil"}</button>
        <Link className="text-link" href="/mi-espacio">Volver a mi espacio</Link>
      </div>
    </form>
  );
}
