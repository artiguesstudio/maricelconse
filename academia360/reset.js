// reset.js — pedir link + setear nueva contraseña (recovery) [robusto]
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

  const newPassForm = $("newPassForm");
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

  // ✅ IMPORTANTÍSIMO: usar origen canónico para evitar redirects que pierdan el hash.
  function siteOrigin() {
    const cfg = window.A360 || {};
    const o = String(cfg.SITE_ORIGIN || window.location.origin || "").replace(/\/+$/, "");
    return o || window.location.origin;
  }

  function recoveryRedirectUrl() {
    return `${siteOrigin()}${basePath()}/reset.html`;
  }

  function hashParams() {
    const h = String(window.location.hash || "");
    const raw = h.startsWith("#") ? h.slice(1) : h;
    return new URLSearchParams(raw);
  }

  function queryParams() {
    return new URLSearchParams(window.location.search || "");
  }

  function isRecoveryHintPresent() {
    const h = hashParams();
    const q = queryParams();
    return h.get("type") === "recovery" || q.get("type") === "recovery";
  }

  function showRecoveryUI() {
    if (requestForm) requestForm.style.display = "none";
    if (newPassForm) newPassForm.style.display = "block";
  }

  function showRequestUI() {
    if (requestForm) requestForm.style.display = "block";
    if (newPassForm) newPassForm.style.display = "none";
  }

  function cleanUrl() {
    // Borra hash/query sensibles del address bar
    const clean = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, clean);
  }

  async function establishRecoverySessionIfAny() {
    const h = hashParams();
    const q = queryParams();

    // 1) Formato clásico: #access_token=...&refresh_token=...&type=recovery
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");

    if (access_token && refresh_token) {
      const { error } = await sb.auth.setSession({ access_token, refresh_token });
      if (error) throw new Error(`No pude establecer sesión de recovery: ${error.message}`);
      cleanUrl();
      return;
    }

    // 2) Formato PKCE: ?code=...
    const code = q.get("code");
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
      if (error) throw new Error(`No pude intercambiar code por sesión: ${error.message}`);
      cleanUrl();
      return;
    }

    // 3) Formato token_hash: ?token_hash=...&type=recovery
    const token_hash = q.get("token_hash");
    const type = q.get("type");
    if (token_hash && type) {
      const { error } = await sb.auth.verifyOtp({ token_hash, type });
      if (error) throw new Error(`No pude verificar OTP: ${error.message}`);
      cleanUrl();
      return;
    }
  }

  // -----------------------------------------------------
  // MODO A: pedir email
  // -----------------------------------------------------
  requestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

    const emailVal = String(reqEmail?.value || "").trim().toLowerCase();
    if (!emailVal) return setMsg("Ingresá un email válido.", "error");
    if (reqEmail && typeof reqEmail.checkValidity === "function" && !reqEmail.checkValidity()) {
      return setMsg("Ingresá un email válido.", "error");
    }

    if (reqBtn) {
      reqBtn.disabled = true;
      reqBtn.textContent = "Enviando…";
    }

    try {
      const { error } = await sb.auth.resetPasswordForEmail(emailVal, {
        redirectTo: recoveryRedirectUrl(), // ✅ canónica
      });
      if (error) throw new Error(error.message);

      setMsg("Listo ✅ Revisá tu email (y spam) para continuar.", "notice");
    } catch (err) {
      console.error("[RESET] request error:", err);
      setMsg(err?.message || String(err), "error");
    } finally {
      if (reqBtn) {
        reqBtn.disabled = false;
        reqBtn.textContent = "Enviar link de recuperación";
      }
    }
  });

  // -----------------------------------------------------
  // MODO B: setear nueva password
  // -----------------------------------------------------
  newPassForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

    const p1 = String(newPass?.value || "");
    const p2 = String(newPass2?.value || "");

    if (p1.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres.", "error");
    if (p1 !== p2) return setMsg("Las contraseñas no coinciden.", "error");

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando…";
    }

    try {
      // ✅ Confirmar que hay sesión de recovery
      const { data: s0, error: sErr } = await sb.auth.getSession();
      if (sErr) console.warn("[RESET] getSession:", sErr.message);
      if (!s0?.session) {
        throw new Error(
          "No hay sesión válida de recuperación. Es probable que el link haya perdido el token por un redirect. Pedí un nuevo link."
        );
      }

      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw new Error(error.message);

      setMsg("Contraseña actualizada ✅ Redirigiendo al login…", "notice");

      await sb.auth.signOut().catch(() => {});
      setTimeout(() => {
        window.location.href = `${basePath()}/login.html`;
      }, 800);
    } catch (err) {
      console.error("[RESET] update password error:", err);
      setMsg(err?.message || String(err), "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar nueva contraseña";
      }
    }
  });

  // -----------------------------------------------------
  // Init
  // -----------------------------------------------------
  (async function init() {
    try {
      // Si el link trae tokens/codes, los convertimos explícitamente en sesión
      await establishRecoverySessionIfAny();

      const { data } = await sb.auth.getSession();
      const hasSession = !!data?.session;

      // Si hay pista de recovery (type=recovery) o hay sesión, mostramos el form de nueva pass
      if (isRecoveryHintPresent() || hasSession) {
        showRecoveryUI();
        setMsg("Ingresá tu nueva contraseña para completar la recuperación.", "notice");
      } else {
        showRequestUI();
      }
    } catch (e) {
      console.error("[RESET] init error:", e);
      // Si algo falla en recovery, volvemos al modo request con un mensaje claro
      showRequestUI();
      setMsg(
        e?.message ||
          "No pude iniciar la recuperación. Es probable que el link haya expirado o se haya perdido el token. Pedí uno nuevo.",
        "error"
      );
    }
  })();
})();