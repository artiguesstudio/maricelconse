// reset.js — flujo OTP (código) para recovery
(() => {
  "use strict";

  if (!window.sb) {
    alert("Supabase no está cargado. Revisá supabaseClient.js / orden de scripts.");
    return;
  }

  const sb = window.sb;
  const $ = (id) => document.getElementById(id);

  const msg = $("msg");

  const requestForm = $("requestForm");
  const reqEmail = $("reqEmail");
  const reqBtn = $("reqBtn");

  const verifyForm = $("verifyForm");
  const otpCode = $("otpCode");
  const newPass = $("newPass");
  const newPass2 = $("newPass2");
  const saveBtn = $("saveBtn");

  function setMsg(text, kind = "small") {
    if (!msg) return;
    msg.className = kind; // "small" | "notice" | "error"
    msg.textContent = text || "";
  }

  function basePath() {
    return window.location.pathname.includes("/academia360/") ? "/academia360" : "";
  }

  // ✅ Canonical origin (evita redirects raros; igual acá ya no dependemos del hash)
  function siteOrigin() {
    const cfg = window.A360 || {};
    const o = String(cfg.SITE_ORIGIN || window.location.origin || "").replace(/\/+$/, "");
    return o || window.location.origin;
  }

  function redirectToReset() {
    return `${siteOrigin()}${basePath()}/reset.html`;
  }

  function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeOtp(v) {
    // se permite pegar con espacios/guiones
    return String(v || "").replace(/\D/g, "").trim();
  }

  // Si venís con error en hash (ej: otp_expired), lo mostramos pero no entramos en loop
  (function showHashErrorIfAny() {
    const raw = String(window.location.hash || "");
    const params = new URLSearchParams(raw.startsWith("#") ? raw.slice(1) : raw);
    const err = params.get("error_code") || params.get("error");
    const desc = params.get("error_description");
    if (err) {
      setMsg(
        `No pude validar el link/código anterior (${err}). ${desc ? decodeURIComponent(desc.replace(/\+/g, " ")) : ""} Pedí un nuevo código.`,
        "error"
      );
      // limpiamos hash para que no quede “pegado”
      const clean = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, document.title, clean);
    }
  })();

  // -----------------------------------------------------
  // Paso 1: pedir código
  // -----------------------------------------------------
  requestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

    const emailVal = normalizeEmail(reqEmail?.value);
    if (!emailVal) return setMsg("Ingresá un email válido.", "error");
    if (reqEmail && typeof reqEmail.checkValidity === "function" && !reqEmail.checkValidity()) {
      return setMsg("Ingresá un email válido.", "error");
    }

    if (reqBtn) {
      reqBtn.disabled = true;
      reqBtn.textContent = "Enviando…";
    }

    try {
      // Esto envía el email de recovery. El template ahora muestra {{ .Token }}.
      const { error } = await sb.auth.resetPasswordForEmail(emailVal, {
        redirectTo: redirectToReset(),
      });

      if (error) throw new Error(error.message);

      setMsg("Listo ✅ Te envié un código por email. Pegalo abajo para crear tu nueva contraseña.", "notice");
      otpCode?.focus?.();
    } catch (err) {
      console.error("[RESET-OTP] request error:", err);
      setMsg(err?.message || String(err), "error");
    } finally {
      if (reqBtn) {
        reqBtn.disabled = false;
        reqBtn.textContent = "Enviar código";
      }
    }
  });

  // -----------------------------------------------------
  // Paso 2: verificar OTP + setear password
  // -----------------------------------------------------
  verifyForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

    const emailVal = normalizeEmail(reqEmail?.value);
    if (!emailVal) return setMsg("Ingresá tu email arriba (el mismo al que te llegó el código).", "error");

    const token = normalizeOtp(otpCode?.value);
    if (!token) return setMsg("Pegá el código que te llegó por email.", "error");

    const p1 = String(newPass?.value || "");
    const p2 = String(newPass2?.value || "");

    if (p1.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres.", "error");
    if (p1 !== p2) return setMsg("Las contraseñas no coinciden.", "error");

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando…";
    }

    try {
      // 1) Verificar OTP de recovery (crea sesión)
      const { data, error } = await sb.auth.verifyOtp({
        email: emailVal,
        token,
        type: "recovery",
      });

      if (error) throw new Error(error.message);
      if (!data?.session) {
        throw new Error("No pude establecer sesión de recuperación. Pedí un nuevo código.");
      }

      // 2) Setear nueva contraseña
      const { error: upErr } = await sb.auth.updateUser({ password: p1 });
      if (upErr) throw new Error(upErr.message);

      setMsg("Contraseña actualizada ✅ Redirigiendo al login…", "notice");
      await sb.auth.signOut().catch(() => {});
      setTimeout(() => {
        window.location.href = `${basePath()}/login.html`;
      }, 800);
    } catch (err) {
      console.error("[RESET-OTP] verify/update error:", err);
      setMsg(
        err?.message ||
          "No pude validar el código. Si expiró, pedí uno nuevo.",
        "error"
      );
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar nueva contraseña";
      }
    }
  });

  // Init
  setMsg("Paso 1: pedí el código. Paso 2: pegalo abajo y definí tu nueva contraseña.", "small");
})();