(() => {
  "use strict";
  if (!window.sb) {
    alert("Supabase no está cargado.");
    return;
  }
  const sb = window.sb;
  const $ = (id) => document.getElementById(id);

  const form = $("obForm");
  const msg = $("obMsg");
  const saveBtn = $("obSaveBtn");

  const age = $("obAge");
  const weight = $("obWeight");
  const height = $("obHeight");
  const objective = $("obObjective");
  const track = $("obTrack");
  const level = $("obLevel");
  const notes = $("obNotes");

  const payBox = $("obPayBox");
  const payBtn = $("obPayBtn");


  function setMsg(text, kind = "small") {
    if (!msg) return;
    msg.className = kind;
    msg.textContent = text || "";
  }

  function norm(v) { return String(v ?? "").trim().toLowerCase(); }

  async function requireSession() {
    const requireAuth = window.A360Auth?.requireAuthOrRedirect;
    if (typeof requireAuth === "function") {
      const session = await requireAuth();
      return session;
    }
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      window.location.href = "./login.html";
      return null;
    }
    return data.session;
  }

  async function getPlanRow(uid) {
    const { data, error } = await sb
      .from("user_plan")
      .select("status, current_plan_slug, pending_plan_slug, plans:plan_id (slug,name)")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) return null;
    return data || null;
  }

  async function startCheckout(planSlug) {
    const slug = norm(planSlug);
    if (!slug) throw new Error("No hay un plan válido para continuar.");

    const { data: refreshRes, error: refreshErr } = await sb.auth.refreshSession();
    if (refreshErr) throw new Error(refreshErr.message || "No pude refrescar tu sesión.");

    const session = refreshRes?.session;
    if (!session?.access_token) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");

    const { data, error } = await sb.functions.invoke("mp-checkout", {
      body: { plan_slug: slug },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) throw new Error(error.message || "No pude iniciar el checkout.");
    if (!data?.url) throw new Error(data?.error || "Mercado Pago no devolvió una URL válida.");

    window.location.href = data.url;
  }

  async function prefill(uid) {
    // profiles
    const { data: p } = await sb
      .from("profiles")
      .select("age, weight_kg, height_cm, training_level")
      .eq("user_id", uid)
      .maybeSingle();

    if (p) {
      if (age && p.age != null) age.value = String(p.age);
      if (weight && p.weight_kg != null) weight.value = String(p.weight_kg);
      if (height && p.height_cm != null) height.value = String(p.height_cm);
      if (level && p.training_level) level.value = p.training_level;
    }

    // user_preferences
    const { data: pref } = await sb
      .from("user_preferences")
      .select("objective, track, training_level, notes")
      .eq("user_id", uid)
      .maybeSingle();

    if (pref) {
      if (objective && pref.objective) objective.value = pref.objective;
      if (track && pref.track) track.value = pref.track;
      if (level && pref.training_level) level.value = pref.training_level;
      if (notes && pref.notes) notes.value = pref.notes;
    }
  }

  payBtn?.addEventListener("click", async () => {
    const session = await requireSession();
    if (!session) return;

    const planRow = await getPlanRow(session.user.id);
    const slug = norm(planRow?.plans?.slug) || norm(planRow?.current_plan_slug) || norm(planRow?.pending_plan_slug) || "pro";

    try {
      await startCheckout(slug);
    } catch (e) {
      alert(e?.message || String(e));
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      const session = await requireSession();
      if (!session) return;

      const uid = session.user.id;

      // Guardado en profiles (lo que el panel ya usa)
      setMsg("Guardando…", "small");
      if (saveBtn) saveBtn.disabled = true;

      const emailVal = (session.user?.email || "").trim();
if (!emailVal) throw new Error("No pude leer el email de tu sesión.");

const payloadProfiles = {
  user_id: uid,
  email: emailVal,                 // ✅ CLAVE: profiles.email es NOT NULL
  age: age?.value ? Number(age.value) : null,
  weight_kg: weight?.value ? Number(weight.value) : null,
  height_cm: height?.value ? Number(height.value) : null,
  training_level: level?.value || null,
  updated_at: new Date().toISOString(),
};

      const { error: pErr } = await sb.from("profiles").upsert(payloadProfiles, { onConflict: "user_id" });
      if (pErr) throw new Error(pErr.message);

      // Guardado en user_preferences (objective/track + notes)
      const payloadPrefs = {
        user_id: uid,
        objective: objective?.value || "fat_loss",
        track: track?.value || "gym",
        training_level: level?.value || null,
        notes: (notes?.value || "").trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: prefErr } = await sb.from("user_preferences").upsert(payloadPrefs, { onConflict: "user_id" });
      if (prefErr) throw new Error(prefErr.message);

      // metadata fallback
      try {
        await sb.auth.updateUser({ data: { objective: payloadPrefs.objective, track: payloadPrefs.track, training_level: payloadPrefs.training_level }});
      } catch (_) {}

      setMsg("Listo ✅ Ya podemos personalizar tu rutina.", "notice");

      setTimeout(() => {
        window.location.href = "./app.html";
      }, 700);
    } catch (err) {
      console.error("[ONBOARDING] save error:", err);
      setMsg(err?.message || String(err), "error");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  (async function init() {
    const session = await requireSession();
    if (!session) return;

    await prefill(session.user.id);

    // Si plan no está activo, mostramos el botón de pagar (sin bloquear el formulario)
    const planRow = await getPlanRow(session.user.id);
    const status = norm(planRow?.status);
    if (status !== "active" && payBox) payBox.style.display = "block";
  })();
})();