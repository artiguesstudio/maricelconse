(() => {
  "use strict";

  if (!window.sb) {
    alert("Supabase no está cargado. Revisá supabaseClient.js / orden de scripts.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  const form   = $("registerForm");
  const regMsg = $("regMsg");

  const payBox  = $("payBox");
  const payBtn  = $("payBtn");
  const payHint = $("payHint");

  const planSelect   = $("planSelect");
  const planLockHint = $("planLockHint");

  const fullName  = $("fullName");
  const age       = $("age");
  const email     = $("email");
  const phone     = $("phone");
  const objective = $("objective");
  const track     = $("track");
  const level     = $("level");
  const notes     = $("notes");

  const password  = $("password");
  const password2 = $("password2");

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
    s = String(s || "").toLowerCase().trim();
    if (["basic", "mid", "pro"].includes(s)) return s;
    if (s === "premium") return "pro";
    return "";
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
    const pLS  = normalizePlanSlug(localStorage.getItem("A360_SELECTED_PLAN"));
    const chosen = pURL || pLS || "";

    console.log("[REGISTER] href:", window.location.href);
    console.log("[REGISTER] plan URL:", pURL, "plan LS:", pLS, "chosen:", chosen);

    planSelect.value = chosen;

    if (pURL) {
      planSelect.disabled = true;
      if (planLockHint) planLockHint.style.display = "block";
    } else {
      planSelect.disabled = false;
      if (planLockHint) planLockHint.style.display = "none";
    }
// Dentro del flujo post-registro (con sesión activa)
const { data: u } = await sb.auth.getUser();
const uid = u?.user?.id;
if (!uid) throw new Error("No hay sesión activa.");

const full_name = (document.getElementById("regFullName")?.value || "").trim() || null;
const phone = (document.getElementById("regPhone")?.value || "").trim() || null;
const age = Number(document.getElementById("regAge")?.value || "") || null;

const weight_kg = Number(document.getElementById("regWeight")?.value || "") || null;
const height_cm = Number(document.getElementById("regHeight")?.value || "") || null;

// si ya tenés “nivel”, reutilizá tu id. Si no, lo dejamos null.
const training_level = (document.getElementById("regLevel")?.value || "").trim() || null;

const { error: upErr } = await sb
  .from("user_profile")
  .upsert({
    user_id: uid,
    full_name,
    phone,
    age,
    weight_kg,
    height_cm,
    training_level
  }, { onConflict: "user_id" });

if (upErr) throw new Error(upErr.message);
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
        body: { plan_slug: slug }
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
      if (payBtn) { payBtn.disabled = false; payBtn.textContent = "Ir a pagar"; }
      return;
    }

    window.location.href = url;
  }

  payBtn?.addEventListener("click", async () => {
    const slug = normalizePlanSlug(planSelect?.value);
    if (!slug) return setMsg("Seleccioná un plan para continuar.", "error");
    await startCheckout(slug);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");
    if (payBox) payBox.style.display = "none";

    const slug = normalizePlanSlug(planSelect?.value);
    if (!slug) return setMsg("Seleccioná un plan para continuar.", "error");

    const p1 = password?.value || "";
    const p2 = password2?.value || "";
    if (p1.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres.", "error");
    if (p1 !== p2) return setMsg("Las contraseñas no coinciden.", "error");

    const emailVal = (email?.value || "").trim();
    if (!emailVal) return setMsg("Ingresá un email válido.", "error");

    setMsg("Creando cuenta…", "small");

    const signUpRes = await sb.auth.signUp({ email: emailVal, password: p1 });
    if (signUpRes.error) return setMsg(signUpRes.error.message, "error");

    // Necesitamos sesión para que auth.uid() funcione en la RPC
    let session = signUpRes.data?.session;

    // Si no hay sesión, intentamos login directo (sirve si confirmación email está OFF)
    if (!session) {
      const signInRes = await sb.auth.signInWithPassword({ email: emailVal, password: p1 });
      if (signInRes.error) {
        return setMsg(
          "Cuenta creada pero no hay sesión activa. Desactivá la confirmación de email en Supabase (Auth > Email) para este flujo.",
          "error"
        );
      }
      session = signInRes.data?.session;
    }

    if (!session) return setMsg("No pude iniciar sesión luego del registro.", "error");

    setMsg("Guardando ficha…", "small");

    const payload = {
      p_full_name: (fullName?.value || "").trim(),
      p_age: Number(age?.value),
      p_email: emailVal,
      p_phone: (phone?.value || "").trim(),
      p_requested_plan_slug: slug,
      p_objective: objective?.value || "fat_loss",
      p_track: track?.value || "gym",
      p_training_level: level?.value || "beginner",
      p_notes: (notes?.value || "").trim() || null
    };

    const rpcRes = await sb.rpc("submit_enrollment_form_v1", payload);
    if (rpcRes.error) return setMsg(rpcRes.error.message, "error");

    localStorage.setItem("A360_SELECTED_PLAN", slug);
    localStorage.setItem("A360_OBJECTIVE", payload.p_objective);
    localStorage.setItem("A360_TRACK", payload.p_track);

    setMsg("Se completó tu registro ✅", "notice");

    if (payHint) {
      payHint.className = "notice small";
      payHint.textContent = "Debés realizar el pago para completar la suscripción.";
    }

    if (payBox) payBox.style.display = "block";
    if (payBtn) { payBtn.disabled = false; payBtn.textContent = "Ir a pagar"; }
  });

  (async function init() {
    await prefillPlan();
  })();
})();