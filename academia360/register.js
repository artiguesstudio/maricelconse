// register.js — Paso 1 (compra) mínimo + checkout inmediato
(() => {
  "use strict";

  if (!window.sb) {
    alert("Supabase no está cargado. Revisá supabaseClient.js / orden de scripts.");
    return;
  }
  const sb = window.sb;
  const $ = (id) => document.getElementById(id);

  // DOM
  const form = $("registerForm");
  const regMsg = $("regMsg");

  const payBox = $("payBox");
  const payBtn = $("payBtn");
  const payHint = $("payHint");

  const planSelect = $("planSelect");
  const planLockHint = $("planLockHint");

  const fullName = $("fullName");
  const email = $("email");
  const phone = $("phone");
  const password = $("password");
  const password2 = $("password2");

  // Fallback MP (por si la Edge Function falla)
  const MP_FALLBACK_URL = {
    basic: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=a744205529154c91bdfe7811443a9e41",
    mid:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=b003ccd51f3d49c59d3daf76315bb9d6",
    pro:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=4e5b56a866274858ad36638487349115",
  };

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

  function planFromURL() {
    const u = new URL(window.location.href);
    return normalizePlanSlug(u.searchParams.get("plan"));
  }

  async function prefillPlan() {
    const pURL = planFromURL();
    const pLS = normalizePlanSlug(localStorage.getItem("A360_SELECTED_PLAN"));
    const chosen = pURL || pLS || "";

    if (planSelect) planSelect.value = chosen;

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

    // 1) Edge Function
    try {
      const { data, error } = await sb.functions.invoke("mp-checkout", {
        body: { plan_slug: slug },
      });
      if (!error && data?.url) {
        window.location.href = data.url;
        return;
      }
      console.warn("[REGISTER] mp-checkout falló, uso fallback:", error?.message || data);
    } catch (e) {
      console.warn("[REGISTER] mp-checkout excepción, uso fallback:", e);
    }

    // 2) Fallback
    const url = MP_FALLBACK_URL[slug];
    if (!url) throw new Error("No hay URL de pago para este plan.");
    window.location.href = url;
  }

  async function ensureSession(emailVal, pass) {
    // Si ya hay sesión, listo
    const { data: sess0 } = await sb.auth.getSession();
    if (sess0?.session) return sess0.session;

    // Intento signUp
    const signUpRes = await sb.auth.signUp({ email: emailVal, password: pass });

    if (signUpRes.error) {
      // Si el usuario ya existe, intento signIn (reduce fricción)
      const msg = String(signUpRes.error.message || "");
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        const signInRes = await sb.auth.signInWithPassword({ email: emailVal, password: pass });
        if (signInRes.error) throw new Error(signInRes.error.message);
        if (!signInRes.data?.session) throw new Error("No pude iniciar sesión.");
        return signInRes.data.session;
      }
      throw new Error(signUpRes.error.message);
    }

    // Si confirmación de email está ON, puede venir sin sesión.
    let session = signUpRes.data?.session;
    if (!session) {
      const signInRes = await sb.auth.signInWithPassword({ email: emailVal, password: pass });
      if (signInRes.error) {
        throw new Error(
          "Cuenta creada pero no hay sesión activa. Para este flujo, desactivá la confirmación de email (Supabase Auth > Email) o ajustamos el flujo con magic link."
        );
      }
      session = signInRes.data?.session;
    }

    if (!session) throw new Error("No pude iniciar sesión luego del registro.");
    return session;
  }

  async function upsertMinimalProfile(uid, emailVal, name, phoneVal, slug) {
    // profiles: email es NOT NULL y UNIQUE, el resto puede ser null
    const { error } = await sb.from("profiles").upsert(
      {
        user_id: uid,
        email: emailVal,
        full_name: name || null,
        phone: phoneVal || null,
        requested_plan_slug: slug,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) console.warn("[REGISTER] profiles upsert:", error.message);

    // metadata mínima (útil como fallback)
    try {
      const { error: umErr } = await sb.auth.updateUser({
        data: { requested_plan: slug },
      });
      if (umErr) console.warn("[REGISTER] updateUser metadata:", umErr.message);
    } catch (e) {
      console.warn("[REGISTER] updateUser metadata exception:", e);
    }
  }

  // Eventos
  payBtn?.addEventListener("click", async () => {
    const slug = normalizePlanSlug(planSelect?.value);
    if (!slug) return setMsg("Seleccioná un plan para continuar.", "error");
    try {
      await startCheckout(slug);
    } catch (e) {
      setMsg(e?.message || String(e), "error");
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Ir a pagar";
      }
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");
    if (payBox) payBox.style.display = "none";

    try {
      const slug = normalizePlanSlug(planSelect?.value);
      if (!slug) return setMsg("Seleccioná un plan para continuar.", "error");

      const p1 = password?.value || "";
      const p2 = password2?.value || "";
      if (p1.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres.", "error");
      if (p1 !== p2) return setMsg("Las contraseñas no coinciden.", "error");

      const emailVal = (email?.value || "").trim();
      if (!emailVal) return setMsg("Ingresá un email válido.", "error");

      const nameVal = (fullName?.value || "").trim();
      const phoneVal = (phone?.value || "").trim();
      if (!nameVal) return setMsg("Ingresá tu nombre y apellido.", "error");
      if (!phoneVal) return setMsg("Ingresá un teléfono.", "error");

      setMsg("Creando cuenta…", "small");

      const session = await ensureSession(emailVal, p1);
      const uid = session?.user?.id;
      if (!uid) throw new Error("No pude obtener el user_id.");

      // Estado de plan pendiente (para que el panel muestre estado coherente)
      await sb.rpc("user_set_plan_pending", { p_plan_slug: slug });

      // Guardamos lo mínimo
      await upsertMinimalProfile(uid, emailVal, nameVal, phoneVal, slug);

      localStorage.setItem("A360_SELECTED_PLAN", slug);

      setMsg("Listo ✅ Redirigiendo a pago…", "notice");

      // Checkout inmediato
      await startCheckout(slug);
    } catch (err) {
      console.error("[REGISTER] submit error:", err);
      setMsg(err?.message || String(err), "error");

      // Fallback: mostrar caja de pago manual
      if (payHint) {
        payHint.className = "notice small";
        payHint.textContent = "No pude abrir el pago automáticamente. Podés intentarlo de nuevo.";
      }
      if (payBox) payBox.style.display = "block";
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Ir a pagar";
      }
    }
  });

  // Init
  (async function init() {
    await prefillPlan();
  })();
})();