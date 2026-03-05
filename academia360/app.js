// app.js — limpio (comentarios por día + replies admin + badge)
// Rutinas + gate + clases en vivo + biblioteca grabadas + descarga + perfil + comentarios a coach
(() => {
  "use strict";

  console.log("[A360] app.js cargó ✅", new Date().toISOString());

  // =====================================================
  // Guard rails
  // =====================================================
  const sb = window.sb;
  const requireAuth = window.A360Auth?.requireAuthOrRedirect;

  if (!sb) {
    console.error("[A360] sb no existe. Revisa el orden de scripts.");
    return;
  }
  if (!requireAuth) {
    console.error("[A360] A360Auth.requireAuthOrRedirect no existe. Revisa auth.js.");
    return;
  }

  // =====================================================
  // Constantes / helpers
  // =====================================================
  const AR_TZ = "America/Argentina/Buenos_Aires";
  const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const MP_FALLBACK_URL = {
    basic: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=a744205529154c91bdfe7811443a9e41",
    mid:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=b003ccd51f3d49c59d3daf76315bb9d6",
    pro:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=4e5b56a866274858ad36638487349115",
  };

  const $id = (id) => document.getElementById(id);

  function norm(v) { return String(v ?? "").trim().toLowerCase(); }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function monthLabel(n) { return MONTHS_ES[n - 1] || "Mes"; }
  function monthNameEs(monthIndex) { return MONTHS_ES[monthIndex] || "Mes"; }
  function labelTrack(track) { return track === "gym" ? "Gimnasio" : track === "both" ? "Ambos" : "Casa"; }

  function setNotice(el, text, kind = "notice") {
    if (!el) return;
    el.className = kind;
    el.textContent = text || "";
  }
  function clearText(el) {
    if (!el) return;
    el.className = "small";
    el.textContent = "";
  }

  function formatDateEs(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
  }
  function formatDateTimeShort(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const date = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, day:"2-digit", month:"2-digit" }).format(d);
    const time = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, hour:"2-digit", minute:"2-digit", hour12:false, hourCycle:"h23" }).format(d);
    return `${date} ${time}hs`;
  }
  function formatPaidThrough(value) {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(value));
    } catch (_) {
      return String(value);
    }
  }

  function filenameSafe(value) {
    return String(value || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  function normalizeTrack(v) {
    const raw = norm(v);
    if (raw === "gym" || raw === "gimnasio") return "gym";
    if (raw === "home" || raw === "casa") return "home";
    if (raw === "both" || raw === "ambos") return "both";
    return null;
  }

  // =====================================================
  // DOM (generales)
  // =====================================================
  const siteHeader = $id("siteHeader");
  const yearEl = $id("year");

  const monthTitle = $id("monthTitle");
  const monthContent = $id("monthContent");
  const userEmail = $id("userEmail");
  const adminLink = $id("adminLink");
  const trackHint = $id("trackHint");

  const downloadRoutineBtn = $id("downloadRoutineBtn");

  const classesMsg = $id("classesMsg");
  const classesList = $id("classesList");
  const recordedMsg = $id("recordedMsg");
  const recordedList = $id("recordedList");

  const helpWhatsappBox = $id("helpWhatsappBox");

  const upgradeBox = $id("upgradeBox");
  const upgradeMidBtn = $id("upgradeMidBtn");
  const upgradeProBtn = $id("upgradeProBtn");

  const videoModal = $id("videoModal");
  const videoModalBackdrop = $id("videoModalBackdrop");
  const videoModalClose = $id("videoModalClose");
  const videoModalFrame = $id("videoModalFrame");
  const videoModalTitle = $id("videoModalTitle");

  // Perfil
  const profileBtn = $id("profileBtn");
  const profilePanel = $id("profilePanel");
  const profileCloseBtn = $id("profileCloseBtn");
  const profileEmail = $id("profileEmail");
  const profilePlanLine = $id("profilePlanLine");
  const profilePaidLine = $id("profilePaidLine");

  const profileUpgradeBox = $id("profileUpgradeBox");
  const profileUpgradeMidBtn = $id("profileUpgradeMidBtn");
  const profileUpgradeProBtn = $id("profileUpgradeProBtn");

  const pfFullName = $id("pfFullName");
  const pfPhone = $id("pfPhone");
  const pfAge = $id("pfAge");
  const pfWeight = $id("pfWeight");
  const pfHeight = $id("pfHeight");
  const pfLevel = $id("pfLevel");

  const profileSaveBtn = $id("profileSaveBtn");
  const profileMsg = $id("profileMsg");

  const deleteAccountBtn = $id("deleteAccountBtn");
  const deleteAccountMsg = $id("deleteAccountMsg");

  // Weekly quote
  const weeklyQuoteTitleEl = $id("weeklyQuoteTitle");
  const weeklyQuotePhraseEl = $id("weeklyQuotePhrase");
  const weeklyQuoteImgEl = $id("weeklyQuoteImg");

  // =====================================================
  // Estado
  // =====================================================
  let currentObjective = "fat_loss";
  let currentTrack = "gym";

  let planSlug = null;
  let planInfo = null;

  let currentMonth = null;

  const monthCache = new Map();

  // Gate rutina
  let routineLocked = false;
  let routineAvailableAt = null;
  let gateRefreshTimer = null;

  // Replies badge/toast
  let repliesPollTimer = null;
  let lastToastKey = "";

  // Comentarios: cache day_id
  const dayIdCache = new Map(); // key `${month}:${week}:${day}` => uuid

  // =====================================================
  // Header
  // =====================================================
  function syncHeaderUI() {
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    if (!siteHeader) return;

    const onScroll = () => {
      if (window.scrollY > 16) siteHeader.classList.add("is-scrolled");
      else siteHeader.classList.remove("is-scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  async function doLogout() {
    try { await sb.auth.signOut(); } catch (_) {}
    window.location.href = "./index.html";
  }

  function openProfilePanel() {
    try { profileBtn?.click(); } catch (_) {}
  }

  document.addEventListener("click", async (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.getAttribute("data-action");
    if (!action) return;

    e.preventDefault();

    if (action === "logout") {
      await doLogout();
      return;
    }

    if (action === "upgrade-comments") {
      openProfilePanel();
      return;
    }
  });

  // =====================================================
  // Admin link
  // =====================================================
  async function maybeShowAdminLink() {
    if (!adminLink) return;
    adminLink.style.display = "none";
    const { data, error } = await sb.rpc("is_admin");
    if (!error && data === true) adminLink.style.display = "inline-flex";
  }

  // =====================================================
  // Weekly quote
  // =====================================================
  async function loadWeeklyQuoteIntoApp() {
    if (!weeklyQuoteTitleEl || !weeklyQuotePhraseEl || !weeklyQuoteImgEl) return;
    try {
      const { data, error } = await sb
        .from("weekly_quote")
        .select("id,title,phrase,image_url")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      weeklyQuoteTitleEl.textContent = data.title || "";
      weeklyQuotePhraseEl.textContent = data.phrase || "";

      const url = String(data.image_url || "").trim();
      if (url) {
        weeklyQuoteImgEl.src = url;
        weeklyQuoteImgEl.style.display = "";
      } else {
        weeklyQuoteImgEl.style.display = "none";
      }
    } catch (e) {
      console.warn("[APP] weekly_quote:", e);
    }
  }

  // =====================================================
  // Preferencias usuario
  // =====================================================
  async function loadUserPreferences() {
    const { data: u } = await sb.auth.getUser();
    const uid = u?.user?.id;
    const meta = u?.user?.user_metadata || {};

    let objective = norm(meta.objective) || null;
    let track = normalizeTrack(meta.track);

    if (uid) {
      const { data, error } = await sb
        .from("user_preferences")
        .select("objective, track")
        .eq("user_id", uid)
        .maybeSingle();

      if (!error && data) {
        objective = norm(data.objective) || objective;
        track = normalizeTrack(data.track) || track;
      }
    }

    return {
      objective: objective === "muscle_gain" ? "muscle_gain" : "fat_loss",
      track: track || "gym",
    };
  }

  function syncTrackUI() {
    if (trackHint) trackHint.textContent = labelTrack(currentTrack);
  }

  // =====================================================
  // Plan
  // =====================================================
  function isPlanActive() { return norm(planInfo?.status) === "active"; }

  function canSeePremiumContent() {
    return isPlanActive() && ["pro", "premium"].includes(norm(planSlug));
  }

  function canSeeWhatsappHelp() {
    return isPlanActive() && ["mid", "pro", "premium"].includes(norm(planSlug));
  }

  // ✅ Comentarios SOLO mid/pro (acepta "premium" como alias del pro)
  function canUseComments() {
    return isPlanActive() && ["mid", "pro", "premium"].includes(norm(planSlug));
  }

  function syncHelpWhatsappUI() {
    if (!helpWhatsappBox) return;
    helpWhatsappBox.style.display = canSeeWhatsappHelp() ? "block" : "none";
  }

  async function loadPlanBadge() {
    const { data: userRes } = await sb.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return null;

    const { data: row, error } = await sb
      .from("user_plan")
      .select("status, paid_through, plan_id, plans:plan_id (slug,name)")
      .eq("user_id", uid)
      .maybeSingle();

    if (error || !row) {
      planInfo = null;
      planSlug = null;
      return null;
    }

    if (!row.plans?.slug && row.plan_id) {
      const { data: pRow } = await sb.from("plans").select("slug,name").eq("id", row.plan_id).maybeSingle();
      row.plans = pRow || row.plans;
    }

    planInfo = row;
    planSlug = norm(row.status) === "active" ? (norm(row.plans?.slug) || null) : null;
    return row;
  }

  function syncUpgradeUI(currentSlug) {
    if (!upgradeBox) return;
    const slug = norm(currentSlug);
    const show = slug === "basic" || slug === "mid";
    upgradeBox.style.display = show ? "block" : "none";
    if (upgradeMidBtn) upgradeMidBtn.style.display = slug === "basic" ? "inline-flex" : "none";
    if (upgradeProBtn) upgradeProBtn.style.display = show ? "inline-flex" : "none";
  }

  async function startCheckout(targetSlug) {
    try {
      const { data: refreshRes } = await sb.auth.refreshSession();
      const session = refreshRes?.session;

      if (!session?.access_token) {
        window.location.href = "./login.html";
        return;
      }

      const { data, error } = await sb.functions.invoke("mp-checkout", {
        body: { plan_slug: targetSlug },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!error && data?.url) {
        window.location.href = data.url;
        return;
      }

      const fallback = MP_FALLBACK_URL[targetSlug];
      if (fallback) window.location.href = fallback;
      else alert(error?.message || "No pude iniciar el checkout.");
    } catch (e) {
      const fallback = MP_FALLBACK_URL[targetSlug];
      if (fallback) window.location.href = fallback;
      else alert(e?.message || String(e));
    }
  }

  upgradeMidBtn?.addEventListener("click", () => startCheckout("mid"));
  upgradeProBtn?.addEventListener("click", () => startCheckout("pro"));

  // =====================================================
  // Gate rutina
  // =====================================================
  function clearGateTimer() {
    if (gateRefreshTimer) clearTimeout(gateRefreshTimer);
    gateRefreshTimer = null;
  }

  function scheduleGateRefresh(availableAt) {
    clearGateTimer();
    if (!availableAt) return;

    const d = new Date(availableAt);
    if (Number.isNaN(d.getTime())) return;

    const ms = d.getTime() - Date.now() + 15_000;
    if (ms <= 0 || ms > 1000 * 60 * 60 * 50) return;

    gateRefreshTimer = setTimeout(() => {
      if (currentMonth) openMonth(currentMonth, { force: true }).catch(() => {});
    }, ms);
  }

  function renderRoutineLockedNotice(availableAt) {
    const when = availableAt ? formatDateTimeShort(availableAt) : "";
    const msg = `
      <div class="notice">
        <b>Acceso activado ✅</b><br>
        Tu rutina 100% personalizada se arma y llega dentro de <b>48 hs</b>.
        <br><br>
        <a class="btn primary" href="./onboarding.html">Completar ficha (2 min)</a>
        <br><br>
        ${when ? `<b>Se habilita:</b> ${esc(when)} (AR)` : `Te avisamos apenas esté lista.`}
      </div>
    `;
    if (monthContent) monthContent.innerHTML = msg;
  }

  // =====================================================
  // RPC Mes (gate + fallback)
  // =====================================================
  async function rpcMonthContent(monthNumber, objective) {
    const res = await sb.rpc("get_month_content_gate_secure", { p_month: monthNumber, p_objective: objective });
    if (!res.error) return res;

    const msg = String(res.error?.message || "");
    if (msg.includes("schema cache") || msg.includes("Could not find the function")) {
      const r3 = await sb.rpc("get_month_content_v3", { p_month: monthNumber, p_objective: objective });
      if (!r3.error) return r3;
      return await sb.rpc("get_month_content_v2", { p_month: monthNumber, p_objective: objective });
    }
    return res;
  }

  // =====================================================
  // Comentarios modal (robusto: scoping dentro de #commentModal)
  // =====================================================
  const commentModal = $id("commentModal");
  const commentModalBackdrop = $id("commentModalBackdrop");

  const commentModalSend = commentModal?.querySelector("#commentModalSend") || null;
  const commentModalText = commentModal?.querySelector("#commentModalText") || null;
  const commentModalClose = commentModal?.querySelector("#commentModalClose") || null;
  const commentModalTitle = commentModal?.querySelector("#commentModalTitle") || null;
  const commentModalMsg = commentModal?.querySelector("#commentModalMsg") || null;

  const commentsDomReady = !!(commentModal && commentModalBackdrop && commentModalSend && commentModalText && commentModalClose);
  const commentsAvailableNow = () => commentsDomReady && canUseComments();

  let commentCtx = null;

  function setCommentMsg(text, kind = "small") {
    if (!commentModalMsg) return;
    commentModalMsg.className = kind;
    commentModalMsg.textContent = text || "";
  }

  function ensureCommentThreadEl() {
    if (!commentModal) return null;

    let el = commentModal.querySelector("#commentModalThread");
    if (el) return el;

    el = document.createElement("div");
    el.id = "commentModalThread";
    el.style.cssText = "display:grid; gap:10px; margin-top:10px; margin-bottom:12px;";
    const ta = commentModal.querySelector("#commentModalText");
    if (ta?.parentNode) ta.parentNode.insertBefore(el, ta);
    else commentModal.appendChild(el);
    return el;
  }

  async function resolveDayId(monthNumber, weekNumber, dayNumber) {
    const key = `${monthNumber}:${weekNumber}:${dayNumber}`;
    if (dayIdCache.has(key)) return dayIdCache.get(key);

    const { data: w, error: wErr } = await sb
      .from("weeks")
      .select("id")
      .eq("month_number", monthNumber)
      .eq("week_number", weekNumber)
      .maybeSingle();

    if (wErr || !w?.id) throw new Error("No pude resolver la semana para guardar el comentario.");

    const { data: d, error: dErr } = await sb
      .from("week_days")
      .select("id")
      .eq("week_id", w.id)
      .eq("day_number", dayNumber)
      .maybeSingle();

    if (dErr || !d?.id) throw new Error("No pude resolver el día para guardar el comentario.");

    dayIdCache.set(key, d.id);
    return d.id;
  }

  function renderCommentBubble(c) {
    const when = c.created_at ? formatDateTimeShort(c.created_at) : "";
    const replyWhen = c.replied_at ? formatDateTimeShort(c.replied_at) : "";

    const userMsg = `
      <div style="border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.65);border-radius:14px;padding:10px 12px">
        <div class="small" style="opacity:.65">Tu comentario ${when ? `· ${esc(when)}` : ""}</div>
        <div style="margin-top:6px">${esc(c.message || "")}</div>
      </div>
    `;

    const adminMsg = (c.admin_reply && String(c.admin_reply).trim())
      ? `
        <div style="border:1px solid rgba(0,0,0,.10);background:rgba(0,0,0,.03);border-radius:14px;padding:10px 12px">
          <div class="small" style="opacity:.75">Respuesta de Maricel ${replyWhen ? `· ${esc(replyWhen)}` : ""}</div>
          <div style="margin-top:6px">${esc(c.admin_reply)}</div>
          <div class="small" style="margin-top:8px;opacity:.65">
            ${c.user_seen_reply_at ? `Visto · ${esc(formatDateTimeShort(c.user_seen_reply_at))}` : "Nueva respuesta"}
          </div>
        </div>
      `
      : "";

    return `<div style="display:grid;gap:8px">${userMsg}${adminMsg}</div>`;
  }

  async function loadCommentThread(ctx) {
    if (!commentsAvailableNow()) return;

    const thread = ensureCommentThreadEl();
    if (!thread) return;

    thread.innerHTML = `<div class="small" style="opacity:.75">Cargando…</div>`;

    const { data: u } = await sb.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) throw new Error("Sesión inválida.");

    const monthNumber = Number(ctx?.month || 0);
    const weekNumber  = Number(ctx?.week  || 0);
    const dayNumber   = Number(ctx?.day   || 0);
    if (!monthNumber || !weekNumber || !dayNumber) throw new Error("Contexto inválido para comentarios.");

    const day_id = await resolveDayId(monthNumber, weekNumber, dayNumber);

    const { data, error } = await sb
      .from("routine_comments")
      .select("id, created_at, message, admin_reply, replied_at, user_seen_reply_at")
      .eq("user_id", uid)
      .eq("day_id", day_id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw new Error(error.message);

    if (!data?.length) {
      thread.innerHTML = `<div class="small" style="opacity:.75">Todavía no hay comentarios en este día.</div>`;
      return;
    }

    // ✅ marcar vistos EN DB (lote por día) si hay replies no vistas
    const unseenInThisDay = (data || []).some((c) => c.admin_reply && !c.user_seen_reply_at);

    if (unseenInThisDay) {
      const markRes = await sb.rpc("user_mark_comment_replies_seen_for_day", { p_day_id: day_id });
      if (markRes.error) {
        console.warn("[A360] mark seen (day) failed:", markRes.error);
      } else {
        // Reflejo inmediato en UI (sin re-fetch)
        const nowIso = new Date().toISOString();
        for (const c of data) {
          if (c.admin_reply && !c.user_seen_reply_at) c.user_seen_reply_at = nowIso;
        }
        // re-chequear contador/toast
        loadUnseenReplySummary(uid).catch(() => {});
      }
    }

    thread.innerHTML = data.map(renderCommentBubble).join("");
  }

  function openCommentModal(ctx) {
    if (!commentsAvailableNow()) return;

    commentCtx = ctx || null;

    if (commentModalTitle) commentModalTitle.textContent = ctx?.title || "Comentarios";
    if (commentModalText) commentModalText.value = "";
    setCommentMsg("");

    commentModal.classList.add("is-open");
    commentModalBackdrop.classList.add("is-open");
    commentModal.setAttribute("aria-hidden", "false");
    commentModalBackdrop.setAttribute("aria-hidden", "false");

    loadCommentThread(ctx).catch((e) => {
      console.warn("[A360] loadCommentThread:", e);
      setCommentMsg(e?.message || String(e), "error");
    });

    setTimeout(() => commentModalText?.focus?.(), 30);
  }

  function closeCommentModal() {
    if (!commentsDomReady) return;
    commentModal.classList.remove("is-open");
    commentModalBackdrop.classList.remove("is-open");
    commentModal.setAttribute("aria-hidden", "true");
    commentModalBackdrop.setAttribute("aria-hidden", "true");
    commentCtx = null;
    setCommentMsg("");
  }

  commentModalBackdrop?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeCommentModal(); });
  commentModalClose?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeCommentModal(); });

  async function submitRoutineComment(ctx, message) {
    if (!commentsAvailableNow()) throw new Error("Comentarios disponibles solo en Plan Intermedio/Premium.");

    const { data: u } = await sb.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) throw new Error("Sesión inválida. Volvé a iniciar sesión.");

    const monthNumber = Number(ctx?.month || 0);
    const weekNumber = Number(ctx?.week || 0);
    const dayNumber = Number(ctx?.day || 0);
    if (!monthNumber || !weekNumber || !dayNumber) throw new Error("Contexto inválido para comentario.");

    const day_id = await resolveDayId(monthNumber, weekNumber, dayNumber);

    const { error } = await sb.from("routine_comments").insert({
      user_id: uid,
      day_id,
      message: String(message || "").trim(),
      read_at: null,
    });

    if (error) throw new Error(error.message || "No pude enviar el comentario.");

    await loadCommentThread(ctx);
  }

  if (commentsDomReady) {
    // Abrir modal por botón en la rutina
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-comment-open]");
      if (!btn) return;

      e.preventDefault();

      if (!canUseComments()) {
        // CTA para basic
        openProfilePanel();
        return;
      }

      const month = Number(btn.getAttribute("data-comment-month") || 0);
      const week = Number(btn.getAttribute("data-comment-week") || 0);
      const day = Number(btn.getAttribute("data-comment-day") || 0);
      const dayName = btn.getAttribute("data-comment-dayname") || `Día ${day}`;

      openCommentModal({ month, week, day, title: `Comentarios — Mes ${month} · Semana ${week} · ${dayName}` });
    });

    // Enviar
    commentModalSend.addEventListener("click", async () => {
      try {
        if (!canUseComments()) {
          openProfilePanel();
          return;
        }

        const txt = String(commentModalText?.value || "").trim();
        if (txt.length < 3) {
          setCommentMsg("Escribí un comentario un poquito más largo 🙂", "error");
          return;
        }
        if (!commentCtx) {
          setCommentMsg("No pude determinar a qué día corresponde el comentario.", "error");
          return;
        }

        commentModalSend.disabled = true;
        setCommentMsg("Enviando…", "small");

        await submitRoutineComment(commentCtx, txt);

        if (commentModalText) commentModalText.value = "";
        setCommentMsg("Enviado ✅", "notice");
      } catch (e) {
        console.error("[A360] submitRoutineComment:", e);
        setCommentMsg(e?.message || String(e), "error");
      } finally {
        commentModalSend.disabled = false;
      }
    });

    // Ctrl+Enter / Cmd+Enter
    commentModalText?.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        commentModalSend?.click();
      }
    });
  }

  // =====================================================
  // Toast (notificación de replies)
  // =====================================================
  function showToastAction(message, actionText, onAction) {
    const existing = document.getElementById("a360Toast");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.id = "a360Toast";
    wrap.style.cssText = `
      position:fixed; left:12px; right:12px; bottom:14px; z-index:9999;
      background:rgba(255,255,255,.95); border:1px solid rgba(0,0,0,.10);
      border-radius:14px; padding:12px;
      box-shadow:0 14px 40px rgba(0,0,0,.14);
      max-width:720px; margin:0 auto; display:flex; gap:10px; align-items:flex-start;
    `;

    const txt = document.createElement("div");
    txt.style.cssText = "flex:1; font-size:14px; line-height:1.35; color:#111;";
    txt.textContent = message;

    const btn1 = document.createElement("button");
    btn1.className = "btn primary";
    btn1.type = "button";
    btn1.textContent = actionText || "Ver";
    btn1.addEventListener("click", () => {
      try { onAction?.(); } catch (_) {}
      try { wrap.remove(); } catch (_) {}
    });

    const btn2 = document.createElement("button");
    btn2.className = "btn";
    btn2.type = "button";
    btn2.textContent = "Cerrar";
    btn2.addEventListener("click", () => wrap.remove());

    wrap.appendChild(txt);
    wrap.appendChild(btn1);
    wrap.appendChild(btn2);
    document.body.appendChild(wrap);

    setTimeout(() => { try { wrap.remove(); } catch (_) {} }, 16000);
  }

  async function loadUnseenReplySummary(uid) {
    // ✅ replies/toast solo si el plan permite comentarios
    if (!uid) return;
    if (!planInfo) return;
    if (!canUseComments()) return;

    // Count unseen replies
    const countRes = await sb
      .from("routine_comments")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", uid)
      .not("admin_reply", "is", null)
      .is("user_seen_reply_at", null);

    if (countRes.error) {
      console.warn("[A360] unseen count error:", countRes.error);
      return;
    }

    const unseenCount = Number(countRes.count || 0);

    // Si ya no hay nada → apagar toast y reset key
    if (!unseenCount) {
      lastToastKey = "";
      const t = document.getElementById("a360Toast");
      if (t) t.remove();
      return;
    }

    // Latest unseen (orden robusto)
    const latestRes = await sb
      .from("routine_comments")
      .select("id, day_id, replied_at, created_at")
      .eq("user_id", uid)
      .not("admin_reply", "is", null)
      .is("user_seen_reply_at", null)
      .order("replied_at", { ascending: false, nullsLast: true })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRes.error) {
      console.warn("[A360] latest unseen error:", latestRes.error);
      return;
    }

    const latest = latestRes.data;
    if (!latest?.id || !latest?.day_id) return;

    // Anti-spam real
    const toastKey = `${unseenCount}:${latest.id}`;
    if (toastKey === lastToastKey) return;
    lastToastKey = toastKey;

    // Resolver mes/semana/día
    const wdRes = await sb
      .from("week_days")
      .select("day_number, label, week_id")
      .eq("id", latest.day_id)
      .maybeSingle();

    if (wdRes.error || !wdRes.data?.week_id) return;

    const wkRes = await sb
      .from("weeks")
      .select("week_number, month_number")
      .eq("id", wdRes.data.week_id)
      .maybeSingle();

    if (wkRes.error) return;

    const wk = wkRes.data;
    const wd = wdRes.data;

    const ctx = {
      month: Number(wk.month_number),
      week: Number(wk.week_number),
      day: Number(wd.day_number),
      title: `Comentarios — Mes ${wk.month_number} · Semana ${wk.week_number} · ${wd.label || `Día ${wd.day_number}`}`,
    };

    // Texto SIN número (evita confusión tipo "9")
    const msg = `📩 Tenés respuesta(s) nueva(s) de Maricel.`;

    showToastAction(msg, "Ver ahora", async () => {
      await jumpToDayAndOpenComments(ctx);
      setTimeout(() => loadUnseenReplySummary(uid).catch(() => {}), 600);
    });
  }

  async function jumpToDayAndOpenComments(ctx) {
    if (!ctx) return;
    if (!canUseComments()) return;

    if (ctx.month && ctx.month !== currentMonth) {
      await openMonth(ctx.month, { force: true });
    }

    // abrir semana/día por dataset (renderMonth los setea)
    const wEl = monthContent?.querySelector(`details.week[data-week="${ctx.week}"]`);
    if (wEl) wEl.open = true;

    const dEl = wEl?.querySelector?.(`details.day[data-day="${ctx.day}"]`);
    if (dEl) {
      dEl.open = true;
      dEl.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }

    openCommentModal({ month: ctx.month, week: ctx.week, day: ctx.day, title: ctx.title });
  }

  // =====================================================
  // Render rutina (incluye dataset week/day + botón comentarios)
  // =====================================================
  function getItemsForDay(day) {
    if (currentTrack === "gym") return (day.items_gym || []);
    if (currentTrack === "home") return (day.items_home || []);
    return (day.items_gym || day.items_home || []);
  }

  function renderExerciseCard(item) {
    const videoBtn = item.video_url
      ? `
        <button class="btn btn-video" type="button"
          data-video-url="${esc(item.video_url)}"
          data-video-title="${esc(item.exercise)}">
          Ver video
        </button>
      `
      : "";

    return `
      <div class="ex-card">
        <div style="min-width:0">
          <div class="ex-name">${esc(item.exercise)}</div>
          <div class="ex-meta">
            ${esc(item.sets)}×${esc(item.reps)}
            ${item.notes ? `· ${esc(item.notes)}` : ""}
          </div>
        </div>
        <div class="ex-actions">${videoBtn}</div>
      </div>
    `;
  }

  function renderMonth(json) {
    if (!monthContent) return;
    monthContent.innerHTML = "";

    if (!json?.weeks?.length) {
      monthContent.innerHTML = `<div class="notice">Este mes no tiene contenido cargado todavía.</div>`;
      return;
    }

    const DAY_NAMES = { 1:"Lunes",2:"Martes",3:"Miércoles",4:"Jueves",5:"Viernes" };
    const canComments = canUseComments();

    json.weeks.forEach((week) => {
      const weekDetails = document.createElement("details");
      weekDetails.className = "week";
      weekDetails.open = false;
      weekDetails.dataset.week = String(week.week_number);

      weekDetails.addEventListener("toggle", () => {
        if (!weekDetails.open) return;
        monthContent.querySelectorAll("details.week").forEach((other) => {
          if (other !== weekDetails) other.open = false;
        });
      });

      weekDetails.innerHTML = `
        <summary>
          <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
            <b>Semana ${week.week_number}</b>
            ${week.title ? `<span class="small">${esc(week.title)}</span>` : ""}
          </div>
          <span class="small">Ver</span>
        </summary>
        <div class="week-body"></div>
      `;

      const weekBody = weekDetails.querySelector(".week-body");

      (week.days || []).forEach((day) => {
        const dayDetails = document.createElement("details");
        dayDetails.className = "day";
        dayDetails.open = false;
        dayDetails.dataset.day = String(day.day_number);

        dayDetails.addEventListener("toggle", () => {
          if (!dayDetails.open) return;
          weekBody.querySelectorAll("details.day").forEach((other) => {
            if (other !== dayDetails) other.open = false;
          });
        });

        const dayName = DAY_NAMES[day.day_number] || `Día ${day.day_number}`;
        const items = getItemsForDay(day);

        // ✅ Botón comentarios: solo mid/pro
        const commentBtn = (commentsDomReady && canComments)
          ? `
            <button class="btn btn-comment" type="button"
              data-comment-open="1"
              data-comment-month="${esc(currentMonth)}"
              data-comment-week="${esc(week.week_number)}"
              data-comment-day="${esc(day.day_number)}"
              data-comment-dayname="${esc(dayName)}">
              Comentarios/Seguimiento
            </button>
          `
          : `
            <button class="btn" type="button" data-action="upgrade-comments">
              Comentarios/Seguimiento (Plan Intermedio)
            </button>
          `;

        const hintHtml = canComments
          ? `<div class="comment-hint">Tip: Podés dejar comentarios de progreso, molestias o dudas para ajustar tu rutina.</div>`
          : `<div class="comment-hint" style="opacity:.75">Tip: Comentarios/seguimiento están disponibles en Plan Intermedio y Premium.</div>`;

        const listHtml = items?.length
          ? `<div class="ex-list">${items.map(renderExerciseCard).join("")}</div>`
          : `<div class="notice small" style="margin-top:10px">Rutina aún no cargada para este objetivo/modalidad.</div>`;

        dayDetails.innerHTML = `
          <summary>
            <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
              <b>${esc(dayName)}</b>
            </div>
            <span class="small">${items?.length ? `${items.length} ej.` : "Ver"}</span>
          </summary>

          <div class="day-body">
            <div class="day-toprow">
              <div class="chips">
                <div class="chip">${labelTrack(currentTrack)}</div>
              </div>
              ${commentsDomReady ? `<div class="day-actions">${commentBtn}</div>` : ""}
            </div>

            ${commentsDomReady ? hintHtml : ""}

            ${listHtml}
          </div>
        `;

        weekBody.appendChild(dayDetails);
      });

      monthContent.appendChild(weekDetails);
    });
  }

  async function openMonth(monthNumber, opts = {}) {
    currentMonth = monthNumber;
    if (monthTitle) monthTitle.textContent = monthLabel(monthNumber);

    const cacheKey = `${monthNumber}-${currentObjective}-${currentTrack}`;

    if (!opts.force && monthCache.has(cacheKey)) {
      routineLocked = false;
      routineAvailableAt = null;
      clearGateTimer();
      if (downloadRoutineBtn) downloadRoutineBtn.disabled = false;
      renderMonth(monthCache.get(cacheKey));
      return;
    }

    const { data: json, error } = await rpcMonthContent(monthNumber, currentObjective);
    if (error) {
      if (monthContent) monthContent.innerHTML = `<div class="error">${esc(error.message)}</div>`;
      return;
    }

    if (json?.locked) {
      routineLocked = true;
      routineAvailableAt = json.available_at || null;
      if (downloadRoutineBtn) downloadRoutineBtn.disabled = true;
      clearGateTimer();
      scheduleGateRefresh(routineAvailableAt);
      renderRoutineLockedNotice(routineAvailableAt);
      return;
    }

    routineLocked = false;
    routineAvailableAt = null;
    clearGateTimer();
    if (downloadRoutineBtn) downloadRoutineBtn.disabled = false;

    monthCache.set(cacheKey, json);
    renderMonth(json);
  }

  // =====================================================
  // Video modal
  // =====================================================
  function ytEmbedUrl(url) {
    if (!url) return "";
    const raw = String(url).trim();
    if (raw.includes("/embed/")) return raw.replace("www.youtube.com","www.youtube-nocookie.com");

    try {
      const u = new URL(raw);
      if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.split("/").filter(Boolean)[0];
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
      }
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
      }
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
    } catch (_) {}

    const match = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (match?.[1]) return `https://www.youtube-nocookie.com/embed/${match[1]}`;
    return "";
  }

  function openVideoModal(url, title) {
    if (!videoModal || !videoModalBackdrop || !videoModalFrame) return;

    const embed = ytEmbedUrl(url);
    if (!embed) return;

    const wrap = videoModal.querySelector(".video-wrap");
    const isShort = /\/shorts\//i.test(String(url));
    wrap?.classList.toggle("is-vertical", isShort);
    wrap?.classList.toggle("is-horizontal", !isShort);

    if (videoModalTitle) videoModalTitle.textContent = title || "Video";

    videoModal.classList.add("is-open");
    videoModalBackdrop.classList.add("is-open");
    videoModal.setAttribute("aria-hidden","false");
    videoModalBackdrop.setAttribute("aria-hidden","false");

    videoModalFrame.src = "about:blank";
    requestAnimationFrame(() => {
      videoModalFrame.src = `${embed}?autoplay=0&controls=1&rel=0&playsinline=1&modestbranding=1`;
    });
  }

  function closeVideoModal() {
    if (!videoModal || !videoModalBackdrop || !videoModalFrame) return;
    videoModal.classList.remove("is-open");
    videoModalBackdrop.classList.remove("is-open");
    videoModal.setAttribute("aria-hidden","true");
    videoModalBackdrop.setAttribute("aria-hidden","true");
    videoModalFrame.src = "about:blank";
  }

  videoModalBackdrop?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeVideoModal(); });
  videoModalClose?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeVideoModal(); });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-video-url]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openVideoModal(btn.getAttribute("data-video-url"), btn.getAttribute("data-video-title") || "Video");
  }, true);

  // =====================================================
  // Clases / grabadas
  // =====================================================
  function resolveCoverUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;

    const candidates = raw.includes("/") ? [raw] : [`covers/${raw}`, raw];
    for (const key of candidates) {
      const pub = sb.storage.from("class_covers").getPublicUrl(key);
      const url = pub?.data?.publicUrl || "";
      if (url) return url;
    }
    return "";
  }

  async function loadClasses() {
    if (!classesList || !classesMsg) return;

    classesList.innerHTML = "";
    clearText(classesMsg);

    if (!canSeePremiumContent()) {
      setNotice(classesMsg, "Las clases están disponibles solo para el Plan Premium/Pro.", "notice small");
      return;
    }

    classesMsg.textContent = "Cargando clases…";

    const nowIso = new Date().toISOString();
    const { data, error } = await sb
      .from("live_classes")
      .select("id,title,topic,starts_at,zoom_join_url,zoom_passcode,cover_url")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(10);

    if (error) { setNotice(classesMsg, error.message, "error"); return; }
    if (!data?.length) { setNotice(classesMsg, "Todavía no hay clases en vivo programadas.", "notice small"); return; }

    clearText(classesMsg);

    classesList.innerHTML = data.map((item) => {
      const when = item.starts_at ? formatDateTimeShort(item.starts_at) : "";
      const cover = resolveCoverUrl(item.cover_url);
      const pass = String(item.zoom_passcode || "").trim();

      const actionBtn = item.zoom_join_url
        ? `<a class="btn primary" target="_blank" rel="noopener" href="${esc(item.zoom_join_url)}">Entrar</a>`
        : `<span class="small">Sin link</span>`;

      return `
        <div class="item" style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between">
          <div style="display:flex;gap:12px;align-items:flex-start;min-width:0">
            ${cover ? `<img src="${esc(cover)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:12px" loading="lazy">` : ""}
            <div style="min-width:0">
              <div><b>${esc(item.title || "Clase")}</b></div>
              ${when ? `<div class="small">${esc(when)} (AR)</div>` : ""}
              ${item.topic ? `<div class="small" style="opacity:.9">${esc(item.topic)}</div>` : ""}
              ${pass ? `<div class="small" style="opacity:.9">Código: <b>${esc(pass)}</b></div>` : ""}
              <div style="margin-top:10px">${actionBtn}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function getRecordedDate(item) {
    const raw = item.class_date || item.recorded_at || item.starts_at || item.created_at || null;
    const d = raw ? new Date(raw) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  function groupRecordedByYearMonth(items) {
    const grouped = {};
    for (const item of items) {
      const d = getRecordedDate(item);
      const year = d.getFullYear();
      const month = d.getMonth();
      grouped[year] ||= {};
      grouped[year][month] ||= [];
      grouped[year][month].push(item);
    }
    return grouped;
  }

  function buildRecordedVideoCard(item) {
    const coverSrc = resolveCoverUrl(item.cover_url);
    const thumb = coverSrc || "./imagenes/Isotipo.png";
    const title = item.title || "Clase grabada";
    const when = formatDateEs(item.class_date);
    const meta = [item.topic ? item.topic : "", when].filter(Boolean).join(" · ");

    const action = item.youtube_url
      ? `<button class="btn primary" type="button" data-video-url="${esc(item.youtube_url)}" data-video-title="${esc(title)}">Ver clase</button>`
      : `<span class="small">Sin video</span>`;

    return `
      <div class="lib-video">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1 1 260px;">
            <img class="lib-video-thumb" src="${esc(thumb)}" alt="${esc(title)}" loading="lazy" onerror="this.src='./imagenes/Isotipo.png'">
            <div style="min-width:0;">
              <div class="lib-video-title">${esc(title)}</div>
              ${meta ? `<div class="lib-video-meta">${esc(meta)}</div>` : ""}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${action}
          </div>
        </div>
      </div>
    `;
  }

  function renderRecordedLibrary(items) {
    if (!recordedList) return;
    recordedList.innerHTML = "";

    if (!items?.length) {
      setNotice(recordedMsg, "Todavía no hay clases grabadas publicadas.", "notice small");
      return;
    }

    clearText(recordedMsg);

    const grouped = groupRecordedByYearMonth(items);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();

    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

    recordedList.innerHTML = years.map((year) => {
      const months = Object.keys(grouped[year]).map(Number).sort((a, b) => b - a);
      return `
        <details class="lib-year" ${year === currentYear ? "open" : ""}>
          <summary>${year}</summary>
          ${months.map((monthIndex) => `
            <details class="lib-month" ${(year === currentYear && monthIndex === currentMonthIndex) ? "open" : ""}>
              <summary>${monthNameEs(monthIndex)}</summary>
              <div class="lib-items">${grouped[year][monthIndex].map(buildRecordedVideoCard).join("")}</div>
            </details>
          `).join("")}
        </details>
      `;
    }).join("");
  }

  async function loadRecordedClasses() {
    if (!recordedList || !recordedMsg) return;

    recordedList.innerHTML = "";
    clearText(recordedMsg);

    if (!canSeePremiumContent()) {
      setNotice(recordedMsg, "Las clases grabadas están disponibles solo para el Plan Premium/Pro.", "notice small");
      return;
    }

    recordedMsg.textContent = "Cargando clases grabadas…";

    const { data, error } = await sb
      .from("recorded_classes")
      .select("id, class_date, title, topic, youtube_url, cover_url")
      .order("class_date", { ascending: false })
      .limit(120);

    if (error) { setNotice(recordedMsg, error.message, "error"); return; }
    renderRecordedLibrary(data || []);
  }

  // =====================================================
  // Descargar rutina (HTML)
  // =====================================================
  async function getMonthJsonForDownload(monthNumber, objective) {
    const key = `${monthNumber}-${objective}-${currentTrack}`;
    if (monthCache.has(key)) return monthCache.get(key);

    const { data, error } = await rpcMonthContent(monthNumber, objective);
    if (error) throw error;
    if (data?.locked) throw new Error("Tu rutina todavía está en preparación.");

    monthCache.set(key, data);
    return data;
  }

  function buildRoutineHTML({ json, monthNumber, objective, track }) {
    const gen = new Date();
    const title = `Rutina ${monthLabel(monthNumber)} — ${objective} — ${labelTrack(track)}`;
    const weeks = Array.isArray(json?.weeks) ? json.weeks : [];

    const body = weeks.map((week) => {
      const days = Array.isArray(week.days) ? week.days : [];
      return `
        <section class="week">
          <h2>Semana ${esc(week.week_number)}</h2>
          ${days.map((day) => {
            const items = track === "gym" ? (day.items_gym || []) : (day.items_home || []);
            const rows = items.map((it) => `
              <tr>
                <td>${esc(it.exercise || "")}</td>
                <td style="width:70px;text-align:center">${esc(it.sets || "")}</td>
                <td style="width:70px;text-align:center">${esc(it.reps || "")}</td>
                <td>${esc(it.notes || "")}</td>
              </tr>
            `).join("");

            return `
              <section class="day">
                <h3>Día ${esc(day.day_number)}</h3>
                ${items.length ? `
                  <table>
                    <thead><tr><th>Ejercicio</th><th>Series</th><th>Reps</th><th>Notas</th></tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                ` : `<div class="muted">Sin ejercicios cargados.</div>`}
              </section>
            `;
          }).join("")}
        </section>
      `;
    }).join("") || `<div class="muted">Este mes no tiene contenido cargado.</div>`;

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<style>
body{ font-family: system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif; margin:0; color:#111; background:#fff; }
.page{ max-width: 920px; margin: 0 auto; padding: 26px; }
h1{ font-size: 18px; margin: 0 0 6px; }
h2{ margin: 18px 0 10px; font-size: 14px; }
h3{ margin: 14px 0 6px; font-size: 13px; }
.muted{ font-size: 12px; color:#666; }
.day{ padding: 10px 0 8px; border-top: 1px solid #efefef; }
table{ width:100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #e7e7e7; border-radius: 10px; overflow: hidden; }
th, td{ border-bottom: 1px solid #ededed; padding: 10px 10px; font-size: 12px; vertical-align: top; }
th{ background:#fafafa; text-align:left; font-weight: 700; }
tr:last-child td{ border-bottom: none; }
</style>
</head>
<body>
  <div class="page">
    <h1>${esc(title)}</h1>
    <div class="muted">Generado: ${esc(gen.toLocaleString("es-AR"))}</div>
    ${body}
    <div class="muted" style="margin-top:16px;border-top:1px solid #eee;padding-top:10px">
      Nota: Los videos y explicaciones están dentro del campus.
    </div>
  </div>
</body>
</html>`;
  }

  async function downloadRoutine() {
    try {
      if (!currentMonth) { alert("Primero cargá un mes."); return; }
      if (routineLocked) { alert("Tu rutina todavía está en preparación."); return; }

      const json = await getMonthJsonForDownload(currentMonth, currentObjective);
      const html = buildRoutineHTML({ json, monthNumber: currentMonth, objective: currentObjective, track: currentTrack });

      const fileBase = filenameSafe(`rutina_${monthLabel(currentMonth)}_${currentObjective}_${currentTrack}`);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[A360] downloadRoutine:", e);
      alert(e?.message || String(e));
    }
  }

  downloadRoutineBtn?.addEventListener("click", downloadRoutine);

  // =====================================================
  // Perfil
  // =====================================================
  function setProfileMsg(text, kind = "small") {
    if (!profileMsg) return;
    profileMsg.className = kind;
    profileMsg.textContent = text || "";
  }
  function setDeleteAccountMsg(text, kind = "small") {
    if (!deleteAccountMsg) return;
    deleteAccountMsg.className = kind;
    deleteAccountMsg.textContent = text || "";
  }
  function openProfile(open) {
    if (!profilePanel) return;
    profilePanel.style.display = open ? "block" : "none";
    if (!open) { setProfileMsg(""); setDeleteAccountMsg(""); }
  }

  function syncProfileAccountUI() {
    if (profileEmail) profileEmail.textContent = userEmail?.textContent || "";

    const planName = planInfo?.plans?.name || "Plan";
    const status = planInfo?.status || "—";
    const paid = planInfo?.paid_through || null;

    if (profilePlanLine) profilePlanLine.textContent = `${planName} · ${status}`;
    if (profilePaidLine) profilePaidLine.textContent = `Pago hasta: ${formatPaidThrough(paid)}`;

    if (!profileUpgradeBox) return;
    const slug = norm(planSlug);
    const show = slug === "basic" || slug === "mid";
    profileUpgradeBox.style.display = show ? "block" : "none";
    if (profileUpgradeMidBtn) profileUpgradeMidBtn.style.display = slug === "basic" ? "inline-flex" : "none";
    if (profileUpgradeProBtn) profileUpgradeProBtn.style.display = show ? "inline-flex" : "none";
    if (profileUpgradeMidBtn) profileUpgradeMidBtn.textContent = "Pasar a Intermedio";
    if (profileUpgradeProBtn) profileUpgradeProBtn.textContent = "Pasar a Premium";
  }

  async function loadMyProfile() {
    const { data: userRes } = await sb.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return;

    const { data: profile, error } = await sb
      .from("profiles")
      .select("full_name, phone, age, weight_kg, height_cm, training_level")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) { setProfileMsg(error.message, "error"); return; }

    if (pfFullName) pfFullName.value = profile?.full_name ?? "";
    if (pfPhone) pfPhone.value = profile?.phone ?? "";
    if (pfAge) pfAge.value = profile?.age == null ? "" : String(profile.age);
    if (pfWeight) pfWeight.value = profile?.weight_kg == null ? "" : String(profile.weight_kg);
    if (pfHeight) pfHeight.value = profile?.height_cm == null ? "" : String(profile.height_cm);
    if (pfLevel) pfLevel.value = profile?.training_level ?? "";
  }

  async function saveMyProfile() {
    const { data: userRes } = await sb.auth.getUser();
    const uid = userRes?.user?.id;
    const email = userRes?.user?.email;
    if (!uid || !email) return;

    setProfileMsg("Guardando…", "small");

    const payload = {
      user_id: uid,
      email,
      full_name: (pfFullName?.value || "").trim() || null,
      phone: (pfPhone?.value || "").trim() || null,
      age: pfAge?.value ? Number(pfAge.value) : null,
      weight_kg: pfWeight?.value ? Number(pfWeight.value) : null,
      height_cm: pfHeight?.value ? Number(pfHeight.value) : null,
      training_level: (pfLevel?.value || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from("profiles").upsert(payload, { onConflict: "user_id" });
    if (error) { setProfileMsg(error.message, "error"); return; }

    setProfileMsg("Guardado ✅", "notice");
  }

  profileBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    openProfile(true);
    syncProfileAccountUI();
    await loadMyProfile();
  });

  profileCloseBtn?.addEventListener("click", () => openProfile(false));
  profileSaveBtn?.addEventListener("click", saveMyProfile);

  profileUpgradeMidBtn?.addEventListener("click", () => startCheckout("mid"));
  profileUpgradeProBtn?.addEventListener("click", () => startCheckout("pro"));

  async function deleteMyAccount() {
    try {
      if (deleteAccountBtn) deleteAccountBtn.disabled = true;
      setDeleteAccountMsg("", "small");

      const { data: sessRes } = await sb.auth.getSession();
      const session = sessRes?.session;
      const token = session?.access_token;
      const email = session?.user?.email || "";

      if (!token || !email) { alert("Tu sesión expiró. Volvé a iniciar sesión."); return; }

      const ok = confirm("Vas a ELIMINAR tu cuenta.\n\nEsto es irreversible.\n\n¿Querés continuar?");
      if (!ok) return;

      const typed = (prompt(`Para confirmar, escribí tu email:\n${email}`) || "").trim();
      if (norm(typed) !== norm(email)) { alert("El email no coincide. Operación cancelada."); return; }

      setDeleteAccountMsg("Eliminando…", "small");

      const res = await sb.functions.invoke("delete-account", {
        body: { confirm_email: typed },
        headers: { Authorization: `Bearer ${token}` },
      });

      const { data, error } = res;
      if (error) { setDeleteAccountMsg(error.message || "Error al eliminar.", "error"); return; }
      if (!data?.ok) { setDeleteAccountMsg("No se pudo completar la eliminación.", "error"); return; }

      setDeleteAccountMsg("Cuenta eliminada ✅", "notice");

      try { await sb.auth.signOut(); } catch (_) {}
      window.location.href = "./index.html";
    } catch (e) {
      console.error("[A360] deleteMyAccount:", e);
      alert(e?.message || String(e));
      setDeleteAccountMsg("", "small");
    } finally {
      if (deleteAccountBtn) deleteAccountBtn.disabled = false;
    }
  }

  deleteAccountBtn?.addEventListener("click", deleteMyAccount);

  // =====================================================
  // Init
  // =====================================================
  async function getPublishedMonthNumber() {
    const nowIso = new Date().toISOString();
    const { data, error } = await sb
      .from("month_release")
      .select("month_number, release_at")
      .eq("is_published", true)
      .lte("release_at", nowIso)
      .order("release_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    const m = Number(data?.[0]?.month_number || 0);
    return m || (new Date().getMonth() + 1);
  }
    // =====================================================
  // Post-MercadoPago: wait for webhook to activate plan
  // =====================================================
  function getUrlParam(name) {
    try { return new URLSearchParams(window.location.search).get(name); }
    catch (_) { return null; }
  }

  async function waitForActivePlan({ timeoutMs = 30000, intervalMs = 1500 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      await loadPlanBadge(); // refresca planInfo/planSlug
      if (planInfo && norm(planInfo.status) === "active") return true;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  function renderConfirmingPaymentUI() {
    if (monthTitle) monthTitle.textContent = "Confirmando tu pago…";
    if (!monthContent) return;

    monthContent.innerHTML = `
      <div class="notice">
        <b>Estamos confirmando tu pago ✅</b><br><br>
        Esto puede demorar unos segundos. No cierres esta pantalla.
        <br><br>
        <div class="small" style="opacity:.8">Si en 30 segundos no se activa, tocá “Reintentar”.</div>
        <br><br>
        <button class="btn primary" id="mpRetryBtn" type="button">Reintentar</button>
        <button class="btn" id="mpBackBtn" type="button" style="margin-left:8px">Volver a planes</button>
      </div>
    `;

    const retry = document.getElementById("mpRetryBtn");
    retry?.addEventListener("click", async () => {
      retry.disabled = true;
      const ok = await waitForActivePlan({ timeoutMs: 30000, intervalMs: 1500 });
      if (ok) window.location.replace("./app.html"); // limpia el querystring
      else {
        retry.disabled = false;
        alert("Todavía no se confirmó el pago. Reintentá en unos segundos.");
      }
    });

    const back = document.getElementById("mpBackBtn");
    back?.addEventListener("click", () => {
      window.location.href = "./index.html#planes";
    });
  }

  (async function init() {
    syncHeaderUI();

    const session = await requireAuth();
    if (!session) return;

    if (userEmail) userEmail.textContent = session.user.email;

    // paralelo
    const adminP = maybeShowAdminLink();
    const planP = loadPlanBadge();
    const prefsP = loadUserPreferences();
    const quoteP = loadWeeklyQuoteIntoApp();

    await Promise.all([adminP, planP]);

        // ✅ Si vuelve de MercadoPago, esperá a que el webhook impacte en user_plan
    const fromMp = norm(getUrlParam("from")) === "mp";
    if (fromMp && (!planInfo || norm(planInfo.status) !== "active")) {
      renderConfirmingPaymentUI();

      const ok = await waitForActivePlan({ timeoutMs: 30000, intervalMs: 1500 });
      if (ok) {
        // ✅ limpia ?from=mp y re-carga flujo normal ya con plan activo
        window.location.replace("./app.html");
        return;
      }
      // Si no se activó, continúa y caerá en el gate normal ("Acceso pendiente")
    }


    // Gate por plan activo
    if (!planInfo || norm(planInfo.status) !== "active") {
      if (monthTitle) monthTitle.textContent = "Acceso pendiente";
      if (monthContent) {
        monthContent.innerHTML = `
          <div class="notice">
            <b>Tu cuenta todavía no tiene una suscripción activa.</b><br><br>
            Para ver tu rutina y contenidos, completá el pago.
            <br><br>
            <a class="btn primary" href="./index.html#planes">Ver planes</a>
          </div>
        `;
      }
      if (classesList) classesList.innerHTML = "";
      if (recordedList) recordedList.innerHTML = "";
      if (classesMsg) setNotice(classesMsg, "Disponible con suscripción activa.", "notice small");
      if (recordedMsg) setNotice(recordedMsg, "Disponible con suscripción activa.", "notice small");

      syncUpgradeUI(planSlug);
      syncProfileAccountUI();
      syncHelpWhatsappUI();

      await quoteP;

      // cortar polling/toast por las dudas
      try { document.getElementById("a360Toast")?.remove(); } catch (_) {}
      if (repliesPollTimer) { clearInterval(repliesPollTimer); repliesPollTimer = null; }
      lastToastKey = "";

      return;
    }

    syncUpgradeUI(planSlug);
    syncProfileAccountUI();
    syncHelpWhatsappUI();

    const prefs = await prefsP;
    currentObjective = prefs.objective;
    currentTrack = prefs.track;
    syncTrackUI();

    const publishedMonth = await getPublishedMonthNumber();
    await openMonth(publishedMonth, { force: true });

    await Promise.all([loadClasses(), loadRecordedClasses(), quoteP]);

    // ✅ Replies/toast SOLO si puede usar comentarios (mid/pro)
    if (canUseComments()) {
      await loadUnseenReplySummary(session.user.id).catch(() => {});
      if (!repliesPollTimer) {
        repliesPollTimer = setInterval(() => {
          loadUnseenReplySummary(session.user.id).catch(() => {});
        }, 60_000);
      }
    } else {
      try { document.getElementById("a360Toast")?.remove(); } catch (_) {}
      if (repliesPollTimer) { clearInterval(repliesPollTimer); repliesPollTimer = null; }
      lastToastKey = "";
    }

    console.log("[A360] Ready ✅");
  })();
})();