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

  // ✅ FORZAR refresh de sesión (evita "Invalid JWT" por token stale)
  const { data: refreshRes, error: refreshErr } = await sb.auth.refreshSession();
  const session = refreshRes?.session;

  if (refreshErr) console.warn("[REGISTER] refreshSession error:", refreshErr);

  if (!session?.access_token) {
    window.location.href = "./login.html";
    return;
  }

  try {
    const { data, error } = await sb.functions.invoke("mp-checkout", {
      body: { plan_slug: slug },
      headers: { authorization: `Bearer ${session.access_token}` }, // 👈 minúsculas ok
    });

    if (!error && data?.url) {
      window.location.href = data.url;
      return;
    }

    console.warn("[REGISTER] mp-checkout falló, uso fallback:", error?.message || data);
  } catch (e) {
    console.warn("[REGISTER] mp-checkout excepción, uso fallback:", e);
  }

  // fallback MP
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

  // Init
  (async function init() {
    await prefillPlan();
  })();
})();