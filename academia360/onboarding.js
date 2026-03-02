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

  const MP_FALLBACK_URL = {
    basic: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=a744205529154c91bdfe7811443a9e41",
    mid:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=b003ccd51f3d49c59d3daf76315bb9d6",
    pro:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=4e5b56a866274858ad36638487349115",
  };

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
    // Edge function
    try {
      const { data, error } = await sb.functions.invoke("mp-checkout", {
        body: { plan_slug: planSlug },
      });
      if (!error && data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (_) {}

    // Fallback
    const url = MP_FALLBACK_URL[planSlug];
    if (!url) throw new Error("No hay URL de pago para este plan.");
    window.location.href = url;
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