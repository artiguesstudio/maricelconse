// register.js — registro + preparación segura + checkout inmediato
(() => {
  "use strict";

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

  const createBtn = $("createBtn");
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

  // =====================================================
  // State
  // =====================================================
  const CREATE_BTN_IDLE_TEXT = (createBtn?.textContent || "Crear cuenta y pagar").trim();
  const PAY_BTN_IDLE_TEXT = (payBtn?.textContent || "Ir a pagar").trim();

  let checkoutPrepared = false;
  let lastReadyPlan = "";

  // =====================================================
  // UI helpers
  // =====================================================
  function setMsg(text, kind = "small") {
    if (!regMsg) return;
    regMsg.className = kind; // "small" | "notice" | "error"
    regMsg.textContent = text || "";
  }

  function setButtonState(button, disabled, text) {
    if (!button) return;
    button.disabled = !!disabled;
    if (typeof text === "string" && text) button.textContent = text;
  }

  function resetCreateButton() {
    setButtonState(createBtn, false, CREATE_BTN_IDLE_TEXT);
  }

  function resetPayButton() {
    setButtonState(payBtn, false, PAY_BTN_IDLE_TEXT);
  }

  function hidePayRetry() {
    if (payBox) payBox.style.display = "none";
    if (payHint) {
      payHint.className = "notice small";
      payHint.textContent = "No pude abrir el pago automáticamente. Podés intentarlo de nuevo.";
    }
    resetPayButton();
  }

  function showPayRetry(text) {
    if (payHint) {
      payHint.className = "notice small";
      payHint.textContent =
        text || "Tu cuenta ya quedó creada. No pude abrir el checkout automáticamente. Podés reintentar.";
    }
    if (payBox) payBox.style.display = "block";
    resetPayButton();
  }

  // =====================================================
  // Utils
  // =====================================================
  function normalizePlanSlug(value) {
    const v = String(value || "").toLowerCase().trim();
    if (v === "premium") return "pro";
    if (["basic", "mid", "pro"].includes(v)) return v;
    return "";
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function planFromURL() {
    try {
      const url = new URL(window.location.href);
      return normalizePlanSlug(url.searchParams.get("plan"));
    } catch {
      return "";
    }
  }

  function prefillPlan() {
    const fromUrl = planFromURL();
    const fromLs = normalizePlanSlug(localStorage.getItem("A360_SELECTED_PLAN"));
    const chosen = fromUrl || fromLs || "";

    if (planSelect) {
      planSelect.value = chosen;
      planSelect.disabled = !!fromUrl;
    }

    if (planLockHint) {
      planLockHint.style.display = fromUrl ? "block" : "none";
    }

    if (chosen) {
      localStorage.setItem("A360_SELECTED_PLAN", chosen);
    }
  }

  // =====================================================
  // Auth
  // =====================================================
  async function ensureSession(targetEmail, pass) {
    const emailVal = normalizeEmail(targetEmail);

    // 1) Revisar sesión actual
    const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr) {
      console.warn("[REGISTER] getSession:", sessionErr.message);
    }

    const activeSession = sessionData?.session || null;
    const activeEmail = normalizeEmail(activeSession?.user?.email);

    // Si ya hay sesión del mismo email, la reutilizamos
    if (activeSession && activeEmail === emailVal) {
      return activeSession;
    }

    // Si hay sesión pero es de otro email, la cerramos para no mezclar cuentas
    if (activeSession && activeEmail && activeEmail !== emailVal) {
      const { error: signOutErr } = await sb.auth.signOut();
      if (signOutErr) {
        throw new Error(
          "Hay una sesión activa de otra cuenta y no pude cerrarla. Cerrá sesión e intentá nuevamente."
        );
      }
    }

    // 2) Intento crear cuenta
    const signUpRes = await sb.auth.signUp({
      email: emailVal,
      password: pass,
    });

    if (signUpRes.error) {
      const rawMsg = String(signUpRes.error.message || "");
      const msg = rawMsg.toLowerCase();

      // Si el usuario ya existe, intentamos iniciar sesión
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        const signInRes = await sb.auth.signInWithPassword({
          email: emailVal,
          password: pass,
        });

        if (signInRes.error) {
          throw new Error(signInRes.error.message || "No pude iniciar sesión con la cuenta existente.");
        }

        if (!signInRes.data?.session) {
          throw new Error("No pude iniciar sesión con la cuenta existente.");
        }

        return signInRes.data.session;
      }

      throw new Error(signUpRes.error.message || "No pude crear la cuenta.");
    }

    // 3) Puede no venir sesión si la confirmación por email está activa
    let session = signUpRes.data?.session || null;

    if (!session) {
      const signInRes = await sb.auth.signInWithPassword({
        email: emailVal,
        password: pass,
      });

      if (signInRes.error) {
        throw new Error(
          "Cuenta creada pero no hay sesión activa. Para este flujo, desactivá la confirmación de email en Supabase Auth o ajustamos el alta con otro flujo."
        );
      }

      session = signInRes.data?.session || null;
    }

    if (!session?.user?.id) {
      throw new Error("No pude obtener una sesión válida luego del registro.");
    }

    return session;
  }

  // =====================================================
  // DB prep
  // HOTFIX: no llamamos user_set_plan_pending porque está roto.
  // mp-checkout ya deja user_plan en past_due con mp_preapproval_id.
  // =====================================================
  async function upsertMinimalProfile(uid, emailVal, nameVal, phoneVal, slug) {
    const payload = {
      user_id: uid,
      email: normalizeEmail(emailVal),
      full_name: (nameVal || "").trim() || null,
      phone: (phoneVal || "").trim() || null,
      requested_plan_slug: slug,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      throw new Error(`No pude guardar el perfil: ${error.message}`);
    }

    // Metadata útil como apoyo; si falla, no bloqueamos el checkout
    try {
      const { error: metaErr } = await sb.auth.updateUser({
        data: { requested_plan: slug },
      });

      if (metaErr) {
        console.warn("[REGISTER] updateUser metadata:", metaErr.message);
      }
    } catch (e) {
      console.warn("[REGISTER] updateUser metadata exception:", e);
    }
  }

  // =====================================================
// Checkout
// =====================================================
async function startCheckout(slug) {
  const MP_DIRECT_URL = {
    basic: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=a744205529154c91bdfe7811443a9e41",
    mid:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=b003ccd51f3d49c59d3daf76315bb9d6",
    pro:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=4e5b56a866274858ad36638487349115",
  };

  const url = MP_DIRECT_URL[slug];
  if (!url) throw new Error("No hay URL de pago para este plan.");

  window.location.href = url;
}
  // =====================================================
  // Events
  // =====================================================
  payBtn?.addEventListener("click", async () => {
    if (!checkoutPrepared || !lastReadyPlan) {
      setMsg("Primero completá el formulario para preparar tu cuenta antes de pagar.", "error");
      hidePayRetry();
      return;
    }

    try {
      await startCheckout(lastReadyPlan);
    } catch (err) {
      console.error("[REGISTER] retry checkout error:", err);
      setMsg(err?.message || String(err), "error");
      showPayRetry("Tu cuenta ya quedó creada. No pude abrir el checkout automáticamente. Podés reintentar.");
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    checkoutPrepared = false;
    lastReadyPlan = "";
    hidePayRetry();
    setMsg("");

    setButtonState(createBtn, true, "Creando cuenta…");

    try {
      const slug = normalizePlanSlug(planSelect?.value);
      if (!slug) {
        setMsg("Seleccioná un plan para continuar.", "error");
        return;
      }

      const p1 = password?.value || "";
      const p2 = password2?.value || "";

      if (p1.length < 6) {
        setMsg("La contraseña debe tener al menos 6 caracteres.", "error");
        return;
      }

      if (p1 !== p2) {
        setMsg("Las contraseñas no coinciden.", "error");
        return;
      }

      const emailVal = normalizeEmail(email?.value);
      const nameVal = (fullName?.value || "").trim();
      const phoneVal = (phone?.value || "").trim();

      if (!emailVal) {
        setMsg("Ingresá un email válido.", "error");
        return;
      }

      if (email && typeof email.checkValidity === "function" && !email.checkValidity()) {
        setMsg("Ingresá un email válido.", "error");
        return;
      }

      if (!nameVal) {
        setMsg("Ingresá tu nombre y apellido.", "error");
        return;
      }

      if (!phoneVal) {
        setMsg("Ingresá un teléfono.", "error");
        return;
      }

      setMsg("Creando cuenta…", "small");

      // 1) Sesión correcta
      const session = await ensureSession(emailVal, p1);
      const uid = session?.user?.id;

      if (!uid) {
        throw new Error("No pude obtener el user_id de la sesión.");
      }

      // 2) Guardar perfil mínimo ANTES de pagar
      await upsertMinimalProfile(uid, emailVal, nameVal, phoneVal, slug);

      // 3) Guardar estado local solo si salió bien
      checkoutPrepared = true;
      lastReadyPlan = slug;
      localStorage.setItem("A360_SELECTED_PLAN", slug);

      setMsg("Cuenta creada ✅ Abriendo pago…", "notice");

      // 4) Checkout
      await startCheckout(slug);
    } catch (err) {
      console.error("[REGISTER] submit error:", err);
      setMsg(err?.message || String(err), "error");

      // Si la cuenta quedó preparada pero el checkout no abrió, habilitamos retry seguro
      if (checkoutPrepared && lastReadyPlan) {
        showPayRetry("Tu cuenta ya quedó creada. No pude abrir el checkout automáticamente. Podés reintentar.");
      } else {
        hidePayRetry();
      }
    } finally {
      resetCreateButton();
    }
  });

  // =====================================================
  // Init
  // =====================================================
  prefillPlan();
})();