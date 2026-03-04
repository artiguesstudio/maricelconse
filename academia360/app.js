// app.js — limpio (con comentarios por día + UX mejorada)
// Rutinas + gate + clases en vivo + biblioteca grabadas + descarga + perfil + comentarios a coach
(() => {
  "use strict";

  console.log("[A360] app.js cargó ✅", new Date().toISOString());

  // =====================================================
  // Guard rails
  // =====================================================
  const sb = window.sb;
  const A360 = window.A360Auth || {};
  const requireAuth = A360.requireAuthOrRedirect;

  if (!sb) {
    console.error("[A360] sb no existe. Revisa el orden de scripts.");
    return;
  }
  if (!requireAuth) {
    console.error("[A360] A360Auth.requireAuthOrRedirect no existe. Revisa auth.js.");
    return;
  }

  // =====================================================
  // Constantes / helpers base
  // =====================================================
  const AR_TZ = "America/Argentina/Buenos_Aires";
  const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const MP_FALLBACK_URL = {
    basic: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=a744205529154c91bdfe7811443a9e41",
    mid:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=b003ccd51f3d49c59d3daf76315bb9d6",
    pro:   "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=4e5b56a866274858ad36638487349115",
  };

  function norm(v) { return String(v ?? "").trim().toLowerCase(); }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  function monthLabel(n) { return MONTHS_ES[n - 1] || "Mes"; }
  function monthNameEs(monthIndex) { return MONTHS_ES[monthIndex] || "Mes"; }

  function labelTrack(track) { return track === "gym" ? "Gimnasio" : track === "both" ? "Ambos" : "Casa"; }
  function objectiveLabel(objective) { return objective === "muscle_gain" ? "Ganar masa muscular" : "Perder peso"; }

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
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  }

  function formatDateTimeEs(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const date = new Intl.DateTimeFormat("es-AR", {
      timeZone: AR_TZ, day: "2-digit", month: "2-digit", year: "numeric",
    }).format(d);

    const time = new Intl.DateTimeFormat("es-AR", {
      timeZone: AR_TZ, hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23",
    }).format(d);

    return `${date}, ${time}hs`;
  }

  function formatDateTimeShort(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const date = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, day: "2-digit", month: "2-digit" }).format(d);
    const time = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" }).format(d);
    return `${date} ${time}hs`;
  }

  function formatPaidThrough(value) {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
    } catch (_) {
      return String(value);
    }
  }

  function filenameSafe(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function firstNameFromEmail(email) {
    const left = String(email || "").split("@")[0] || "Bienvenida";
    const clean = left.replace(/[._-]+/g, " ").trim();
    const first = clean.split(" ").filter(Boolean)[0] || "Bienvenida";
    return first.charAt(0).toUpperCase() + first.slice(1);
  }

  function firstNameFromFullName(fullName, fallbackEmail) {
    const raw = String(fullName || "").trim();
    if (!raw) return firstNameFromEmail(fallbackEmail);
    const first = raw.split(/\s+/)[0] || "";
    return first.charAt(0).toUpperCase() + first.slice(1);
  }

  function normalizeTrack(v) {
    const raw = norm(v);
    if (raw === "gym" || raw === "gimnasio") return "gym";
    if (raw === "home" || raw === "casa") return "home";
    if (raw === "both" || raw === "ambos") return "both";
    return null;
  }

  // =====================================================
  // DOM
  // =====================================================
  const siteHeader = document.getElementById("siteHeader");
  const yearEl = document.getElementById("year");

  const monthTitle = document.getElementById("monthTitle");
  const monthContent = document.getElementById("monthContent");
  const userEmail = document.getElementById("userEmail");
  const planBadge = document.getElementById("planBadge");
  const adminLink = document.getElementById("adminLink");
  const trackHint = document.getElementById("trackHint");

  const downloadRoutineBtn = document.getElementById("downloadRoutineBtn");

  // Objetivo (queda oculto/lockeado)
  const editObjectiveBtn = document.getElementById("editObjectiveBtn");
  const objectivePanel = document.getElementById("objectivePanel");
  const objectiveSel = document.getElementById("objectiveSel");
  const saveObjectiveBtn = document.getElementById("saveObjectiveBtn");
  const cancelObjectiveBtn = document.getElementById("cancelObjectiveBtn");
  const objectiveMsg = document.getElementById("objectiveMsg");

  // Clases
  const classesMsg = document.getElementById("classesMsg");
  const classesList = document.getElementById("classesList");
  const recordedMsg = document.getElementById("recordedMsg");
  const recordedList = document.getElementById("recordedList");

  const helpWhatsappBox = document.getElementById("helpWhatsappBox");

  // Upgrade panel principal
  const upgradeBox = document.getElementById("upgradeBox");
  const upgradeMidBtn = document.getElementById("upgradeMidBtn");
  const upgradeProBtn = document.getElementById("upgradeProBtn");

  // Video modal
  const videoModal = document.getElementById("videoModal");
  const videoModalBackdrop = document.getElementById("videoModalBackdrop");
  const videoModalClose = document.getElementById("videoModalClose");
  const videoModalFrame = document.getElementById("videoModalFrame");
  const videoModalTitle = document.getElementById("videoModalTitle");

  // Comment modal
  const commentModal = document.getElementById("commentModal");
  const commentModalBackdrop = document.getElementById("commentModalBackdrop");
  const commentModalClose = document.getElementById("commentModalClose");
  const commentModalSend = document.getElementById("commentModalSend");
  const commentModalText = document.getElementById("commentModalText");
  const commentModalTitle = document.getElementById("commentModalTitle");
  const commentModalMsg = document.getElementById("commentModalMsg");

  // Mi perfil
  const profileBtn = document.getElementById("profileBtn");
  const profilePanel = document.getElementById("profilePanel");
  const profileCloseBtn = document.getElementById("profileCloseBtn");
  const profileEmail = document.getElementById("profileEmail");

  const profilePlanLine = document.getElementById("profilePlanLine");
  const profilePaidLine = document.getElementById("profilePaidLine");

  const profileUpgradeBox = document.getElementById("profileUpgradeBox");
  const profileUpgradeMidBtn = document.getElementById("profileUpgradeMidBtn");
  const profileUpgradeProBtn = document.getElementById("profileUpgradeProBtn");

  const pfFullName = document.getElementById("pfFullName");
  const pfPhone = document.getElementById("pfPhone");
  const pfAge = document.getElementById("pfAge");
  const pfWeight = document.getElementById("pfWeight");
  const pfHeight = document.getElementById("pfHeight");
  const pfLevel = document.getElementById("pfLevel");

  const profileSaveBtn = document.getElementById("profileSaveBtn");
  const profileMsg = document.getElementById("profileMsg");
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  const deleteAccountMsg = document.getElementById("deleteAccountMsg");

  // Weekly quote
  const weeklyQuoteTitleEl = document.getElementById("weeklyQuoteTitle");
  const weeklyQuotePhraseEl = document.getElementById("weeklyQuotePhrase");
  const weeklyQuoteImgEl = document.getElementById("weeklyQuoteImg");

  // =====================================================
  // State
  // =====================================================
  let currentObjective = "fat_loss";
  let currentTrack = "gym";

  let planSlug = null;
  let planInfo = null;

  let currentMonth = null;
  let nextLiveClass = null;

  let campusFirstName = "";
  let campusEmailCache = "";

  const monthCache = new Map();

  // Gate rutina
  let routineLocked = false;
  let routineAvailableAt = null;
  let gateRefreshTimer = null;

  // Routine delivery info
  let routineReadyAt = null;
  let routineNotifiedAt = null;

  // Comentarios modal context
  let commentCtx = null;

  // Cache resolver day_id
  const dayIdCache = new Map(); // key = `${month}:${week}:${day}` => uuid

  // =====================================================
  // Gate helpers (rutina en preparación)
  // =====================================================
  function clearGateTimer() {
    if (gateRefreshTimer) {
      clearTimeout(gateRefreshTimer);
      gateRefreshTimer = null;
    }
  }

  function scheduleGateRefresh(availableAt) {
    clearGateTimer();
    if (!availableAt) return;

    const d = new Date(availableAt);
    if (Number.isNaN(d.getTime())) return;

    const ms = d.getTime() - Date.now() + 15_000;
    if (ms <= 0 || ms > 1000 * 60 * 60 * 50) return;

    gateRefreshTimer = setTimeout(() => {
      if (currentMonth) openMonth(currentMonth, { force: true });
    }, ms);
  }

  function renderRoutineLockedNotice(availableAt) {
    const when = availableAt ? formatDateTimeEs(availableAt) : "";
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

  function showToast(message) {
    const existing = document.getElementById("a360Toast");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.id = "a360Toast";
    wrap.style.cssText = `
      position:fixed; left:12px; right:12px; bottom:14px; z-index:9999;
      background:rgba(255,255,255,.95); border:1px solid rgba(0,0,0,.10);
      border-radius:14px; padding:12px 12px; box-shadow:0 14px 40px rgba(0,0,0,.14);
      max-width:720px; margin:0 auto; display:flex; gap:10px; align-items:flex-start;
    `;

    const txt = document.createElement("div");
    txt.style.cssText = "flex:1; font-size:14px; line-height:1.35; color:#111;";
    txt.textContent = message;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.textContent = "OK";
    btn.addEventListener("click", () => wrap.remove());

    wrap.appendChild(txt);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    setTimeout(() => { try { wrap.remove(); } catch (_) {} }, 12000);
  }

  async function loadRoutineDeliveryStatus(userId) {
    routineReadyAt = null;
    routineNotifiedAt = null;
    if (!userId) return;

    const { data, error } = await sb
      .from("routine_delivery")
      .select("paid_at, available_at, ready_at, notified_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return;

    routineReadyAt = data.ready_at || null;
    routineNotifiedAt = data.notified_at || null;

    if (routineNotifiedAt) {
      const key = `A360_ROUTINE_READY_SEEN_${routineNotifiedAt}`;
      const seen = localStorage.getItem(key);
      if (!seen) {
        showToast("✅ Ya está lista tu rutina 100% personalizada. Entrá en “Rutina” para verla.");
        localStorage.setItem(key, "1");
      }
    }
  }

  // =====================================================
  // Accesos por plan
  // =====================================================
  function isPlanActive() { return norm(planInfo?.status) === "active"; }

  function canSeePremiumContent() {
    return isPlanActive() && ["pro", "premium"].includes(norm(planSlug));
  }

  function canSeeWhatsappHelp() {
    return isPlanActive() && ["mid", "pro"].includes(norm(planSlug));
  }

  function syncHelpWhatsappUI() {
    if (!helpWhatsappBox) return;
    helpWhatsappBox.style.display = canSeeWhatsappHelp() ? "block" : "none";
  }

  // =====================================================
  // Header UI
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

  // =====================================================
  // Perfil / identidad
  // =====================================================
  async function loadCampusIdentity() {
    try {
      const { data: userRes } = await sb.auth.getUser();
      const uid = userRes?.user?.id;
      const email = userRes?.user?.email || campusEmailCache || "";
      campusEmailCache = email;

      if (!uid) {
        campusFirstName = firstNameFromEmail(email);
        return;
      }

      const { data, error } = await sb.from("profiles").select("full_name").eq("user_id", uid).maybeSingle();
      if (error) {
        campusFirstName = firstNameFromEmail(email);
        return;
      }

      campusFirstName = firstNameFromFullName(data?.full_name, email);
    } catch (_) {
      campusFirstName = firstNameFromEmail(campusEmailCache);
    }
  }

  function syncTrackUI() {
    if (trackHint) trackHint.textContent = labelTrack(currentTrack);
  }

  function lockRoutineToStudentPreferencesUI() {
    if (editObjectiveBtn) editObjectiveBtn.style.display = "none";
    if (objectivePanel) objectivePanel.style.display = "none";
    if (objectiveSel) objectiveSel.disabled = true;
    if (saveObjectiveBtn) saveObjectiveBtn.disabled = true;
    if (cancelObjectiveBtn) cancelObjectiveBtn.disabled = true;
    if (objectiveMsg) { objectiveMsg.className = "small"; objectiveMsg.textContent = ""; }
  }

  // =====================================================
  // Nav actions
  // =====================================================
  document.addEventListener("click", async (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.getAttribute("data-action");
    if (!action) return;

    e.preventDefault();

    if (action === "logout") await doLogout();
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
        .select("id,title,phrase,image_url,updated_at")
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
      console.error("[APP] weekly_quote load error:", e);
    }
  }

  // =====================================================
  // Preferencias usuario (objective/track)
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

  // =====================================================
  // Mes publicado (month_release)
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
  // Plan badge
  // =====================================================
  async function loadPlanBadge() {
    const { data: userRes } = await sb.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return null;

    const { data: row, error } = await sb
      .from("user_plan")
      .select("status, paid_through, plan_id, plans:plan_id (slug,name)")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      planInfo = null;
      planSlug = null;
      if (planBadge) planBadge.style.display = "none";
      return null;
    }

    if (!row) {
      planInfo = null;
      planSlug = null;
      if (planBadge) {
        planBadge.style.display = "inline-flex";
        planBadge.textContent = "Plan · pendiente de pago";
      }
      return null;
    }

    // Fallback si embed plans viene null
    if (!row.plans?.slug && row.plan_id) {
      const { data: pRow } = await sb.from("plans").select("slug,name").eq("id", row.plan_id).maybeSingle();
      row.plans = pRow || row.plans;
    }

    planInfo = row;

    const statusNorm = norm(row.status);
    const slugNorm = norm(row.plans?.slug);

    planSlug = statusNorm === "active" ? (slugNorm || null) : null;

    if (planBadge) {
      planBadge.style.display = "inline-flex";
      planBadge.textContent = `${row.plans?.name ?? "Plan"} · ${row.status ?? "—"}`;
    }

    return row;
  }

  // =====================================================
  // Upgrade UI + checkout
  // =====================================================
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
      // refresco para evitar JWT inválido
      const { data: refreshRes } = await sb.auth.refreshSession();
      const session = refreshRes?.session;

      if (!session?.access_token) {
        window.location.href = "./login.html";
        return;
      }

      const { data, error } = await sb.functions.invoke("mp-checkout", {
        body: { plan_slug: targetSlug },
        headers: { authorization: `Bearer ${session.access_token}` },
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
  // Video modal
  // =====================================================
  function ytEmbedUrl(url) {
    if (!url) return "";
    const raw = String(url).trim();

    if (raw.includes("/embed/")) {
      return raw.replace("www.youtube.com", "www.youtube-nocookie.com");
    }

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

    const params = "autoplay=0&controls=1&rel=0&playsinline=1&modestbranding=1";

    videoModal.classList.add("is-open");
    videoModalBackdrop.classList.add("is-open");
    videoModal.setAttribute("aria-hidden", "false");
    videoModalBackdrop.setAttribute("aria-hidden", "false");

    videoModalFrame.src = "about:blank";
    requestAnimationFrame(() => {
      videoModalFrame.src = `${embed}?${params}`;
    });
  }

  function closeVideoModal() {
    if (!videoModal || !videoModalBackdrop || !videoModalFrame) return;

    videoModal.classList.remove("is-open");
    videoModalBackdrop.classList.remove("is-open");
    videoModal.setAttribute("aria-hidden", "true");
    videoModalBackdrop.setAttribute("aria-hidden", "true");
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
  // Comentarios modal (rutina)
  // =====================================================
  function setCommentMsg(text, kind = "small") {
    if (!commentModalMsg) return;
    commentModalMsg.className = kind;
    commentModalMsg.textContent = text || "";
  }

  function openCommentModal(ctx) {
    if (!commentModal || !commentModalBackdrop) return;
    commentCtx = ctx || null;

    if (commentModalTitle) {
      const title = ctx?.title || "Agregar comentario";
      commentModalTitle.textContent = title;
    }

    if (commentModalText) commentModalText.value = "";
    setCommentMsg("");

    commentModal.classList.add("is-open");
    commentModalBackdrop.classList.add("is-open");
    commentModal.setAttribute("aria-hidden", "false");
    commentModalBackdrop.setAttribute("aria-hidden", "false");

    setTimeout(() => commentModalText?.focus?.(), 20);
  }

  function closeCommentModal() {
    if (!commentModal || !commentModalBackdrop) return;
    commentModal.classList.remove("is-open");
    commentModalBackdrop.classList.remove("is-open");
    commentModal.setAttribute("aria-hidden", "true");
    commentModalBackdrop.setAttribute("aria-hidden", "true");
    commentCtx = null;
    setCommentMsg("");
  }

  commentModalBackdrop?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeCommentModal(); });
  commentModalClose?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeCommentModal(); });

  async function resolveDayId(monthNumber, weekNumber, dayNumber) {
    const key = `${monthNumber}:${weekNumber}:${dayNumber}`;
    if (dayIdCache.has(key)) return dayIdCache.get(key);

    // 1) weeks -> week_id
    const { data: w, error: wErr } = await sb
      .from("weeks")
      .select("id")
      .eq("month_number", monthNumber)
      .eq("week_number", weekNumber)
      .maybeSingle();

    if (wErr || !w?.id) throw new Error("No pude resolver la semana para guardar el comentario.");

    // 2) week_days -> day_id
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

  async function submitRoutineComment(ctx, message) {
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

    if (error) {
      const msg = String(error.message || "");
      if (msg.includes('relation "routine_comments" does not exist')) {
        throw new Error("La función de comentarios todavía no está habilitada. En el próximo paso la activamos en SQL.");
      }
      throw new Error(error.message || "No pude enviar el comentario.");
    }
  }

  commentModalSend?.addEventListener("click", async () => {
    try {
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

      setCommentMsg("Enviado ✅", "notice");
      setTimeout(() => closeCommentModal(), 600);
    } catch (e) {
      console.error("[A360] comment error:", e);
      setCommentMsg(e?.message || String(e), "error");
    } finally {
      if (commentModalSend) commentModalSend.disabled = false;
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-comment-open]");
    if (!btn) return;

    e.preventDefault();

    const month = Number(btn.getAttribute("data-comment-month") || 0);
    const week = Number(btn.getAttribute("data-comment-week") || 0);
    const day = Number(btn.getAttribute("data-comment-day") || 0);
    const dayName = btn.getAttribute("data-comment-dayname") || `Día ${day}`;

    const title = `Comentario — Mes ${month} · Semana ${week} · ${dayName}`;
    openCommentModal({ month, week, day, title });
  });

  // =====================================================
  // Render rutinas
  // =====================================================
  function getItemsForDay(day) {
    if (currentTrack === "gym") return (day.items_gym || []);
    if (currentTrack === "home") return (day.items_home || []);
    // fallback
    return (day.items_gym || day.items_home || []);
  }

  function renderExerciseCard(item) {
    const videoBtn = item.video_url
      ? `
        <button class="btn" type="button"
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

    const DAY_NAMES = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };

    json.weeks.forEach((week) => {
      const weekDetails = document.createElement("details");
      weekDetails.className = "week";
      weekDetails.open = false;

      weekDetails.addEventListener("toggle", () => {
        if (!weekDetails.open) return;
        monthContent.querySelectorAll("details.week").forEach((other) => {
          if (other !== weekDetails) other.open = false;
        });
      });

      const titleIsRedundant = norm(week.title) === norm(`semana ${week.week_number}`);

      weekDetails.innerHTML = `
        <summary>
          <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
            <b>Semana ${week.week_number}</b>
            ${(!titleIsRedundant && week.title) ? `<span class="small">${esc(week.title)}</span>` : ""}
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

        dayDetails.addEventListener("toggle", () => {
          if (!dayDetails.open) return;
          weekBody.querySelectorAll("details.day").forEach((other) => {
            if (other !== dayDetails) other.open = false;
          });
        });

        const dayName = DAY_NAMES[day.day_number] || `Día ${day.day_number}`;
        const items = getItemsForDay(day);

        const focus = String(day.focus || "").trim();
        const muscleGroupRaw = String(day.muscle_group || "").trim();
        const muscleGroupIsAdef = muscleGroupRaw && norm(muscleGroupRaw) === "a definir";

        const chipsHtml = `
          <div class="chips">
            <div class="chip">${labelTrack(currentTrack)}</div>
            ${(!muscleGroupIsAdef && muscleGroupRaw) ? `<div class="chip">${esc(muscleGroupRaw)}</div>` : ""}
            ${focus ? `<div class="chip">${esc(focus)}</div>` : ""}
          </div>
        `;

        const listHtml = items?.length
          ? `<div class="ex-list">${items.map(renderExerciseCard).join("")}</div>`
          : `<div class="notice small" style="margin-top:10px">Rutina aún no cargada para este objetivo/modalidad.</div>`;

        // ✅ Acciones: comentarios
        const commentBtn = `
          <button class="btn campus-ghost" type="button"
            data-comment-open="1"
            data-comment-month="${esc(currentMonth)}"
            data-comment-week="${esc(week.week_number)}"
            data-comment-day="${esc(day.day_number)}"
            data-comment-dayname="${esc(dayName)}">
            Agregar comentarios
          </button>
        `;

        dayDetails.innerHTML = `
          <summary>
            <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
              <b>${esc(dayName)}</b>
              ${focus ? `<span class="small">${esc(focus)}</span>` : ""}
            </div>
            <span class="small">${items?.length ? `${items.length} ej.` : "Ver"}</span>
          </summary>

          <div class="day-body">
            <div class="day-toprow">
              <div>${chipsHtml}</div>
              <div class="day-actions">${commentBtn}</div>
            </div>

            <div class="comment-hint">
              Tip: Podés dejar comentarios de progreso, molestias o dudas para ajustar tu rutina.
            </div>

            ${listHtml}
          </div>
        `;

        weekBody.appendChild(dayDetails);
      });

      monthContent.appendChild(weekDetails);
    });
  }

  // =====================================================
  // RPC Mes (con gate + fallback)
  // =====================================================
  async function rpcMonthContent(monthNumber, objective) {
    const res = await sb.rpc("get_month_content_gate_secure", {
      p_month: monthNumber,
      p_objective: objective,
    });

    if (!res.error) return res;

    const msg = String(res.error?.message || "");
    if (msg.includes("schema cache") || msg.includes("Could not find the function")) {
      const r3 = await sb.rpc("get_month_content_v3", { p_month: monthNumber, p_objective: objective });
      if (!r3.error) return r3;

      return await sb.rpc("get_month_content_v2", { p_month: monthNumber, p_objective: objective });
    }

    return res;
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
  // Clases en vivo
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

    nextLiveClass = null;
    classesList.innerHTML = "";
    clearText(classesMsg);

    if (!canSeePremiumContent()) {
      setNotice(classesMsg, "Las clases están disponibles solo para el Plan Premium/Pro.", "notice small");
      return;
    }

    classesMsg.className = "small";
    classesMsg.textContent = "Cargando clases…";

    const nowIso = new Date().toISOString();

    const { data, error } = await sb
      .from("live_classes")
      .select("id,title,topic,starts_at,zoom_join_url,zoom_passcode,status,cover_url")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(10);

    if (error) {
      setNotice(classesMsg, error.message, "error");
      return;
    }

    if (!data?.length) {
      setNotice(classesMsg, "Todavía no hay clases en vivo programadas.", "notice small");
      return;
    }

    nextLiveClass = data[0] || null;
    clearText(classesMsg);

    classesList.innerHTML = data
      .map((item) => {
        const when = formatDateTimeEs(item.starts_at);
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
      })
      .join("");
  }

  // =====================================================
  // Clases grabadas
  // =====================================================
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
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
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

    if (!items || !items.length) {
      setNotice(recordedMsg, "Todavía no hay clases grabadas publicadas.", "notice small");
      return;
    }

    clearText(recordedMsg);

    const grouped = groupRecordedByYearMonth(items);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();

    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

    recordedList.innerHTML = years
      .map((year) => {
        const months = Object.keys(grouped[year]).map(Number).sort((a, b) => b - a);
        const yearIsOpen = year === currentYear ? "open" : "";

        return `
          <details class="lib-year" ${yearIsOpen}>
            <summary>${year}</summary>
            ${months
              .map((monthIndex) => {
                const monthIsOpen = (year === currentYear && monthIndex === currentMonthIndex) ? "open" : "";
                return `
                  <details class="lib-month" ${monthIsOpen}>
                    <summary>${monthNameEs(monthIndex)}</summary>
                    <div class="lib-items">
                      ${grouped[year][monthIndex].map(buildRecordedVideoCard).join("")}
                    </div>
                  </details>
                `;
              })
              .join("")}
          </details>
        `;
      })
      .join("");
  }

  async function loadRecordedClasses() {
    if (!recordedList || !recordedMsg) return;

    recordedList.innerHTML = "";
    clearText(recordedMsg);

    if (!canSeePremiumContent()) {
      setNotice(recordedMsg, "Las clases grabadas están disponibles solo para el Plan Premium/Pro.", "notice small");
      return;
    }

    recordedMsg.className = "small";
    recordedMsg.textContent = "Cargando clases grabadas…";

    const { data, error } = await sb
      .from("recorded_classes")
      .select("id, class_date, title, topic, youtube_url, cover_url")
      .order("class_date", { ascending: false })
      .limit(120);

    if (error) {
      setNotice(recordedMsg, error.message, "error");
      return;
    }

    renderRecordedLibrary(data || []);
  }

  // =====================================================
  // Descargar rutina
  // =====================================================
  async function getMonthJsonForDownload(monthNumber, objective) {
    const key = `${monthNumber}-${objective}-${currentTrack}`;
    if (monthCache.has(key)) return monthCache.get(key);

    const { data, error } = await rpcMonthContent(monthNumber, objective);
    if (error) throw error;

    if (data?.locked) {
      const when = data.available_at ? formatDateTimeEs(data.available_at) : "";
      throw new Error(when
        ? `Tu rutina todavía está en preparación. Se habilita: ${when} (AR).`
        : "Tu rutina todavía está en preparación.");
    }

    monthCache.set(key, data);
    return data;
  }

  function buildRoutineHTML({ json, monthNumber, objective, track }) {
    const gen = new Date();
    const title = `Rutina ${monthLabel(monthNumber)} — ${objectiveLabel(objective)} — ${labelTrack(track)}`;

    const DAY_NAMES = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };
    const weeks = Array.isArray(json?.weeks) ? json.weeks : [];

    const weeksHtml = weeks.map((week) => {
      const weekTitle = String(week.title || "").trim();
      const weekHead = weekTitle ? `Semana ${week.week_number} — ${esc(weekTitle)}` : `Semana ${week.week_number}`;
      const days = Array.isArray(week.days) ? week.days : [];

      const daysHtml = days.map((day) => {
        const dayName = DAY_NAMES[day.day_number] || `Día ${day.day_number}`;
        const mg = String(day.muscle_group || "").trim();
        const focus = String(day.focus || "").trim();

        const items = track === "gym" ? (day.items_gym || []) : (day.items_home || []);
        const metaLine = [mg && `Grupo: ${esc(mg)}`, focus && `Foco: ${esc(focus)}`].filter(Boolean).join(" · ");

        if (!items.length) {
          return `
            <section class="day">
              <h3>${esc(dayName)}</h3>
              ${metaLine ? `<div class="meta">${metaLine}</div>` : ""}
              <div class="muted">Sin ejercicios cargados para este objetivo/modalidad.</div>
            </section>
          `;
        }

        const rows = items.map((item) => `
          <tr>
            <td class="col-ex">${esc(item.exercise || "")}</td>
            <td class="col-num">${esc(item.sets || "")}</td>
            <td class="col-num">${esc(item.reps || "")}</td>
            <td class="col-notes">${esc(item.notes || "")}</td>
          </tr>
        `).join("");

        return `
          <section class="day">
            <h3>${esc(dayName)}</h3>
            ${metaLine ? `<div class="meta">${metaLine}</div>` : ""}
            <table>
              <thead>
                <tr>
                  <th>Ejercicio</th>
                  <th class="col-num">Series</th>
                  <th class="col-num">Reps</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>
        `;
      }).join("");

      return `
        <section class="week">
          <h2>${esc(weekHead)}</h2>
          ${daysHtml || `<div class="muted">Semana sin días.</div>`}
        </section>
      `;
    }).join("");

    const body = weeksHtml || `<div class="muted">Este mes no tiene contenido cargado.</div>`;

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body{ font-family: system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif; margin:0; color:#111; background:#fff; }
    .page{ max-width: 920px; margin: 0 auto; padding: 26px; }
    .head{ border-bottom: 1px solid #e9e9e9; padding-bottom: 14px; margin-bottom: 16px; }
    .brand{ font-weight: 800; letter-spacing: .04em; font-size: 14px; opacity: .85; }
    h1{ font-size: 18px; margin: 6px 0 0; line-height:1.25; }
    .sub{ color:#555; font-size: 12px; margin: 6px 0 0; }
    h2{ margin: 18px 0 10px; font-size: 14px; }
    h3{ margin: 14px 0 6px; font-size: 13px; }
    .meta{ font-size: 12px; color:#555; margin-bottom: 8px; }
    .muted{ font-size: 12px; color:#666; }
    .day{ padding: 10px 0 8px; border-top: 1px solid #efefef; }
    table{ width:100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #e7e7e7; border-radius: 10px; overflow: hidden; }
    th, td{ border-bottom: 1px solid #ededed; padding: 10px 10px; font-size: 12px; vertical-align: top; }
    th{ background:#fafafa; text-align:left; font-weight: 700; }
    tr:last-child td{ border-bottom: none; }
    .col-num{ width: 72px; text-align: center; white-space: nowrap; }
    .col-ex{ width: 42%; }
    .footnote{ margin-top: 18px; font-size: 12px; color:#666; border-top: 1px solid #e9e9e9; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="brand">MARICEL CONSE · ACADEMIA DE MUJERES</div>
      <h1>${esc(title)}</h1>
      <p class="sub">Generado: ${esc(gen.toLocaleString("es-AR"))}</p>
    </div>

    ${body}

    <div class="footnote">
      Nota: Los videos y explicaciones de cada ejercicio están disponibles dentro del campus virtual.
    </div>
  </div>
</body>
</html>`;
  }

  async function downloadRoutine() {
    try {
      if (!currentMonth) {
        alert("Primero cargá un mes (esperá a que aparezca la rutina).");
        return;
      }

      if (routineLocked) {
        const when = routineAvailableAt ? formatDateTimeEs(routineAvailableAt) : "";
        alert(when ? `Tu rutina todavía está en preparación.\nSe habilita: ${when} (AR).` : "Tu rutina todavía está en preparación.");
        return;
      }

      const monthNumber = currentMonth;
      const objective = currentObjective;
      const track = currentTrack;

      const json = await getMonthJsonForDownload(monthNumber, objective);
      const html = buildRoutineHTML({ json, monthNumber, objective, track });

      const fileBase = filenameSafe(`rutina_${monthLabel(monthNumber)}_${objective}_${track}`);

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
      console.error("[A360] downloadRoutine error:", e);
      alert(e?.message || String(e));
    }
  }

  downloadRoutineBtn?.addEventListener("click", downloadRoutine);

  // =====================================================
  // Mi perfil
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
    if (!open) {
      setProfileMsg("");
      setDeleteAccountMsg("");
    }
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

    if (error) {
      setProfileMsg(error.message, "error");
      return;
    }

    if (pfFullName) pfFullName.value = profile?.full_name ?? "";
    if (pfPhone) pfPhone.value = profile?.phone ?? "";
    if (pfAge) pfAge.value = profile?.age == null ? "" : String(profile.age);
    if (pfWeight) pfWeight.value = profile?.weight_kg == null ? "" : String(profile.weight_kg);
    if (pfHeight) pfHeight.value = profile?.height_cm == null ? "" : String(profile.height_cm);
    if (pfLevel) pfLevel.value = profile?.training_level ?? "";

    if (profile?.full_name) campusFirstName = firstNameFromFullName(profile.full_name, campusEmailCache);
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
    if (error) {
      setProfileMsg(error.message, "error");
      return;
    }

    campusFirstName = firstNameFromFullName(payload.full_name, email);
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

      const { data: sessRes, error: sessErr } = await sb.auth.getSession();
      if (sessErr) throw sessErr;

      const session = sessRes?.session;
      const token = session?.access_token;
      const email = session?.user?.email || campusEmailCache || "";

      if (!token || !email) {
        alert("Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.");
        return;
      }

      const ok = confirm("Vas a ELIMINAR tu cuenta.\n\nEsto es irreversible.\n\n¿Querés continuar?");
      if (!ok) return;

      const typed = (prompt(`Para confirmar, escribí tu email:\n${email}`) || "").trim();
      if (norm(typed) !== norm(email)) {
        alert("El email no coincide. Operación cancelada.");
        return;
      }

      setDeleteAccountMsg("Eliminando…", "small");

      const res = await sb.functions.invoke("delete-account", {
        body: { confirm_email: typed },
        headers: { authorization: `Bearer ${token}` },
      });

      console.log("[delete-account] response:", res);

      const { data, error } = res;
      if (error) {
        setDeleteAccountMsg(error.message || "Error al eliminar la cuenta.", "error");
        return;
      }
      if (!data?.ok) {
        setDeleteAccountMsg("No se pudo completar la eliminación.", "error");
        return;
      }

      setDeleteAccountMsg("Cuenta eliminada ✅", "notice");

      try { await sb.auth.signOut(); } catch (_) {}
      window.location.href = "./index.html";
    } catch (e) {
      console.error("[A360] deleteMyAccount error:", e);
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
  (async function init() {
    syncHeaderUI();

    const session = await requireAuth();
    if (!session) return;

    if (userEmail) userEmail.textContent = session.user.email;
    campusEmailCache = session.user.email || "";

    await loadCampusIdentity();

    // paralelo
    const routineP = loadRoutineDeliveryStatus(session.user.id);
    const adminP = maybeShowAdminLink();
    const planP = loadPlanBadge();
    const prefsP = loadUserPreferences();
    const quoteP = loadWeeklyQuoteIntoApp();

    await Promise.all([adminP, planP]);

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
      await routineP;
      return;
    }

    syncUpgradeUI(planSlug);
    syncProfileAccountUI();
    syncHelpWhatsappUI();

    // preferencias
    const prefs = await prefsP;
    currentObjective = prefs.objective;
    currentTrack = prefs.track;

    try { localStorage.removeItem("A360_OBJECTIVE"); } catch (_) {}

    syncTrackUI();
    lockRoutineToStudentPreferencesUI();

    // contenido
    const publishedMonth = await getPublishedMonthNumber();
    await openMonth(publishedMonth, { force: true });

    await Promise.all([loadClasses(), loadRecordedClasses()]);
    await Promise.all([quoteP, routineP]);

    console.log("[A360] Ready ✅");
  })();
})();