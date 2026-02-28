// register.js — limpio + robusto
// Registro + ficha + persistencia de track/objetivo en user_metadata + checkout MercadoPago
(() => {
  "use strict";

  // =====================================================
  // Guard rails
  // =====================================================
  if (!window.sb) {
    alert("Supabase no está cargado. Revisá supabaseClient.js / orden de scripts.");
    return;
  }
  const sb = window.sb;

  const $ = (id) => document.getElementById(id);

  // =====================================================
  // DOM
  // =====================================================
  const form = $("registerForm");
  const regMsg = $("regMsg");

  const payBox = $("payBox");
  const payBtn = $("payBtn");
  const payHint = $("payHint");

  const planSelect = $("planSelect");
  const planLockHint = $("planLockHint");

  const fullName = $("fullName");
  const age = $("age");
  const email = $("email");
  const phone = $("phone");
  const objective = $("objective");
  const track = $("track");
  const level = $("level");
  const notes = $("notes");

  const password = $("password");
  const password2 = $("password2");

  // =====================================================
  // Config
  // =====================================================
  const MP_FALLBACK_URL = {
    basic: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=a744205529154c91bdfe7811443a9e41",
    mid: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=b003ccd51f3d49c59d3daf76315bb9d6",
    pro: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=4e5b56a866274858ad36638487349115",
  };

  // =====================================================
  // Helpers
  // =====================================================
  function setMsg(text, kind = "small") {
    if (!regMsg) return;
    regMsg.className = kind; // "small" | "notice" | "error"
    regMsg.textContent = text || "";
  }

  function normalizePlanSlug(s) {
    const v = String(s || "").toLowerCase().trim();
    if (["basic", "mid", "pro"].includes(v)) return v;
    if (v === "premium") return "pro";
    return "";
  }

  function normalizeTrack(v) {
    const raw = String(v || "").trim().toLowerCase();
    if (raw === "gym" || raw === "gimnasio") return "gym";
    if (raw === "home" || raw === "casa") return "home";
    return "gym";
  }

  function normalizeObjective(v) {
    const raw = String(v || "").trim().toLowerCase();
    return raw === "muscle_gain" ? "muscle_gain" : "fat_loss";
  }

  function planFromURL() {
    const u = new URL(window.location.href);
    return normalizePlanSlug(u.searchParams.get("plan"));
  }

  async function prefillPlan() {
    if (!planSelect) {
      setMsg("Falta #planSelect en register.html", "error");
      return;
    }

    const pURL = planFromURL();
    const pLS = normalizePlanSlug(localStorage.getItem("A360_SELECTED_PLAN"));
    const chosen = pURL || pLS || "";

    planSelect.value = chosen;

    if (pURL) {
      planSelect.disabled = true;
      if (planLockHint) planLockHint.style.display = "block";
    } else {
      planSelect.disabled = false;
      if (planLockHint) planLockHint.style.display = "none";
    }

    if (chosen) localStorage.setItem("A360_SELECTED_PLAN", chosen);
  }

  async function startCheckout(slug) {
    setMsg("");

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Abriendo pago…";
    }

    // 1) intentamos Edge Function
    try {
      const { data, error } = await sb.functions.invoke("mp-checkout", {
        body: { plan_slug: slug },
      });

      if (!error && data?.url) {
        window.location.href = data.url;
        return;
      }

      console.warn("[REGISTER] mp-checkout falló, usando fallback:", error?.message || data);
    } catch (e) {
      console.warn("[REGISTER] mp-checkout excepción, usando fallback:", e);
    }

    // 2) fallback directo a MP
    const url = MP_FALLBACK_URL[slug];
    if (!url) {
      setMsg("No hay URL de pago para este plan.", "error");
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Ir a pagar";
      }
      return;
    }

    window.location.href = url;
  }

  async function ensureSessionAfterSignup(emailVal, pass) {
    // signUp
    const signUpRes = await sb.auth.signUp({ email: emailVal, password: pass });
    if (signUpRes.error) throw new Error(signUpRes.error.message);

    // Necesitamos sesión para RPC/metadata. Si confirmación de email está ON, puede venir null.
    let session = signUpRes.data?.session;

    if (!session) {
      const signInRes = await sb.auth.signInWithPassword({ email: emailVal, password: pass });
      if (signInRes.error) {
        throw new Error(
          "Cuenta creada pero no hay sesión activa. Desactivá la confirmación de email en Supabase (Auth > Email) para este flujo."
        );
      }
      session = signInRes.data?.session;
    }

    if (!session) throw new Error("No pude iniciar sesión luego del registro.");
    return session;
  }

  async function persistUserMetadataFromEnrollment(payload, slug) {
    // Guardamos modalidad/objetivo en Auth user_metadata para que app.js lo lea siempre.
    try {
      const { error } = await sb.auth.updateUser({
        data: {
          track: payload.p_track, // "gym" | "home"
          objective: payload.p_objective, // "fat_loss" | "muscle_gain"
          requested_plan: slug, // opcional
        },
      });

      if (error) console.warn("[REGISTER] updateUser metadata error:", error.message);
    } catch (e) {
      console.warn("[REGISTER] updateUser metadata exception:", e);
    }
  }

  // =====================================================
  // Events
  // =====================================================
  payBtn?.addEventListener("click", async () => {
    const slug = normalizePlanSlug(planSelect?.value);
    if (!slug) return setMsg("Seleccioná un plan para continuar.", "error");
    await startCheckout(slug);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");
    if (payBox) payBox.style.display = "none";

    try {
      // ---- Plan
      const slug = normalizePlanSlug(planSelect?.value);
      if (!slug) return setMsg("Seleccioná un plan para continuar.", "error");

      // ---- Password
      const p1 = password?.value || "";
      const p2 = password2?.value || "";
      if (p1.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres.", "error");
      if (p1 !== p2) return setMsg("Las contraseñas no coinciden.", "error");

      // ---- Email
      const emailVal = (email?.value || "").trim();
      if (!emailVal) return setMsg("Ingresá un email válido.", "error");

      setMsg("Creando cuenta…", "small");

      // ---- Auth session
      await ensureSessionAfterSignup(emailVal, p1);

      setMsg("Guardando ficha…", "small");

      // ---- Enrollment payload (RPC)
      const payload = {
        p_full_name: (fullName?.value || "").trim(),
        p_age: Number(age?.value) || null,
        p_email: emailVal,
        p_phone: (phone?.value || "").trim(),
        p_requested_plan_slug: slug,
        p_objective: normalizeObjective(objective?.value || "fat_loss"),
        p_track: normalizeTrack(track?.value || "gym"),
        p_training_level: (level?.value || "beginner").trim(),
        p_notes: (notes?.value || "").trim() || null,
      };

      const rpcRes = await sb.rpc("submit_enrollment_form_v1", payload);
      if (rpcRes.error) return setMsg(rpcRes.error.message, "error");

      // ---- Persist metadata (para app.js)
      await persistUserMetadataFromEnrollment(payload, slug);

      // ---- LocalStorage (solo lo necesario)
      localStorage.setItem("A360_SELECTED_PLAN", slug);
      localStorage.setItem("A360_OBJECTIVE", payload.p_objective);
      // NO guardamos A360_TRACK: la modalidad queda fijada por ficha (user_metadata.track)

      setMsg("Se completó tu registro ✅", "notice");

      if (payHint) {
        payHint.className = "notice small";
        payHint.textContent = "Debés realizar el pago para completar la suscripción.";
      }

      if (payBox) payBox.style.display = "block";
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Ir a pagar";
      }
    } catch (err) {
      console.error("[REGISTER] submit error:", err);
      setMsg(err?.message || String(err), "error");

      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Ir a pagar";
      }
    }
  });

  // =====================================================
  // Init
  // =====================================================
  (async function init() {
    await prefillPlan();
  })();
})();