// admin.js — flujo manual por alumna (limpio + upgrades UX)
// Mantiene: KPIs, Frase semanal, Premium, Ejercicios, Editor del día, Alumnos, Alertas
// Agrega:
// - Dropdown de ejercicios categorizado (Modalidad → Grupo) + búsqueda + toggle inactivos
// - Items del día: Editar + Eliminar + Reordenar drag&drop (persistiendo sort_order)
// - Herramientas de rutina: Duplicar semana, Duplicar mes, Importar rutina por email (otro user)
// - Alertas: lector de comentarios (routine_comments) si existe (no rompe si no existe)
// Nota: este archivo está diseñado para no romper Premium/Biblioteca aunque falle un módulo nuevo
(() => {
  "use strict";

  // =====================================================
  // Guard rails
  // =====================================================
  if (!window.sb) {
    console.error("[ADMIN] sb no existe. Revisá supabaseClient.js y el orden de scripts.");
    alert("Supabase client (sb) no está cargado.");
    return;
  }
  const sb = window.sb;

  function setAlertsDot(count) {
  const tab = document.querySelector('[data-view-tab="view-alertas"]');
  if (!tab) return;

  let dot = tab.querySelector("#a360AlertsDot");
  if (!dot) {
    dot = document.createElement("span");
    dot.id = "a360AlertsDot";
    dot.style.cssText = `
      display:none;
      width:8px;height:8px;
      border-radius:999px;
      margin-left:8px;
      background:#b42318;
      box-shadow:0 0 0 3px rgba(180,35,24,.14);
      align-self:center;
    `;
    tab.appendChild(dot);
  }

  const n = Number(count || 0);
  dot.style.display = n > 0 ? "inline-block" : "none";
  dot.title = n > 0 ? `${n} alerta(s) activa(s)` : "";
}

  // =====================================================
  // Helpers
  // =====================================================
  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));

  function setMsg(el, text, kind = "small") {
    if (!el) return;
    el.className = kind; // small | notice | error
    el.textContent = text || "";
  }

  function norm(v) {
    return String(v ?? "").trim().toLowerCase();
  }

  function fmtARS(n) {
    if (n === null || n === undefined) return "—";
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(v);
  }

  const objLabel = (v) => (v === "muscle_gain" ? "Ganar masa" : "Perder peso");
  const trackLabel = (v) => (v === "home" ? "Casa" : v === "both" ? "Ambos" : "Gimnasio");

  function buildMailto(to, subject, lines) {
    const body = encodeURIComponent(lines.join("\n"));
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${body}`;
  }

  function safeOpenMailto(mailto) {
    const opened = window.open(mailto, "_blank");
    if (!opened) window.location.href = mailto;
  }

  function normalizeTrack(v) {
    const raw = norm(v);
    if (raw === "gym" || raw === "gimnasio") return "gym";
    if (raw === "home" || raw === "casa") return "home";
    if (raw === "both" || raw === "ambos") return "both";
    return null;
  }

  function trackHuman(v) {
    const t = normalizeTrack(v);
    if (t === "home") return "Casa";
    if (t === "gym") return "Gimnasio";
    if (t === "both") return "Ambos";
    return "—";
  }

  // =====================================================
  // Elements: Header + Auth
  // =====================================================
  const logoutBtn = $("logoutBtn");

  // =====================================================
  // Elements: KPIs
  // =====================================================
  const kpiRefreshBtn = $("kpiRefreshBtn");
  const kpiSignups = $("kpiSignups");
  const kpiActive = $("kpiActive");
  const kpiMrr = $("kpiMrr");
  const kpiMrrHint = $("kpiMrrHint");
  const kpiCollected = $("kpiCollected");
  const kpiCollectedHint = $("kpiCollectedHint");
  const kpiByPlan = $("kpiByPlan");

  // =====================================================
  // Elements: Active Users
  // =====================================================
  const activeUsersRefreshBtn = $("activeUsersRefreshBtn");
  const activeUsersPlanSel = $("activeUsersPlanSel");
  const activeUsersMsg = $("activeUsersMsg");
  const activeUsersList = $("activeUsersList");

  // =====================================================
  // Elements: Editor del día
  // =====================================================
  const editorHint = $("editorHint");
  const weekSel = $("weekSel");
  const daySel = $("daySel");
  const loadBtn = $("loadBtn");
  const selMsg = $("selMsg");

  const dayTitle = $("dayTitle");
  const dayMeta = $("dayMeta");
  const dayEdit = $("dayEdit");

  const mgSel = $("mgSel");
  const focusInp = $("focusInp");
  const saveDayMetaBtn = $("saveDayMetaBtn");
  const metaMsg = $("metaMsg");

  const exerciseSearch = $("exerciseSearch");
  const exerciseShowInactive = $("exerciseShowInactive");
  const exerciseSel = $("exerciseSel");

  const setsInp = $("setsInp");
  const repsInp = $("repsInp");
  const notesInp = $("notesInp");
  const addItemBtn = $("addItemBtn");
  const itemMsg = $("itemMsg");
  const itemsList = $("itemsList");
  const refreshItemsBtn = $("refreshItemsBtn");
  const reorderMsg = $("reorderMsg");

  // Badge (opcional en el nuevo esquema)
  const currentStudentEmail = $("currentStudentEmail");
  const currentStudentMonth = $("currentStudentMonth");

  // =====================================================
  // Elements: Ejercicios
  // =====================================================
  const exName = $("exName");
  const exVideo = $("exVideo");
  const exCues = $("exCues");
  const exObjective = $("exObjective");
  const exTrack = $("exTrack");
  const exGroup = $("exGroup");
  const createExerciseBtn = $("createExerciseBtn");
  const exMsg = $("exMsg");
  const exRefreshBtn = $("exRefreshBtn");
  const exList = $("exList");

  // =====================================================
  // Elements: Alumnos
  // =====================================================
  const studentEmail = $("studentEmail");
  const findStudentBtn = $("findStudentBtn");
  const studentMsg = $("studentMsg");
  const studentCard = $("studentCard");
  const studentEmailOut = $("studentEmailOut");
  const studentPlanOut = $("studentPlanOut");
  const studentStatusOut = $("studentStatusOut");
  const studentPaidOut = $("studentPaidOut");

  const stuMonthSel = $("stuMonthSel");
  const stuPrefLine = $("stuPrefLine");

  const editStudentModeBtn = $("editStudentModeBtn");
  const exitStudentModeBtn = $("exitStudentModeBtn");
  const studentModeMsg = $("studentModeMsg");

  const saveSendRoutineBtn = $("saveSendRoutineBtn");
  const saveSendRoutineMsg = $("saveSendRoutineMsg");
  const saveSendRoutineBtnTop = $("saveSendRoutineBtnTop");
  const saveSendRoutineMsgTop = $("saveSendRoutineMsgTop");

  const openStudentCaseBtn = $("openStudentCaseBtn");

  const stuRoutineMeta = $("stuRoutineMeta");
  const stuRoutineMsg = $("stuRoutineMsg");
  const stuRoutineBox = $("stuRoutineBox");

  // =====================================================
  // Elements: Alertas
  // =====================================================
  const alertsMsg = $("alertsMsg");
  const alertsList = $("alertsList");

  // =====================================================
  // Herramientas de rutina
  // =====================================================
  const dupWeekFrom = $("dupWeekFrom");
  const dupWeekTo = $("dupWeekTo");
  const dupWeekBtn = $("dupWeekBtn");

  const dupMonthFrom = $("dupMonthFrom");
  const dupMonthTo = $("dupMonthTo");
  const dupMonthBtn = $("dupMonthBtn");

  const importFromEmail = $("importFromEmail");
  const importRoutineBtn = $("importRoutineBtn");
  const routineToolsMsg = $("routineToolsMsg");

  // =====================================================
  // Comentarios alumnas (Alertas)
  // =====================================================
  const routineCommentsRefreshBtn = $("routineCommentsRefreshBtn");
  const routineCommentsMsg = $("routineCommentsMsg");
  const routineCommentsList = $("routineCommentsList");
  // =====================================================
// Comentarios alumnas: Vista (Bandeja vs Historial por alumna)
// =====================================================
let routineCommentsView = "inbox"; // "inbox" | "student"
let routineCommentsStudent = { user_id: null, email: null };

function setRoutineCommentsViewInbox() {
  routineCommentsView = "inbox";
  routineCommentsStudent = { user_id: null, email: null };
  syncRoutineCommentsViewToggle();
}

function setRoutineCommentsViewStudent(userId, email) {
  routineCommentsView = "student";
  routineCommentsStudent = { user_id: userId || null, email: email || null };
  syncRoutineCommentsViewToggle();
}

function ensureRoutineCommentsViewToggle() {
  if (!routineCommentsRefreshBtn || routineCommentsRefreshBtn.__hasToggleBtn) return;
  routineCommentsRefreshBtn.__hasToggleBtn = true;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  btn.id = "routineCommentsToggleBtn";
  btn.style.marginLeft = "10px";
  btn.textContent = "Ver historial";

  routineCommentsRefreshBtn.parentNode?.insertBefore(btn, routineCommentsRefreshBtn.nextSibling);

  btn.addEventListener("click", async () => {
    // Si estamos en historial → volver a bandeja
    if (routineCommentsView === "student") {
      setRoutineCommentsViewInbox();
      await loadRoutineComments();
      return;
    }

    // Si estamos en bandeja → ir a historial de la alumna abierta
    if (!state.user_id) {
      alert("Primero buscá una alumna para ver su historial.");
      return;
    }
    setRoutineCommentsViewStudent(state.user_id, state.email);
    await loadRoutineComments();
  });

  syncRoutineCommentsViewToggle();
}

function syncRoutineCommentsViewToggle() {
  const btn = document.getElementById("routineCommentsToggleBtn");
  if (!btn) return;

  if (routineCommentsView === "student") {
    btn.textContent = "Volver a bandeja";
  } else {
    btn.textContent = "Ver historial (alumna)";
  }
}

  // =====================================================
  // Premium
  // =====================================================
  const rcMonth = $("rcMonth");
  const rcDate = $("rcDate");
  const rcTitle = $("rcTitle");
  const rcTopic = $("rcTopic");
  const rcYoutube = $("rcYoutube");
  const rcCoverFile = $("rcCoverFile");
  const rcCoverUrl = $("rcCoverUrl");
  const rcNotes = $("rcNotes");
  const rcSaveBtn = $("rcSaveBtn");
  const rcMsg = $("rcMsg");
  const rcRefreshBtn = $("rcRefreshBtn");
  const rcList = $("rcList");

  const lcStartsAt = $("lcStartsAt");
  const lcTitle = $("lcTitle");
  const lcTopic = $("lcTopic");
  const lcZoom = $("lcZoom");
  const lcPasscode = $("lcPasscode");
  const lcReminderMin = $("lcReminderMin");
  const lcSaveBtn = $("lcSaveBtn");
  const lcMsg = $("lcMsg");
  const lcRefreshBtn = $("lcRefreshBtn");
  const lcList = $("lcList");
  const lcCoverFile = $("lcCoverFile");
  const lcCoverUrl = $("lcCoverUrl");
  const lcCoverPreview = $("lcCoverPreview");

  // =====================================================
  // Weekly Quote Admin (igual al tuyo)
  // =====================================================
  function initWeeklyQuoteAdmin() {
    const elTitle = $("wqTitle");
    const elPhrase = $("wqCopy");
    const elFile = $("wqPhotoFile");
    const elUrl = $("wqPhotoUrl");
    const btnSave = $("wqSaveBtn");
    const btnRefresh = $("wqRefreshBtn");
    const msg = $("wqMsg");

    const pvTitle = $("wqPreviewTitle");
    const pvPhrase = $("wqPreviewCopy");
    const pvImg = $("wqPreviewImg");

    if (!elTitle || !elPhrase || !btnSave || !btnRefresh) return;

    const TABLE = "weekly_quote";
    const SINGLETON_ID = 1;
    const BUCKET = "class_covers";
    const FOLDER = "weekly_quote";

    const setLocalMsg = (t, ok = false) => {
      if (!msg) return;
      msg.textContent = t || "";
      msg.style.color = ok ? "rgba(40,140,90,.95)" : "rgba(0,0,0,.75)";
    };

    const updatePreview = ({ title, phrase, image_url }) => {
      if (pvTitle) pvTitle.textContent = title || "—";
      if (pvPhrase) pvPhrase.textContent = phrase || "—";
      if (!pvImg) return;
      if (image_url) {
        pvImg.src = image_url;
        pvImg.style.display = "block";
      } else {
        pvImg.removeAttribute("src");
        pvImg.style.display = "none";
      }
    };

    const uploadPhoto = async (file) => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${FOLDER}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

      const up = await sb.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
      });
      if (up.error) throw up.error;

      const pub = sb.storage.from(BUCKET).getPublicUrl(path);
      return pub.data?.publicUrl || "";
    };

    const load = async () => {
      try {
        setLocalMsg("Cargando…");
        const { data, error } = await sb
          .from(TABLE)
          .select("id,title,phrase,image_url,updated_at")
          .eq("id", SINGLETON_ID)
          .maybeSingle();
        if (error) throw error;

        const row = data || {};
        elTitle.value = row.title || "";
        elPhrase.value = row.phrase || "";
        elUrl.value = row.image_url || "";

        updatePreview({ title: row.title, phrase: row.phrase, image_url: row.image_url });
        setLocalMsg("OK", true);
      } catch (e) {
        console.error("[ADMIN] weekly_quote load:", e);
        setLocalMsg("No pude cargar (RLS o falta registro id=1).");
      }
    };

    const save = async () => {
      try {
        const title = (elTitle.value || "").trim();
        const phrase = (elPhrase.value || "").trim();
        if (!title) return setLocalMsg("Completá Título y Copy.");

        setLocalMsg("Guardando…");

        let imageUrl = (elUrl.value || "").trim();
        const file = elFile?.files?.[0];
        if (file) imageUrl = await uploadPhoto(file);

        const payload = {
          id: SINGLETON_ID,
          title,
          phrase,
          image_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await sb.from(TABLE).upsert(payload);
        if (error) throw error;

        updatePreview({ title, phrase, image_url: imageUrl });
        setLocalMsg("Guardado ✅", true);
      } catch (e) {
        console.error("[ADMIN] weekly_quote save:", e);
        setLocalMsg("No pude guardar (RLS / Storage policy).");
      }
    };

    btnRefresh.addEventListener("click", load);
    btnSave.addEventListener("click", save);

    elUrl.addEventListener("input", () => {
      updatePreview({
        title: elTitle.value,
        phrase: elPhrase.value,
        image_url: (elUrl.value || "").trim(),
      });
    });

    elFile?.addEventListener("change", () => {
      const f = elFile.files?.[0];
      if (!f) return;
      updatePreview({
        title: elTitle.value,
        phrase: elPhrase.value,
        image_url: URL.createObjectURL(f),
      });
    });

    load();
  }

  // =====================================================
  // State
  // =====================================================
  const state = {
    mode: "idle", // idle | student
    user_id: null,
    email: null,
    month: null,
    objective: "fat_loss",
    track: "gym",
    week_id: null,
    day_id: null,
    week_number: null,
    day_number: null,
    profile: null,
    prefs: null,    
  };

  function setStudentModeMsg(t, kind = "small") {
    if (!studentModeMsg) return;
    studentModeMsg.className = kind;
    studentModeMsg.textContent = t || "";
  }

function setSaveSendMsg(t, kind = "small") {
  if (saveSendRoutineMsg) {
    saveSendRoutineMsg.className = kind;
    saveSendRoutineMsg.textContent = t || "";
  }
  if (saveSendRoutineMsgTop) {
    saveSendRoutineMsgTop.className = kind;
    saveSendRoutineMsgTop.textContent = t || "";
  }
}

  function setEditorHint(t) {
    if (!editorHint) return;
    editorHint.textContent = t || "";
  }

  function setRoutineToolsMsg(t, kind = "small") {
    if (!routineToolsMsg) return;
    routineToolsMsg.className = kind;
    routineToolsMsg.textContent = t || "";
  }

  function setReorderMsg(t, kind = "small") {
    if (!reorderMsg) return;
    reorderMsg.className = kind;
    reorderMsg.textContent = t || "";
  }

  function syncRoutineBadge() {
    if (currentStudentEmail) currentStudentEmail.textContent = state.email || "—";
    if (currentStudentMonth) currentStudentMonth.textContent = state.month ? `Mes ${state.month}` : "—";
  }

  function enterStudentMode() {
    state.mode = "student";
    setStudentModeMsg("Modo alumno ✅ Editando rutina personalizada.", "notice");

    if (exitStudentModeBtn) exitStudentModeBtn.style.display = "inline-flex";
    if (editStudentModeBtn) editStudentModeBtn.style.display = "none";
    if (saveSendRoutineBtn) saveSendRoutineBtn.style.display = "inline-flex";
    if (saveSendRoutineBtnTop) saveSendRoutineBtnTop.style.display = "inline-flex";
    setEditorHint("Elegí semana/día y cargá ejercicios para este mes.");
  }

  function exitStudentMode() {
    state.mode = "idle";
    state.user_id = null;
    state.email = null;
    state.month = null;
    state.week_id = null;
    state.day_id = null;
    state.week_number = null;
    state.day_number = null;

    if (exitStudentModeBtn) exitStudentModeBtn.style.display = "none";
    if (editStudentModeBtn) editStudentModeBtn.style.display = "inline-flex";
    if (saveSendRoutineBtn) saveSendRoutineBtn.style.display = "none";
    if (saveSendRoutineBtnTop) saveSendRoutineBtnTop.style.display = "none";
    if (saveSendRoutineMsgTop) saveSendRoutineMsgTop.textContent = "";

    setStudentModeMsg("");
    setSaveSendMsg("");
    setRoutineToolsMsg("");
    setEditorHint("Primero buscá un alumno y elegí mes.");
    syncRoutineBadge();

    if (dayEdit) dayEdit.style.display = "none";
    if (itemsList) itemsList.innerHTML = "";
    if (weekSel) weekSel.innerHTML = "";
    if (daySel) daySel.innerHTML = "";
  }

  // =====================================================
  // Auth / Admin
  // =====================================================
  async function ensureAdminSession() {
    const { data: sdata } = await sb.auth.getSession();
    if (!sdata?.session) {
      window.location.href = "./admin-login.html";
      return false;
    }

    const { data: isAdmin } = await sb.rpc("is_admin");
    if (isAdmin !== true) {
      alert("Tu usuario no tiene permisos admin.");
      window.location.href = "./index.html";
      return false;
    }

    return true;
  }

  logoutBtn?.addEventListener("click", async () => {
    try {
      await sb.auth.signOut();
    } catch (_) {}
    window.location.href = "./index.html";
  });

  // =====================================================
  // KPIs
  // =====================================================
  async function loadKPIs() {
    if (!kpiSignups) return;

    kpiSignups.textContent = "…";
    if (kpiActive) kpiActive.textContent = "…";
    if (kpiMrr) kpiMrr.textContent = "…";
    if (kpiCollected) kpiCollected.textContent = "…";
    if (kpiByPlan) kpiByPlan.innerHTML = "";
    if (kpiMrrHint) kpiMrrHint.textContent = "";
    if (kpiCollectedHint) kpiCollectedHint.textContent = "";

    const { data, error } = await sb.rpc("admin_get_kpis");

    if (error) {
      if (kpiSignups) kpiSignups.textContent = "—";
      if (kpiActive) kpiActive.textContent = "—";
      if (kpiMrr) kpiMrr.textContent = "—";
      if (kpiCollected) kpiCollected.textContent = "—";
      if (kpiMrrHint) kpiMrrHint.textContent = error.message;
      return;
    }

    if (kpiSignups) kpiSignups.textContent = String(data?.total_signups ?? "—");
    if (kpiActive) kpiActive.textContent = String(data?.active_accounts ?? "—");

    if (kpiMrr) {
      if (data?.estimated_mrr_ars === null || data?.estimated_mrr_ars === undefined) {
        kpiMrr.textContent = "—";
        if (kpiMrrHint) kpiMrrHint.textContent = "Tip: agregá plans.price_ars para estimar MRR.";
      } else {
        kpiMrr.textContent = fmtARS(data.estimated_mrr_ars);
      }
    }

    if (kpiCollected) {
      if (data?.total_collected_ars === null || data?.total_collected_ars === undefined) {
        kpiCollected.textContent = "—";
        if (kpiCollectedHint) kpiCollectedHint.textContent = "Tip: guardá pagos en mp_payments desde el webhook.";
      } else {
        kpiCollected.textContent = fmtARS(data.total_collected_ars);
      }
    }

    const by = Array.isArray(data?.active_by_plan) ? data.active_by_plan : [];
    if (kpiByPlan) {
      kpiByPlan.innerHTML = by.length
        ? by
            .map(
              (x) => `
              <div class="item" style="display:flex;justify-content:space-between;gap:10px">
                <div><b>${esc(x.slug)}</b></div>
                <div class="small">${esc(x.qty)}</div>
              </div>
            `
            )
            .join("")
        : `<div class="notice small">Sin activos.</div>`;
    }
  }

  kpiRefreshBtn?.addEventListener("click", () => loadKPIs().catch(console.error));

  // =====================================================
  // Usuarios activos: filtro planes + lista
  // =====================================================
  async function loadPlansIntoActiveUsersFilter() {
    if (!activeUsersPlanSel) return;

    activeUsersPlanSel.innerHTML = `<option value="">(todos)</option>`;

    try {
      const { data, error } = await sb.from("plans").select("slug,name").order("id", { ascending: true });
      if (error) throw error;

      const opts = (data || [])
        .filter((p) => p?.slug)
        .map((p) => `<option value="${esc(p.slug)}">${esc(p.name || p.slug)} (${esc(p.slug)})</option>`)
        .join("");

      activeUsersPlanSel.innerHTML = `<option value="">(todos)</option>${opts}`;
    } catch (e) {
      console.warn("[ADMIN] No pude cargar planes para filtro:", e);
      activeUsersPlanSel.innerHTML = `<option value="">(todos)</option>`;
    }
  }

  async function loadActiveUsers() {
    if (!activeUsersList || !activeUsersMsg) return;

    setMsg(activeUsersMsg, "Cargando…", "small");
    activeUsersList.innerHTML = "";

    const planFilter = (activeUsersPlanSel?.value || "").trim();

    const { data: plansRows, error: upErr } = await sb
      .from("user_plan")
      .select("user_id, status, paid_through, plan_id, plans:plan_id (slug,name)")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (upErr) {
      setMsg(activeUsersMsg, upErr.message, "error");
      return;
    }

    let rows = plansRows || [];
    if (planFilter) rows = rows.filter((r) => String(r.plans?.slug || "") === planFilter);

    const userIds = rows.map((r) => r.user_id).filter(Boolean);
    if (!userIds.length) {
      setMsg(activeUsersMsg, "No hay usuarios activos con ese filtro.", "notice");
      return;
    }

    const { data: profRows, error: pfErr } = await sb.from("profiles").select("user_id,email,full_name").in("user_id", userIds);

    if (pfErr) {
      setMsg(activeUsersMsg, `No pude cargar profiles: ${pfErr.message}`, "error");
      return;
    }

    const profById = {};
    for (const p of profRows || []) profById[p.user_id] = p;

    setMsg(activeUsersMsg, `Activos: ${rows.length}`, "small");

    activeUsersList.innerHTML = rows
      .map((r) => {
        const p = profById[r.user_id] || {};
        const email = p.email || "—";
        const name = p.full_name ? ` · ${esc(p.full_name)}` : "";
        const planName = r.plans?.name || "Plan";
        const planSlug = r.plans?.slug || "—";
        const paid = r.paid_through ? new Date(r.paid_through).toLocaleDateString("es-AR") : "—";

        return `
          <div class="item" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div style="min-width:260px">
              <div><b>${esc(email)}</b><span class="small" style="opacity:.8">${name}</span></div>
              <div class="small" style="opacity:.9">${esc(planName)} (${esc(planSlug)}) · Pago hasta: ${esc(paid)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn primary" type="button" data-open-student="${esc(email)}">Abrir</button>
            </div>
          </div>
        `;
      })
      .join("");

    activeUsersList.querySelectorAll("[data-open-student]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const email = btn.getAttribute("data-open-student");
    if (!email) return;

    // 1) setear email en buscador (por si después querés usarlo)
    if (studentEmail) studentEmail.value = email;

    // 2) abrir alumna (esto carga state + overview)
    await findStudent(email);

    // 3) saltar a Rutinas
    window.location.hash = "#view-rutinas";

    // 4) scrollear al editor / rutina
    setTimeout(() => {
      const anchor =
        document.getElementById("sec-editor") ||
        document.getElementById("view-rutinas");
      anchor?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 50);
  });
});
  }

  activeUsersRefreshBtn?.addEventListener("click", () => loadActiveUsers().catch(console.error));
  activeUsersPlanSel?.addEventListener("change", () => loadActiveUsers().catch(console.error));

  // =====================================================
  // Alumnos: meses/semana/día
  // =====================================================
  async function loadMonthsIntoStudentSelect() {
    if (!stuMonthSel) return;

    const { data, error } = await sb.from("program_months").select("month_number,title").order("month_number", { ascending: true });

    if (error) {
      stuMonthSel.innerHTML = `<option value="">Error</option>`;
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      stuMonthSel.innerHTML = `<option value="">Sin meses</option>`;
      return;
    }

    const opts = rows
      .map((m) => `<option value="${esc(m.month_number)}">Mes ${esc(m.month_number)} — ${esc(m.title || "")}</option>`)
      .join("");

    stuMonthSel.innerHTML = opts;

    const nowM = new Date().getMonth() + 1;
    const hasNow = rows.some((x) => Number(x.month_number) === nowM);
    stuMonthSel.value = hasNow ? String(nowM) : String(rows[0].month_number);

    // Herramientas rutina: meses
    if (dupMonthFrom) dupMonthFrom.innerHTML = opts;
    if (dupMonthTo) dupMonthTo.innerHTML = opts;
    if (dupMonthFrom) dupMonthFrom.value = String(stuMonthSel.value || "");
    if (dupMonthTo) dupMonthTo.value = String(stuMonthSel.value || "");
  }

  async function loadWeeksForMonth(month) {
    if (!weekSel) return;
    weekSel.innerHTML = `<option value="">Cargando…</option>`;

    const { data, error } = await sb
      .from("weeks")
      .select("id,week_number,title")
      .eq("month_number", month)
      .order("week_number", { ascending: true });

    if (error) {
      weekSel.innerHTML = `<option value="">Error</option>`;
      setMsg(selMsg, error.message, "error");
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      weekSel.innerHTML = `<option value="">Sin semanas</option>`;
      return;
    }

    weekSel.innerHTML = rows
      .map((w) => `<option value="${esc(w.week_number)}">Semana ${esc(w.week_number)}${w.title ? ` — ${esc(w.title)}` : ""}</option>`)
      .join("");

    weekSel.value = String(rows[0].week_number);
    await loadDaysForMonthWeek(month, Number(weekSel.value));
  }

  async function loadDaysForMonthWeek(month, weekNumber) {
    if (!daySel) return;
    daySel.innerHTML = `<option value="">Cargando…</option>`;

    const { data: w, error: wErr } = await sb
      .from("weeks")
      .select("id")
      .eq("month_number", month)
      .eq("week_number", weekNumber)
      .maybeSingle();

    if (wErr || !w?.id) {
      daySel.innerHTML = `<option value="">Sin días</option>`;
      return;
    }

    const { data, error } = await sb.from("week_days").select("day_number,label").eq("week_id", w.id).order("day_number", { ascending: true });

    if (error) {
      daySel.innerHTML = `<option value="">Error</option>`;
      setMsg(selMsg, error.message, "error");
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      daySel.innerHTML = `<option value="">Sin días</option>`;
      return;
    }

    daySel.innerHTML = rows
      .map((d) => `<option value="${esc(d.day_number)}">Día ${esc(d.day_number)}${d.label ? ` — ${esc(d.label)}` : ""}</option>`)
      .join("");

    daySel.value = String(rows[0].day_number);
  }

  weekSel?.addEventListener("change", async () => {
    if (!state.month) return;
    await loadDaysForMonthWeek(state.month, Number(weekSel.value || 0));
  });

  // =====================================================
  // Editor: cargar día (user_day_items)
  // =====================================================
  async function loadDayForStudent() {
    if (state.mode !== "student" || !state.user_id || !state.month) {
      setMsg(selMsg, "Primero buscá un alumno y entrá en edición.", "error");
      return false;
    }

    const weekNumber = Number(weekSel?.value || 0);
    const dayNumber = Number(daySel?.value || 0);
    if (!weekNumber || !dayNumber) {
      setMsg(selMsg, "Elegí semana y día.", "error");
      return false;
    }

    setMsg(selMsg, "Cargando día…", "small");

    const { data: w, error: wErr } = await sb
      .from("weeks")
      .select("id,title")
      .eq("month_number", state.month)
      .eq("week_number", weekNumber)
      .maybeSingle();

    if (wErr || !w?.id) {
      setMsg(selMsg, "No pude resolver la semana.", "error");
      return false;
    }

    state.week_id = w.id;
    state.week_number = weekNumber;

    const { data: d, error: dErr } = await sb
      .from("week_days")
      .select("id,label,muscle_group,focus")
      .eq("week_id", w.id)
      .eq("day_number", dayNumber)
      .maybeSingle();

    if (dErr || !d?.id) {
      setMsg(selMsg, "No pude resolver el día.", "error");
      return false;
    }

    state.day_id = d.id;
    state.day_number = dayNumber;

    if (dayTitle) dayTitle.textContent = `Mes ${state.month} · Semana ${weekNumber} · Día ${dayNumber} (${d.label || ""})`;
    if (dayMeta) dayMeta.textContent = `Editando rutina personalizada · ${objLabel(state.objective)} · ${trackLabel(state.track)}`;

    if (mgSel) mgSel.value = d.muscle_group || mgSel.value || "Tren inferior";
    if (focusInp) focusInp.value = d.focus || "";

    if (dayEdit) dayEdit.style.display = "block";

    // Dropdown ejercicios (categorizado) + items
    try {
      await loadExercisesDropdown();
    } catch (e) {
      console.warn("[ADMIN] loadExercisesDropdown:", e);
    }

    await loadItems().catch((e) => {
      console.error(e);
      setMsg(selMsg, e?.message || String(e), "error");
    });

    setMsg(selMsg, "Día cargado ✅", "notice");
    return true;
  }

  loadBtn?.addEventListener("click", () =>
    loadDayForStudent().catch((e) => {
      console.error(e);
      setMsg(selMsg, e?.message || String(e), "error");
    })
  );

  // =====================================================
  // Editor: metadata del día (week_days)
  // =====================================================
  async function saveDayMeta() {
    if (!state.day_id) throw new Error("Primero cargá un día.");

    const mg = mgSel?.value || null;
    const focus = (focusInp?.value || "").trim();
    const focusVal = focus.length ? focus : null;

    const { error } = await sb.from("week_days").update({ muscle_group: mg, focus: focusVal }).eq("id", state.day_id);
    if (error) throw new Error(error.message);

    setMsg(metaMsg, "Metadata guardada ✅", "notice");
  }

  saveDayMetaBtn?.addEventListener("click", () =>
    saveDayMeta().catch((e) => {
      console.error(e);
      setMsg(metaMsg, e?.message || String(e), "error");
    })
  );

  // =====================================================
  // Editor: exercises dropdown (categorizado + búsqueda)
  // =====================================================
  let _exCache = [];
  let _exCacheLoaded = false;

  const TRACK_LABEL = { gym: "Gimnasio", home: "Casa", both: "Ambos", unknown: "Sin modalidad" };
  const MG_LABEL = {
    lower: "Tren inferior",
    upper: "Tren superior",
    abs: "Abdominales",
    activation: "Activación",
    cardio: "Cardio",
    unknown: "Sin grupo",
  };

  const trackOrder = ["gym", "home", "both", "unknown"];
  const mgOrder = ["lower", "upper", "abs", "activation", "cardio", "unknown"];

  const normTrack2 = (v) => (v === "gym" || v === "home" || v === "both" ? v : "unknown");
  const normMG2 = (v) => (v === "lower" || v === "upper" || v === "abs" || v === "activation" || v === "cardio" ? v : "unknown");

  async function ensureExercisesCache(force = false) {
    if (_exCacheLoaded && !force) return;

    const { data, error } = await sb
      .from("exercises")
      .select("id,name,track,muscle_group,is_active")
      .order("name", { ascending: true })
      .limit(5000);

    if (error) throw new Error(error.message);

    _exCache = Array.isArray(data) ? data : [];
    _exCacheLoaded = true;
  }

  function buildExerciseOptgroupsHtml({ selectedId = null, search = "", showInactive = true } = {}) {
    const q = norm(search);

    const rows = (_exCache || []).filter((e) => {
      if (!showInactive && e.is_active === false) return false;
      if (!q) return true;
      return norm(e.name).includes(q);
    });

    const tree = {};
    for (const e of rows) {
      const t = normTrack2(e.track);
      const mg = normMG2(e.muscle_group);
      (((tree[t] ||= {})[mg] ||= [])).push(e);
    }

    const mkOpt = (e) => {
      const disabled = e.is_active === false;
      const suffix = disabled ? " (INACTIVO)" : "";
      const sel = String(e.id) === String(selectedId) ? "selected" : "";
      return `<option value="${esc(e.id)}" ${disabled ? "disabled" : ""} ${sel}>${esc(e.name || "Ejercicio")}${esc(suffix)}</option>`;
    };

    const html = trackOrder
      .filter((t) => tree[t])
      .map((t) =>
        mgOrder
          .filter((mg) => tree[t][mg]?.length)
          .map((mg) => {
            const label = `${TRACK_LABEL[t]} — ${MG_LABEL[mg]}`;
            const items = tree[t][mg]
              .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"))
              .map(mkOpt)
              .join("");
            return `<optgroup label="${esc(label)}">${items}</optgroup>`;
          })
          .join("")
      )
      .join("");

    return html || "";
  }

  function renderExercisesDropdown() {
    if (!exerciseSel) return;

    const selectedId = exerciseSel.value || null;
    const search = exerciseSearch?.value || "";
    const showInactive = exerciseShowInactive ? !!exerciseShowInactive.checked : true;

    const html = buildExerciseOptgroupsHtml({ selectedId, search, showInactive });

    exerciseSel.innerHTML =
      `<option value="">Elegí un ejercicio…</option>` +
      (html || `<option value="" disabled>(sin resultados)</option>`);
  }

  async function loadExercisesDropdown() {
    if (!exerciseSel) return;
    exerciseSel.innerHTML = `<option value="">Cargando…</option>`;
    await ensureExercisesCache(true);
    renderExercisesDropdown();
  }

  exerciseSearch?.addEventListener("input", () => {
    try {
      renderExercisesDropdown();
    } catch (e) {
      console.error(e);
    }
  });
  exerciseShowInactive?.addEventListener("change", () => {
    try {
      renderExercisesDropdown();
    } catch (e) {
      console.error(e);
    }
  });

  // =====================================================
  // Items: add + edit + delete + drag reorder
  // =====================================================
  async function getNextSortOrder() {
    const { data, error } = await sb
      .from("user_day_items")
      .select("sort_order")
      .eq("user_id", state.user_id)
      .eq("day_id", state.day_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);

    const last = data?.[0]?.sort_order ? Number(data[0].sort_order) : 0;
    return last + 1;
  }

  async function addItemToDay() {
    if (!state.user_id) throw new Error("Primero buscá un alumno y entrá en edición.");
    if (!state.day_id) throw new Error("Primero cargá un día.");

    const exercise_id = exerciseSel?.value;
    if (!exercise_id) throw new Error("Elegí un ejercicio.");

    const sets = Number(setsInp?.value || 0);
    const reps = (repsInp?.value || "").trim();
    const notes = (notesInp?.value || "").trim() || null;

    if (!sets || sets < 1) throw new Error("Series inválidas.");
    if (!reps) throw new Error("Reps es obligatorio (ej: 8-10).");

    const { data: existsRows, error: exErr } = await sb
      .from("user_day_items")
      .select("id")
      .eq("user_id", state.user_id)
      .eq("day_id", state.day_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .eq("exercise_id", exercise_id)
      .limit(1);

    if (exErr) throw new Error(exErr.message);
    if (existsRows?.length) {
      setMsg(itemMsg, "Ese ejercicio ya está cargado en este día.", "error");
      return;
    }

    const sort_order = await getNextSortOrder();

    const { error } = await sb.from("user_day_items").insert({
      user_id: state.user_id,
      day_id: state.day_id,
      sort_order,
      exercise_id,
      sets,
      reps,
      notes,
      track: state.track,
      objective: state.objective,
    });

    if (error) throw new Error(error.message);

    setMsg(itemMsg, "Agregado ✅", "notice");

    if (setsInp) setsInp.value = "";
    if (repsInp) repsInp.value = "";
    if (notesInp) notesInp.value = "";

    await loadItems();
    await loadStudentMonthOverview();
  }

  addItemBtn?.addEventListener("click", () => {
    setMsg(itemMsg, "");
    addItemToDay().catch((e) => {
      console.error(e);
      setMsg(itemMsg, e?.message || String(e), "error");
    });
  });

  // Delegación + drag
  let _itemsBound = false;
  let _dragAllowed = false;
  let _dragEl = null;

  function bindItemsOnce() {
    if (_itemsBound || !itemsList) return;
    _itemsBound = true;

    itemsList.addEventListener(
      "pointerdown",
      (ev) => {
        const handle = ev.target?.closest?.(".drag-handle");
        _dragAllowed = !!handle;
      },
      { passive: true }
    );

    itemsList.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("button[data-item-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-item-act");
      const id = btn.getAttribute("data-item-id");
      if (!act || !id) return;

      const editBox = itemsList.querySelector(`[data-item-edit="${CSS.escape(id)}"]`);
      const msgEl = itemsList.querySelector(`[data-item-msg="${CSS.escape(id)}"]`);

      const setRowMsg = (t, kind = "small") => {
        if (!msgEl) return;
        msgEl.className = kind;
        msgEl.textContent = t || "";
      };

      if (act === "toggle-edit") {
        if (!editBox) return;
        editBox.style.display = editBox.style.display === "block" ? "none" : "block";
        return;
      }

      if (act === "cancel-edit") {
        if (editBox) editBox.style.display = "none";
        setRowMsg("");
        return;
      }

      if (act === "delete") {
        if (!confirm("¿Eliminar este item?")) return;

        const { error } = await sb.from("user_day_items").delete().eq("id", id);
        if (error) return alert(error.message);

        await loadItems();
        await loadStudentMonthOverview();
        return;
      }

      if (act === "save-edit") {
        if (!editBox) return;

        try {
          setRowMsg("Guardando…", "small");

          const exercise_id = editBox.querySelector('[data-item-field="exercise_id"]')?.value || "";
          const sets = Number(editBox.querySelector('[data-item-field="sets"]')?.value || 0);
          const reps = (editBox.querySelector('[data-item-field="reps"]')?.value || "").trim();
          const notesRaw = (editBox.querySelector('[data-item-field="notes"]')?.value || "").trim();
          const notes = notesRaw.length ? notesRaw : null;

          if (!exercise_id) throw new Error("Elegí un ejercicio.");
          if (!sets || sets < 1) throw new Error("Series inválidas.");
          if (!reps) throw new Error("Reps es obligatorio.");

          const { data: dup, error: dupErr } = await sb
            .from("user_day_items")
            .select("id")
            .eq("user_id", state.user_id)
            .eq("day_id", state.day_id)
            .eq("objective", state.objective)
            .eq("track", state.track)
            .eq("exercise_id", exercise_id)
            .neq("id", id)
            .limit(1);

          if (dupErr) throw new Error(dupErr.message);
          if (dup?.length) throw new Error("Ese ejercicio ya existe en este día.");

          const { error } = await sb.from("user_day_items").update({ exercise_id, sets, reps, notes }).eq("id", id);
          if (error) throw new Error(error.message);

          setRowMsg("Guardado ✅", "notice");
          editBox.style.display = "none";

          await loadItems();
          await loadStudentMonthOverview();
        } catch (e) {
          setRowMsg(e?.message || String(e), "error");
        }
      }
    });

    itemsList.addEventListener("dragstart", (ev) => {
      if (!_dragAllowed) {
        ev.preventDefault();
        return;
      }
      const item = ev.target?.closest?.(".routine-item");
      if (!item) return;

      _dragEl = item;
      item.classList.add("dragging");

      try {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", item.getAttribute("data-item-id") || "");
      } catch (_) {}
    });

    itemsList.addEventListener("dragend", () => {
      _dragAllowed = false;
      if (_dragEl) _dragEl.classList.remove("dragging");
      _dragEl = null;
    });

    itemsList.addEventListener("dragover", (ev) => {
      if (!_dragEl) return;
      ev.preventDefault();
      const after = getDragAfterElement(itemsList, ev.clientY);
      if (after == null) itemsList.appendChild(_dragEl);
      else itemsList.insertBefore(_dragEl, after);
    });

    itemsList.addEventListener("drop", (ev) => {
      if (!_dragEl) return;
      ev.preventDefault();
      persistReorderFromDom().catch((e) => {
        console.error(e);
        setReorderMsg(e?.message || String(e), "error");
      });
    });
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".routine-item:not(.dragging)")];
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

    for (const child of els) {
      const box = child.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
    }
    return closest.element;
  }

  function updateOrderNumbersFromDom() {
    if (!itemsList) return;
    const els = [...itemsList.querySelectorAll(".routine-item[data-item-id]")];
    els.forEach((el, idx) => {
      const numEl = el.querySelector(".item-order");
      if (numEl) numEl.textContent = `${idx + 1}.`;
    });
  }

  async function persistReorderFromDom() {
    if (!itemsList || !state.user_id || !state.day_id) return;
    const els = [...itemsList.querySelectorAll(".routine-item[data-item-id]")];
    if (!els.length) return;

    setReorderMsg("Guardando orden…", "small");

    // Paso 1: temporales (evita colisiones si hay unique sort_order)
    for (let i = 0; i < els.length; i++) {
      const id = els[i].getAttribute("data-item-id");
      if (!id) continue;
      const tmp = -1000 - i;
      const { error } = await sb.from("user_day_items").update({ sort_order: tmp }).eq("id", id);
      if (error) throw new Error(error.message);
    }

    // Paso 2: orden final
    for (let i = 0; i < els.length; i++) {
      const id = els[i].getAttribute("data-item-id");
      if (!id) continue;
      const finalOrder = i + 1;
      const { error } = await sb.from("user_day_items").update({ sort_order: finalOrder }).eq("id", id);
      if (error) throw new Error(error.message);
    }

    updateOrderNumbersFromDom();
    setReorderMsg("Orden guardado ✅", "notice");
  }

  function buildExerciseOptionsHtml(selectedId) {
    const html = buildExerciseOptgroupsHtml({ selectedId, search: "", showInactive: true });
    return `<option value="">Elegí…</option>` + (html || `<option disabled>(sin ejercicios)</option>`);
  }

  async function loadItems() {
    if (!itemsList) return;

    bindItemsOnce();
    setReorderMsg("");

    if (!state.user_id || !state.day_id) {
      itemsList.innerHTML = `<div class="notice small">Cargá un alumno y un día para ver items.</div>`;
      return;
    }

    itemsList.innerHTML = `<div class="small">Cargando…</div>`;

    await ensureExercisesCache(false);

    const { data, error } = await sb
      .from("user_day_items")
      .select("id, sort_order, sets, reps, notes, exercise_id, exercises:exercise_id (name, video_url, is_active)")
      .eq("user_id", state.user_id)
      .eq("day_id", state.day_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    if (!data?.length) {
      itemsList.innerHTML = `<div class="notice small">Todavía no hay items cargados para este día.</div>`;
      return;
    }

    itemsList.innerHTML = data
      .map((it) => {
        const name = it.exercises?.name || "Ejercicio";
        const video = it.exercises?.video_url
          ? `<a class="small" target="_blank" rel="noopener" href="${esc(it.exercises.video_url)}">Video</a>`
          : `<span class="small">Sin video</span>`;

        const inactiveTag = it.exercises?.is_active === false ? `<span class="small" style="margin-left:8px;opacity:.75">(INACTIVO)</span>` : "";

        const editSelect = buildExerciseOptionsHtml(it.exercise_id);

        return `
          <div class="item routine-item" data-item-id="${esc(it.id)}" draggable="true"
               style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span class="drag-handle" title="Arrastrar para reordenar">≡</span>
              <div>
                <div><span class="item-order"></span> <b>${esc(name)}</b>${inactiveTag}</div>
                <div class="small">${esc(it.sets)}×${esc(it.reps)} ${it.notes ? "· " + esc(it.notes) : ""}</div>
                <div style="margin-top:6px">${video}</div>

                <div data-item-edit="${esc(it.id)}" style="display:none;margin-top:10px" class="card">
                  <div class="small muted">Editar item</div>
                  <div class="form" style="margin-top:10px">
                    <label class="small">Ejercicio</label>
                    <select class="input" data-item-field="exercise_id">${editSelect}</select>

                    <label class="small">Series</label>
                    <input class="input" data-item-field="sets" type="number" min="1" value="${esc(it.sets)}" />

                    <label class="small">Reps</label>
                    <input class="input" data-item-field="reps" type="text" value="${esc(it.reps)}" />

                    <label class="small">Notas</label>
                    <input class="input" data-item-field="notes" type="text" value="${esc(it.notes || "")}" />

                    <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
                      <button class="btn primary" type="button" data-item-act="save-edit" data-item-id="${esc(it.id)}">Guardar</button>
                      <button class="btn" type="button" data-item-act="cancel-edit" data-item-id="${esc(it.id)}">Cancelar</button>
                      <span class="small" data-item-msg="${esc(it.id)}"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button class="btn" type="button" data-item-act="toggle-edit" data-item-id="${esc(it.id)}">Editar</button>
              <button class="btn" type="button" data-item-act="delete" data-item-id="${esc(it.id)}">Eliminar</button>
            </div>
          </div>
        `;
      })
      .join("");

    updateOrderNumbersFromDom();
  }

  refreshItemsBtn?.addEventListener("click", () => loadItems().catch(console.error));

  // =====================================================
  // Biblioteca ejercicios (no colapsa acordeones)
  // =====================================================
  async function createExercise() {
    const name = (exName?.value || "").trim();
    const video_url = (exVideo?.value || "").trim() || null;
    const cues = (exCues?.value || "").trim() || null;

    const objective = (exObjective?.value || "both").trim();
    const track = (exTrack?.value || "gym").trim();
    const muscle_group = (exGroup?.value || "upper").trim();

    if (!name) throw new Error("Falta nombre del ejercicio.");

    const { data: exists, error: exErr } = await sb
      .from("exercises")
      .select("id")
      .ilike("name", name)
      .eq("track", track)
      .eq("objective", objective)
      .eq("is_active", true)
      .limit(1);

    if (exErr) throw new Error(exErr.message);

    if (exists?.length) {
      setMsg(exMsg, "Ya existe un ejercicio con ese nombre para esa modalidad/objetivo.", "error");
      return;
    }

    const { error } = await sb.from("exercises").insert({
      name,
      video_url,
      cues,
      track,
      objective,
      muscle_group,
      is_active: true,
    });

    if (error) throw new Error(error.message);

    setMsg(exMsg, "Ejercicio creado ✅", "notice");

    if (exName) exName.value = "";
    if (exVideo) exVideo.value = "";
    if (exCues) exCues.value = "";

    await loadExercisesLibrary();
    try {
      await loadExercisesDropdown();
    } catch (_) {}
  }

  createExerciseBtn?.addEventListener("click", () => {
    setMsg(exMsg, "");
    createExercise().catch((e) => {
      console.error(e);
      setMsg(exMsg, e?.message || String(e), "error");
    });
  });

  let lastEditedExerciseId = null;

  function snapshotOpenAccordions() {
    const open = new Set();
    exList?.querySelectorAll("details[data-ex-acc-key]").forEach((d) => {
      if (d.open) open.add(d.getAttribute("data-ex-acc-key"));
    });
    return open;
  }

  function restoreOpenAccordions(openSet) {
    if (!openSet) return;
    exList?.querySelectorAll("details[data-ex-acc-key]").forEach((d) => {
      const key = d.getAttribute("data-ex-acc-key");
      d.open = openSet.has(key);
    });
  }

  function reopenExerciseEditorIfAny() {
    if (!lastEditedExerciseId) return;
    const editBox = document.querySelector(`[data-ex-edit="${CSS.escape(lastEditedExerciseId)}"]`);
    if (editBox) editBox.style.display = "block";
  }

  async function loadExercisesLibrary() {
    if (!exList) return;

    const openSet = snapshotOpenAccordions();
    exList.innerHTML = `<div class="small">Cargando…</div>`;

    const { data, error } = await sb
      .from("exercises")
      .select("id,name,track,objective,muscle_group,video_url,cues,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(2000);

    if (error) {
      exList.innerHTML = `<div class="error">${esc(error.message)}</div>`;
      return;
    }

    renderExercisesLibrary(data || []);
    restoreOpenAccordions(openSet);
    reopenExerciseEditorIfAny();
  }

  function renderExercisesLibrary(rows) {
    if (!exList) return;

    const TRACK_LABEL2 = { gym: "Gimnasio", home: "Casa", both: "Ambos", unknown: "Sin modalidad" };
    const MG_LABEL2 = {
      lower: "Tren inferior",
      upper: "Tren superior",
      abs: "Abdominales",
      activation: "Activación",
      cardio: "Cardio",
      unknown: "Sin grupo",
    };

    const trackOrder2 = ["gym", "home", "both", "unknown"];
    const mgOrder2 = ["lower", "upper", "abs", "activation", "cardio", "unknown"];

    const normTrack3 = (v) => (v === "gym" || v === "home" || v === "both" ? v : "unknown");
    const normMG3 = (v) => (v === "lower" || v === "upper" || v === "abs" || v === "activation" || v === "cardio" ? v : "unknown");
    const sel = (v, k) => (String(v || "") === String(k) ? "selected" : "");

    const tree = {};
    for (const e of rows || []) {
      const t = normTrack3(e.track);
      const mg = normMG3(e.muscle_group);
      (((tree[t] ||= {})[mg] ||= [])).push(e);
    }

    const html = trackOrder2
      .filter((t) => tree[t])
      .map((t) => {
        const mgBlocks = mgOrder2
          .filter((mg) => tree[t][mg]?.length)
          .map((mg) => {
            const items = tree[t][mg]
              .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"))
              .map((e) => {
                const id = esc(e.id);
                const name = esc(e.name);
                const video = esc(e.video_url || "");
                const cues = esc(e.cues || "");
                const tVal = normTrack3(e.track);
                const oVal = e.objective || "both";
                const mgVal = normMG3(e.muscle_group);

                return `
                  <div class="item" style="display:grid;gap:10px">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
                      <div>
                        <div><b>${name}</b></div>
                        ${
                          video
                            ? `<a class="small" target="_blank" rel="noopener" href="${video}">Video</a>`
                            : `<span class="small">Sin video</span>`
                        }
                        ${cues ? `<div class="small" style="margin-top:6px;opacity:.9">${cues}</div>` : ""}
                      </div>
                      <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="btn" type="button" data-ex-act="toggle-edit" data-ex-id="${id}">Editar</button>
                        <button class="btn" type="button" data-ex-act="delete" data-ex-id="${id}">Eliminar</button>
                      </div>
                    </div>

                    <div data-ex-edit="${id}" style="display:none" class="card">
                      <div class="small" style="opacity:.8">Editar ejercicio</div>
                      <div class="form" style="margin-top:10px">
                        <label class="small">Nombre</label>
                        <input class="input" data-ex-field="name" value="${name}" />

                        <label class="small">Video URL</label>
                        <input class="input" data-ex-field="video_url" value="${video}" />

                        <label class="small">Cues / técnica</label>
                        <textarea class="input" data-ex-field="cues">${cues}</textarea>

                        <label class="small">Objetivo (metadato)</label>
                        <select class="input" data-ex-field="objective">
                          <option value="fat_loss" ${sel(oVal, "fat_loss")}>Perder grasa</option>
                          <option value="muscle_gain" ${sel(oVal, "muscle_gain")}>Ganar masa</option>
                          <option value="both" ${sel(oVal, "both")}>Ambos</option>
                        </select>

                        <label class="small">Modalidad</label>
                        <select class="input" data-ex-field="track">
                          <option value="gym" ${sel(tVal, "gym")}>Gimnasio</option>
                          <option value="home" ${sel(tVal, "home")}>Casa</option>
                          <option value="both" ${sel(tVal, "both")}>Ambos</option>
                        </select>

                        <label class="small">Grupo muscular</label>
                        <select class="input" data-ex-field="muscle_group">
                          <option value="lower" ${sel(mgVal, "lower")}>Tren inferior</option>
                          <option value="upper" ${sel(mgVal, "upper")}>Tren superior</option>
                          <option value="abs" ${sel(mgVal, "abs")}>Abdominales</option>
                          <option value="activation" ${sel(mgVal, "activation")}>Activación</option>
                          <option value="cardio" ${sel(mgVal, "cardio")}>Cardio</option>
                        </select>

                        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
                          <button class="btn primary" type="button" data-ex-act="save" data-ex-id="${id}">Guardar cambios</button>
                          <button class="btn" type="button" data-ex-act="cancel" data-ex-id="${id}">Cancelar</button>
                          <span class="small" data-ex-msg="${id}"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              })
              .join("");

            return `
              <details class="admin-acc" data-ex-acc-key="t:${esc(t)}|mg:${esc(mg)}" style="margin-top:10px">
                <summary>${esc(MG_LABEL2[mg] || "Ejercicios")}</summary>
                <div class="acc-body" style="padding:12px">
                  <div style="display:grid;gap:10px">${items}</div>
                </div>
              </details>
            `;
          })
          .join("");

        return `
          <details class="admin-acc" data-ex-acc-key="t:${esc(t)}" style="margin-top:10px">
            <summary>${esc(TRACK_LABEL2[t] || "Modalidad")}</summary>
            <div class="acc-body" style="padding:12px">
              ${mgBlocks || `<div class="small" style="opacity:.8">Sin ejercicios.</div>`}
            </div>
          </details>
        `;
      })
      .join("");

    exList.innerHTML = html || `<div class="notice small">Sin ejercicios cargados.</div>`;
  }

  exList?.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("button[data-ex-act]");
    if (!btn) return;

    const act = btn.getAttribute("data-ex-act");
    const id = btn.getAttribute("data-ex-id");
    if (!act || !id) return;

    const editBox = document.querySelector(`[data-ex-edit="${CSS.escape(id)}"]`);
    const msgEl = document.querySelector(`[data-ex-msg="${CSS.escape(id)}"]`);

    const setRowMsg = (t, kind = "small") => {
      if (!msgEl) return;
      msgEl.className = kind;
      msgEl.textContent = t || "";
    };

    if (act === "toggle-edit") {
      if (!editBox) return;
      editBox.style.display = !editBox.style.display || editBox.style.display === "none" ? "block" : "none";
      return;
    }

    if (act === "cancel") {
      if (editBox) editBox.style.display = "none";
      setRowMsg("");
      return;
    }

    if (act === "save") {
      if (!editBox) return;

      const name = (editBox.querySelector('[data-ex-field="name"]')?.value || "").trim();
      const video_url = (editBox.querySelector('[data-ex-field="video_url"]')?.value || "").trim() || null;
      const cues = (editBox.querySelector('[data-ex-field="cues"]')?.value || "").trim() || null;
      const objective = (editBox.querySelector('[data-ex-field="objective"]')?.value || "both").trim();
      const track = (editBox.querySelector('[data-ex-field="track"]')?.value || "both").trim();
      const muscle_group = (editBox.querySelector('[data-ex-field="muscle_group"]')?.value || "upper").trim();

      if (!name) return setRowMsg("Falta nombre.", "error");

      try {
        setRowMsg("Guardando…", "small");

        const { error } = await sb.from("exercises").update({ name, video_url, cues, objective, track, muscle_group }).eq("id", id);
        if (error) throw new Error(error.message);

        lastEditedExerciseId = id;
        await loadExercisesLibrary();
        try {
          await loadExercisesDropdown();
        } catch (_) {}

        setRowMsg("Guardado ✅", "notice");
      } catch (e) {
        setRowMsg(e?.message || String(e), "error");
      }
      return;
    }

    if (act === "delete") {
      if (!confirm("¿Eliminar este ejercicio? (Se desactiva para no romper rutinas ya armadas)")) return;

      try {
        const { error } = await sb.from("exercises").update({ is_active: false }).eq("id", id);
        if (error) throw new Error(error.message);

        setMsg(exMsg, "Ejercicio eliminado (desactivado) ✅", "notice");
        await loadExercisesLibrary();
        try {
          await loadExercisesDropdown();
        } catch (_) {}
      } catch (e) {
        setMsg(exMsg, e?.message || String(e), "error");
      }
    }
  });

  exRefreshBtn?.addEventListener("click", () => loadExercisesLibrary().catch(console.error));

  // =====================================================
  // Alertas
  // =====================================================
  function setAlertTabBadge(n) {
  const tab = document.querySelector('[data-view-tab="view-alertas"]');
  if (!tab) return;

  let b = tab.querySelector(".a360-badge");
  if (!b) {
    b = document.createElement("span");
    b.className = "a360-badge";
    b.style.cssText = `
      display:none;
      margin-left:8px;
      min-width:18px;height:18px;
      padding:0 6px;
      border-radius:999px;
      font-size:11px;
      line-height:18px;
      text-align:center;
      background:rgba(180,35,24,.10);
      border:1px solid rgba(180,35,24,.25);
      color:#b42318;
    `;
    tab.appendChild(b);
  }

  const count = Number(n || 0);
  if (count > 0) {
    b.style.display = "inline-flex";
    b.textContent = count > 9 ? "9+" : String(count);
  } else {
    b.style.display = "none";
    b.textContent = "";
  }
}
async function loadAlerts() {
  if (!alertsList) return;

  alertsList.innerHTML = "";
  setMsg(alertsMsg, "Cargando…", "small");

  const { data, error } = await sb
    .from("admin_alerts")
    .select("id, created_at, user_id, email, kind, message, resolved_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    setAlertsDot(0);
    setAlertTabBadge(0);
    setMsg(alertsMsg, error.message, "error");
    return;
  }

  const n = Array.isArray(data) ? data.length : 0;

  // ✅ indicador en tab
  setAlertsDot(n);
  setAlertTabBadge(n);

  if (!n) {
    setMsg(alertsMsg, "Sin alertas abiertas ✅", "notice");
    return;
  }

  setMsg(alertsMsg, "", "small");

  alertsList.innerHTML = data
    .map(
      (a) => `
        <div class="item">
          <div><b>${esc(a.kind)}</b> · <span class="small">${new Date(a.created_at).toLocaleString()}</span></div>
          <div class="small">${esc(a.email || "sin email")}</div>
          <div class="small" style="margin-top:6px">${esc(a.message)}</div>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
            ${a.email ? `<button class="btn primary" data-open="${esc(a.email)}" type="button">Abrir</button>` : ""}
            <button class="btn" data-resolve="${esc(a.id)}" type="button">Marcar como resuelto</button>
          </div>
        </div>
      `
    )
    .join("");

  alertsList.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.getAttribute("data-open");
      if (!email) return;
      if (studentEmail) studentEmail.value = email;
      await findStudent(email);
    });
  });

  alertsList.querySelectorAll("[data-resolve]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-resolve");
      if (!id) return;

      const userRes = await sb.auth.getUser();
      const myId = userRes?.data?.user?.id || null;

      const { error } = await sb
        .from("admin_alerts")
        .update({ resolved_at: new Date().toISOString(), resolved_by: myId })
        .eq("id", id);

      if (error) return alert(error.message);

      await loadAlerts();
    });
  });
}
 // =====================================================
// Comentarios alumnas (routine_comments)
// - Bandeja (default): solo pendientes (admin_reply IS NULL)
// - Historial: al buscar/abrir alumna, filtra por user_id
// =====================================================
async function loadRoutineComments() {
  if (!routineCommentsList || !routineCommentsMsg) return;

  routineCommentsList.innerHTML = "";
  setMsg(routineCommentsMsg, "Cargando…", "small");

  try {
    // 1) Query base (SIN embed)
    let q = sb
      .from("routine_comments")
      .select("id, created_at, user_id, day_id, message, read_at, admin_reply, replied_at, user_seen_reply_at")
      .order("created_at", { ascending: false });

    // ✅ Bandeja: solo los que NO tienen respuesta
    if (routineCommentsView === "inbox") {
      q = q.is("admin_reply", null).limit(200);
    }

    // ✅ Historial: por alumna
    if (routineCommentsView === "student") {
      if (!routineCommentsStudent.user_id) {
        setMsg(routineCommentsMsg, "Seleccioná una alumna para ver historial.", "notice");
        return;
      }
      q = q.eq("user_id", routineCommentsStudent.user_id).limit(500);
    }

    const { data: comments, error } = await q;
    if (error) throw new Error(error.message);

    const viewTitle =
      routineCommentsView === "student"
        ? `Historial · ${routineCommentsStudent.email || "alumna"}`
        : "Bandeja · Pendientes";

    if (!comments?.length) {
      setMsg(routineCommentsMsg, `${viewTitle}: sin comentarios ✅`, "notice");
      return;
    }

    // 2) Perfiles (email/nombre)
    const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))];
    const profById = {};
    if (userIds.length) {
      const { data: profs, error: pfErr } = await sb
        .from("profiles")
        .select("user_id,email,full_name")
        .in("user_id", userIds);

      if (pfErr) throw new Error(pfErr.message);
      (profs || []).forEach((p) => (profById[p.user_id] = p));
    }

    // 3) Days -> Weeks (Mes/Semana/Día)
    const dayIds = [...new Set(comments.map((c) => c.day_id).filter(Boolean))];
    const dayById = {};
    const weekById = {};

    if (dayIds.length) {
      const { data: days, error: dErr } = await sb
        .from("week_days")
        .select("id, day_number, label, week_id")
        .in("id", dayIds);

      if (dErr) throw new Error(dErr.message);
      (days || []).forEach((d) => (dayById[d.id] = d));

      const weekIds = [...new Set((days || []).map((d) => d.week_id).filter(Boolean))];
      if (weekIds.length) {
        const { data: weeks, error: wErr } = await sb
          .from("weeks")
          .select("id, month_number, week_number")
          .in("id", weekIds);

        if (wErr) throw new Error(wErr.message);
        (weeks || []).forEach((w) => (weekById[w.id] = w));
      }
    }

    setMsg(routineCommentsMsg, `${viewTitle}: ${comments.length}`, "small");

    routineCommentsList.innerHTML = comments
      .map((c) => {
        const p = profById[c.user_id] || {};
        const who = p.email || c.user_id || "—";
        const when = c.created_at ? new Date(c.created_at).toLocaleString("es-AR") : "";
        const read = c.read_at ? `Leído: ${new Date(c.read_at).toLocaleString("es-AR")}` : "No leído";

        const d = dayById[c.day_id] || null;
        const w = d ? weekById[d.week_id] || null : null;

        const dayLabel = d?.label || (d?.day_number ? `Día ${d.day_number}` : "Día —");
        const wkLabel = w ? `Mes ${w.month_number} · Semana ${w.week_number} · ${dayLabel}` : dayLabel;

        const hasReply = !!(c.admin_reply && String(c.admin_reply).trim());
        const replyMeta = hasReply
          ? `Respondido: ${c.replied_at ? new Date(c.replied_at).toLocaleString("es-AR") : "—"}`
          : "Sin respuesta";

        const badgePending =
          !hasReply ? `<span class="small" style="margin-left:8px;color:#b42318">Pendiente</span>` : "";

        return `
          <div class="item">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div style="min-width:0">
                <div><b>${esc(who)}</b> <span class="small muted">${esc(p.full_name || "")}</span>${badgePending}</div>
                <div class="small muted">${esc(when)} · ${esc(read)}</div>
                <div class="small muted" style="margin-top:4px">${esc(wkLabel)} · ${esc(replyMeta)}</div>
              </div>

              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                ${p.email ? `<button class="btn" type="button" data-open-stu="${esc(p.email)}">Abrir alumna</button>` : ""}
                <button class="btn primary" type="button" data-reply-id="${esc(c.id)}">Responder</button>
              </div>
            </div>

            <div class="small" style="margin-top:10px">${esc(c.message || "")}</div>

            <div data-reply-box="${esc(c.id)}" style="display:none;margin-top:10px">
              <textarea class="input" rows="3" placeholder="Escribí la respuesta..." style="width:100%"></textarea>
              <div class="row" style="margin-top:8px;gap:10px;flex-wrap:wrap;align-items:center">
                <button class="btn primary" type="button" data-send-reply="${esc(c.id)}">Enviar respuesta</button>
                <button class="btn" type="button" data-cancel-reply="${esc(c.id)}">Cancelar</button>
                <span class="small" data-reply-msg="${esc(c.id)}"></span>
              </div>
            </div>

            ${hasReply ? `
              <div class="small" style="margin-top:10px;opacity:.9">
                <b>Respuesta:</b> ${esc(c.admin_reply)}
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");

    // Handlers UI
    routineCommentsList.querySelectorAll("[data-open-stu]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.getAttribute("data-open-stu");
        if (!email) return;
        if (studentEmail) studentEmail.value = email;
        await findStudent(email); // esto cambia a historial automáticamente (ver cambio en findStudent)
      });
    });

    routineCommentsList.querySelectorAll("[data-reply-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-reply-id");
        const box = routineCommentsList.querySelector(`[data-reply-box="${CSS.escape(id)}"]`);
        if (!id || !box) return;

        // marcar leído al abrir (resuelve alertas si tu RPC lo hace)
        try { await sb.rpc("admin_mark_routine_comment_read", { p_comment_id: id }); } catch (_) {}

        box.style.display = box.style.display === "none" ? "block" : "none";
      });
    });

    routineCommentsList.querySelectorAll("[data-cancel-reply]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-cancel-reply");
        const box = routineCommentsList.querySelector(`[data-reply-box="${CSS.escape(id)}"]`);
        if (box) box.style.display = "none";
      });
    });

    routineCommentsList.querySelectorAll("[data-send-reply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-send-reply");
        const box = routineCommentsList.querySelector(`[data-reply-box="${CSS.escape(id)}"]`);
        const ta = box?.querySelector("textarea");
        const msgEl = routineCommentsList.querySelector(`[data-reply-msg="${CSS.escape(id)}"]`);

        const replyText = String(ta?.value || "").trim();
        if (!replyText) { if (msgEl) msgEl.textContent = "Escribí una respuesta."; return; }

        if (msgEl) msgEl.textContent = "Enviando…";

        const { data, error: rErr } = await sb.rpc("admin_reply_routine_comment", {
          p_comment_id: id,
          p_reply: replyText
        });

        if (rErr) { if (msgEl) msgEl.textContent = rErr.message; return; }

        // tolera boolean o json {ok:true}
        const ok = (data === true) || (data && data.ok === true);
        if (!ok) { if (msgEl) msgEl.textContent = "No pude enviar la respuesta."; return; }

        if (msgEl) msgEl.textContent = "Enviado ✅";

        // refrescar alertas + lista
        await loadAlerts().catch(() => {});
        await loadRoutineComments();
      });
    });
  } catch (e) {
    console.warn("[ADMIN] loadRoutineComments:", e);
    setMsg(routineCommentsMsg, `No pude leer comentarios: ${e?.message || String(e)}`, "error");
    routineCommentsList.innerHTML = "";
  } finally {
    syncRoutineCommentsViewToggle();
  }
}

// Event delegation (una sola vez)
if (routineCommentsList && !routineCommentsList.__boundRoutineComments) {
  routineCommentsList.__boundRoutineComments = true;

  routineCommentsList.addEventListener("click", async (ev) => {
    const root = ev.target.closest?.('[data-rc]');
    if (!root) return;

    const commentId = root.getAttribute("data-rc");
    if (!commentId) return;

    const openBtn = ev.target.closest?.("[data-rc-open]");
    const toggleBtn = ev.target.closest?.("[data-rc-toggle-reply]");
    const cancelBtn = ev.target.closest?.("[data-rc-cancel-reply]");
    const sendBtn = ev.target.closest?.("[data-rc-send-reply]");
    const markReadBtn = ev.target.closest?.("[data-rc-mark-read]");

    // Abrir alumna
    if (openBtn) {
      const email = openBtn.getAttribute("data-rc-open");
      if (email && studentEmail) studentEmail.value = email;
      if (email) await findStudent(email);
      return;
    }

    const box = root.querySelector("[data-rc-reply-box]");
    const msgEl = root.querySelector("[data-rc-row-msg]");
    const ta = root.querySelector("[data-rc-reply-text]");

    const setRowMsg = (t, kind = "small") => {
      if (!msgEl) return;
      msgEl.className = kind;
      msgEl.textContent = t || "";
    };

    // Toggle responder
    if (toggleBtn) {
      if (!box) return;
      const isOpen = box.style.display !== "none";
      box.style.display = isOpen ? "none" : "block";
      setRowMsg("");
      if (!isOpen) ta?.focus?.();
      return;
    }

    // Cancelar responder
    if (cancelBtn) {
      if (box) box.style.display = "none";
      setRowMsg("");
      return;
    }

    // Marcar leído (sin responder)
    if (markReadBtn) {
      if (!confirm("¿Marcar como leído?")) return;
      try {
        setRowMsg("Marcando…", "small");
        const { data, error } = await sb.rpc("admin_mark_routine_comment_read", {
          p_comment_id: commentId
        });
        if (error) throw new Error(error.message);
        if (!data?.ok) throw new Error("No pude marcar como leído.");
        await loadRoutineComments();
      } catch (e) {
        setRowMsg(e?.message || String(e), "error");
      }
      return;
    }

    // Enviar respuesta
    if (sendBtn) {
      const replyText = (ta?.value || "").trim();
      if (!replyText) return setRowMsg("Escribí una respuesta.", "error");

      try {
        setRowMsg("Enviando…", "small");

        const { data, error } = await sb.rpc("admin_reply_routine_comment", {
  p_comment_id: commentId,
  p_reply: replyText,
});

if (error) throw new Error(error.message);

// acepta json {ok:true} o boolean true o null (si alguna vez devolvés void)
const ok = (data === true) || (data === null) || (data && data.ok === true);
if (!ok) throw new Error((data && data.error) || "No pude enviar la respuesta.");

// ✅ refrescar ambos paneles
await Promise.all([loadRoutineComments(), loadAlerts()]);
      } catch (e) {
        setRowMsg(e?.message || String(e), "error");
      }
      return;
    }
  });
}

routineCommentsRefreshBtn?.addEventListener("click", () => loadRoutineComments().catch(console.error));

  // =====================================================
  // Alumnos: buscar + resumen
  // =====================================================
  async function adminLoadUserSummary(userId) {
    const out = {};

    const { data: planRow } = await sb
      .from("user_plan")
      .select("status, paid_through, plans:plan_id (slug, name)")
      .eq("user_id", userId)
      .maybeSingle();
    if (planRow) out.plan = planRow;

    const { data: prefRow } = await sb.from("user_preferences").select("objective, track").eq("user_id", userId).maybeSingle();
    if (prefRow) out.prefs = prefRow;

   const { data: profRow } = await sb
  .from("profiles")
  .select("full_name, email, phone, age, weight_kg, height_cm, training_level")
  .eq("user_id", userId)
  .maybeSingle();

if (profRow) out.profile = profRow;

    return out;
  }

  async function openStudentAndGoToRoutineEditor(email, opts = {}) {
  const { autoEnterEdit = true, autoLoadFirstDay = true } = opts;

  // 1) buscar alumna (esto setea state, carga months, overview, etc.)
  await openStudentAndGoToRoutineEditor(email, { autoEnterEdit: true, autoLoadFirstDay: true });

  // 2) ir a Rutinas
  window.location.hash = "#view-rutinas";

  // 3) entrar en modo edición + preparar selects
  if (autoEnterEdit) {
    const m = Number(stuMonthSel?.value || 0);
    if (m) state.month = m;

    enterStudentMode();
    syncRoutineBadge();

    // carga semanas/días
    await loadWeeksForMonth(state.month);

    // 4) cargar automáticamente Semana 1 / Día 1 (o el primero que exista)
    if (autoLoadFirstDay) {
      // Semana
      const firstWeek = Number(weekSel?.value || 0) || 1;
      if (weekSel) weekSel.value = String(firstWeek);

      await loadDaysForMonthWeek(state.month, firstWeek);

      // Día (primero disponible en el select)
      const firstDay = Number(daySel?.value || 0) || 1;
      if (daySel) daySel.value = String(firstDay);

      await loadDayForStudent();

      // scroll al editor
      setTimeout(() => {
        const anchor = document.getElementById("sec-editor") || document.getElementById("view-rutinas");
        anchor?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }
}


  async function findStudent(email) {
    const e = (email || "").trim();
    if (!e) return;

    setMsg(studentMsg, "Buscando…", "small");
    setSaveSendMsg("");
    setStudentModeMsg("");
    setRoutineToolsMsg("");
    syncRoutineBadge();

    if (dayEdit) dayEdit.style.display = "none";

    const { data, error } = await sb.rpc("admin_find_user_by_email", { p_email: e });
    if (error) {
      setMsg(studentMsg, error.message, "error");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.user_id) {
      setMsg(studentMsg, "No encontrado.", "error");
      if (studentCard) studentCard.style.display = "none";
      exitStudentMode();
      return;      
    }

    state.user_id = row.user_id;
    state.email = row.email || e;

    setRoutineCommentsViewInbox();

    const sum = await adminLoadUserSummary(state.user_id);

    state.profile = sum.profile || null;
    state.prefs = sum.prefs || null;

    state.objective = sum.prefs?.objective === "muscle_gain" ? "muscle_gain" : "fat_loss";
    state.track = normalizeTrack(sum.prefs?.track) || "gym";

    if (studentEmailOut) studentEmailOut.textContent = state.email;

    const planName = sum.plan?.plans?.name || row.plan_slug || "—";
    const planSlug = sum.plan?.plans?.slug || row.plan_slug || "—";
    const status = sum.plan?.status || row.plan_status || "—";
    const paid = sum.plan?.paid_through || row.paid_through || null;

    if (studentPlanOut) studentPlanOut.textContent = `Plan: ${esc(planName)} (${esc(planSlug)})`;
    if (studentStatusOut) studentStatusOut.textContent = `Estado: ${esc(status)}`;
    if (studentPaidOut) studentPaidOut.textContent = `Pago hasta: ${paid ? esc(new Date(paid).toLocaleDateString("es-AR")) : "—"}`;

    if (stuPrefLine) stuPrefLine.textContent = `Objetivo/Modalidad: ${objLabel(state.objective)} · ${trackLabel(state.track)}`;

    if (studentCard) studentCard.style.display = "block";
    setMsg(studentMsg, "Encontrado ✅", "notice");

    await loadMonthsIntoStudentSelect();
    state.month = Number(stuMonthSel?.value || 0) || null;
    syncRoutineBadge();

    await loadStudentMonthOverview();

    // Herramientas: semanas del mes actual
    if (state.month) await fillDupWeekSelects(state.month).catch(() => {});
    // ✅ Al buscar alumna, mostrar historial en panel de comentarios
setRoutineCommentsViewStudent(state.user_id, state.email);
loadRoutineComments().catch(() => {});
  }

  findStudentBtn?.addEventListener("click", () => {
    const email = (studentEmail?.value || "").trim();
    if (!email) return setMsg(studentMsg, "Ingresá un email.", "error");

    findStudent(email).catch((e) => {
      console.error(e);
      setMsg(studentMsg, e?.message || String(e), "error");
    });
  });

  stuMonthSel?.addEventListener("change", () => {
    const m = Number(stuMonthSel.value || 0);
    state.month = m || null;
    syncRoutineBadge();

    // Herramientas
    if (dupMonthFrom) dupMonthFrom.value = String(m || "");
    if (dupMonthTo) dupMonthTo.value = String(m || "");
    if (state.month) fillDupWeekSelects(state.month).catch(console.error);

    loadStudentMonthOverview().catch(console.error);
  });

  editStudentModeBtn?.addEventListener("click", async () => {
    if (!state.user_id) return alert("Primero buscá un alumno.");
    const m = Number(stuMonthSel?.value || 0);
    if (!m) return alert("Elegí un mes.");
    state.month = m;

    enterStudentMode();
    setSaveSendMsg("");
    syncRoutineBadge();

    await loadWeeksForMonth(state.month);
    if (state.month) await fillDupWeekSelects(state.month).catch(() => {});
    setMsg(selMsg, "Elegí semana y día para cargar.", "small");
  });

  exitStudentModeBtn?.addEventListener("click", () => exitStudentMode());

  // =====================================================
  // Overview: rutina del mes (conteos por user_day_items)
  // =====================================================
  async function loadStudentMonthOverview() {
    if (!stuRoutineBox || !stuRoutineMsg || !stuRoutineMeta) return;

    stuRoutineBox.innerHTML = "";
    setMsg(stuRoutineMsg, "", "small");

    if (!state.user_id || !state.month) {
      stuRoutineMeta.textContent = "Seleccioná un alumno y un mes.";
      return;
    }

    setMsg(stuRoutineMsg, "Cargando mes…", "small");
const p = state.profile || {};
const prefs = state.prefs || {};

const fullName = p.full_name ? esc(p.full_name) : "—";
const phone = p.phone ? esc(p.phone) : "—";
const age = (p.age ?? "") !== "" && p.age != null ? esc(p.age) : "—";
const weight = (p.weight_kg ?? "") !== "" && p.weight_kg != null ? esc(p.weight_kg) : "—";
const height = (p.height_cm ?? "") !== "" && p.height_cm != null ? esc(p.height_cm) : "—";
const level = p.training_level ? esc(p.training_level) : "—";

const obj = objLabel(state.objective);
const trk = trackLabel(state.track);

stuRoutineMeta.innerHTML = `
  <div><b>Mes:</b> ${esc(state.month)} · <b>Objetivo:</b> ${esc(obj)} · <b>Modalidad:</b> ${esc(trk)}</div>
  <div style="margin-top:6px">
    <b>Ficha:</b> ${fullName} · Tel: ${phone} · Edad: ${age} · Peso: ${weight}kg · Altura: ${height}cm · Nivel: ${level}
  </div>
`;
    const { data: weeksRows, error: wErr } = await sb
      .from("weeks")
      .select("id,week_number,title")
      .eq("month_number", state.month)
      .order("week_number", { ascending: true });

    if (wErr) return setMsg(stuRoutineMsg, wErr.message, "error");
    if (!weeksRows?.length) return setMsg(stuRoutineMsg, "No hay semanas para este mes.", "notice");

    const weekIds = weeksRows.map((w) => w.id);

    const { data: daysRows, error: dErr } = await sb
      .from("week_days")
      .select("id,week_id,day_number,label,muscle_group,focus")
      .in("week_id", weekIds)
      .order("day_number", { ascending: true });

    if (dErr) return setMsg(stuRoutineMsg, dErr.message, "error");

    const dayIds = (daysRows || []).map((d) => d.id);
    if (!dayIds.length) return setMsg(stuRoutineMsg, "No hay días para este mes.", "notice");

    const { data: itemsRows, error: iErr } = await sb
      .from("user_day_items")
      .select("day_id")
      .eq("user_id", state.user_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .in("day_id", dayIds);

    if (iErr) return setMsg(stuRoutineMsg, iErr.message, "error");

    const countByDay = {};
    for (const it of itemsRows || []) countByDay[it.day_id] = (countByDay[it.day_id] || 0) + 1;

    const weekNumById = {};
    for (const w of weeksRows) weekNumById[w.id] = w.week_number;

    const grouped = {};
    for (const d of daysRows || []) {
      const wn = weekNumById[d.week_id] || 0;
      (grouped[wn] ||= []).push(d);
    }

    setMsg(stuRoutineMsg, `Items cargados en el mes: ${(itemsRows || []).length}`, "notice");

    const DAY_NAMES = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };

    stuRoutineBox.innerHTML = [1, 2, 3, 4]
      .map((wn) => {
        const days = grouped[wn] || [];
        if (!days.length) return "";

        const daysHtml = days
          .map((d) => {
            const cnt = countByDay[d.id] || 0;
            const dayName = DAY_NAMES[d.day_number] || `Día ${d.day_number}`;
            const subtitle = `${cnt} item(s) · ${d.muscle_group || "—"}${d.focus ? ` · ${d.focus}` : ""}`;

            return `
              <div class="item" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
                <div>
                  <div><b>${esc(dayName)}</b> <span class="small" style="opacity:.8">${esc(d.label || "")}</span></div>
                  <div class="small" style="margin-top:4px;opacity:.9">${esc(subtitle)}</div>
                </div>
                <button class="btn primary" type="button" data-edit-week="${esc(wn)}" data-edit-day="${esc(d.day_number)}">Editar</button>
              </div>
            `;
          })
          .join("");

        return `
          <details class="admin-acc" style="margin-top:10px" ${wn === 1 ? "open" : ""}>
            <summary>Semana ${esc(wn)}</summary>
            <div class="acc-body" style="display:grid;gap:10px">
              ${daysHtml}
            </div>
          </details>
        `;
      })
      .join("");

    stuRoutineBox.querySelectorAll("[data-edit-week]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (state.mode !== "student") {
          enterStudentMode();
          await loadWeeksForMonth(state.month);
          if (state.month) await fillDupWeekSelects(state.month).catch(() => {});
        }

        const w = Number(btn.getAttribute("data-edit-week") || 0);
        const d = Number(btn.getAttribute("data-edit-day") || 0);

        if (weekSel) weekSel.value = String(w);
        await loadDaysForMonthWeek(state.month, w);
        if (daySel) daySel.value = String(d);

        await loadDayForStudent();
        dayTitle?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  openStudentCaseBtn?.addEventListener("click", () => loadStudentMonthOverview().catch(console.error));

  // =====================================================
  // Guardar y enviar rutina (publica sin retardo) — RPC security definer
  // =====================================================
  async function countItemsForMonth() {
    const { data: weeksRows, error: wErr } = await sb.from("weeks").select("id").eq("month_number", state.month);
    if (wErr) throw new Error(wErr.message);

    const weekIds = (weeksRows || []).map((w) => w.id);
    if (!weekIds.length) return 0;

    const { data: daysRows, error: dErr } = await sb.from("week_days").select("id").in("week_id", weekIds);
    if (dErr) throw new Error(dErr.message);

    const dayIds = (daysRows || []).map((d) => d.id);
    if (!dayIds.length) return 0;

    const { count, error: cErr } = await sb
      .from("user_day_items")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", state.user_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .in("day_id", dayIds);

    if (cErr) throw new Error(cErr.message);
    return Number(count || 0);
  }

  async function saveAndSendRoutine() {
    try {
      if (!state.user_id || !state.email) return alert("Primero buscá un alumno.");
      if (!state.month) return alert("Elegí un mes.");
      if (state.mode !== "student") return alert("Entrá a: Editar rutina de este alumno.");

      setSaveSendMsg("Validando…", "small");

      const total = await countItemsForMonth();
      if (total <= 0) {
        const ok = confirm("Este mes no tiene ejercicios cargados.\n\n¿Querés enviar igual?");
        if (!ok) {
          setSaveSendMsg("Cancelado.", "small");
          return;
        }
      }

      setSaveSendMsg("Publicando rutina…", "small");

      const { data: pub, error: pubErr } = await sb.rpc("admin_publish_routine", { p_user_id: state.user_id });
      if (pubErr) throw new Error(pubErr.message);
      if (!pub?.ok) throw new Error("No pude publicar la rutina.");

      const subject = "Ya está lista tu rutina ✅";
      const body = [
        "Hola!",
        "",
        "Ya está lista tu rutina 100% personalizada.",
        "Ingresá a tu campus virtual para verla:",
        "https://www.maricelconse.com.ar/app.html",
        "",
        "— Maricel Conse · Academia de Mujeres",
      ];
      safeOpenMailto(buildMailto(state.email, subject, body));

      setSaveSendMsg("Guardado y enviado ✅", "notice");

      await loadAlerts().catch(() => {});
      await loadStudentMonthOverview().catch(() => {});
    } catch (e) {
      console.error("[ADMIN] saveAndSendRoutine error:", e);
      setSaveSendMsg(e?.message || String(e), "error");
      alert(e?.message || String(e));
    }
  }

  saveSendRoutineBtn?.addEventListener("click", saveAndSendRoutine);
  saveSendRoutineBtnTop?.addEventListener("click", saveAndSendRoutine);

  // =====================================================
  // Herramientas de rutina: duplicar semana/mes + importar
  // =====================================================
  async function loadWeeksMetaForMonth(month) {
    const { data, error } = await sb.from("weeks").select("week_number,title").eq("month_number", month).order("week_number", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function fillDupWeekSelects(month) {
    if (!dupWeekFrom || !dupWeekTo) return;

    dupWeekFrom.innerHTML = `<option value="">Cargando…</option>`;
    dupWeekTo.innerHTML = `<option value="">Cargando…</option>`;

    const weeks = await loadWeeksMetaForMonth(month);
    if (!weeks.length) {
      dupWeekFrom.innerHTML = `<option value="">Sin semanas</option>`;
      dupWeekTo.innerHTML = `<option value="">Sin semanas</option>`;
      return;
    }

    const opts = weeks
      .map((w) => `<option value="${esc(w.week_number)}">Semana ${esc(w.week_number)}${w.title ? ` — ${esc(w.title)}` : ""}</option>`)
      .join("");

    dupWeekFrom.innerHTML = opts;
    dupWeekTo.innerHTML = opts;

    dupWeekFrom.value = String(weeks[0].week_number);
    dupWeekTo.value = String(weeks.length > 1 ? weeks[1].week_number : weeks[0].week_number);
  }

  async function getMonthMaps(month) {
    const { data: weeks, error: wErr } = await sb
      .from("weeks")
      .select("id, week_number")
      .eq("month_number", month)
      .order("week_number", { ascending: true });

    if (wErr) throw new Error(wErr.message);

    const weekIds = (weeks || []).map((w) => w.id);
    if (!weekIds.length) return { dayIdByWeekDay: {} };

    const { data: days, error: dErr } = await sb.from("week_days").select("id, week_id, day_number").in("week_id", weekIds);
    if (dErr) throw new Error(dErr.message);

    const weekNumById = {};
    for (const w of weeks || []) weekNumById[w.id] = w.week_number;

    const dayIdByWeekDay = {};
    for (const d of days || []) {
      const wn = weekNumById[d.week_id];
      if (!wn) continue;
      dayIdByWeekDay[`${wn}:${d.day_number}`] = d.id;
    }

    return { dayIdByWeekDay };
  }

  async function fetchItemsForDay(userId, dayId) {
    const { data, error } = await sb
      .from("user_day_items")
      .select("exercise_id, sets, reps, notes, sort_order")
      .eq("user_id", userId)
      .eq("day_id", dayId)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async function deleteItemsForDay(dayId) {
    const { error } = await sb
      .from("user_day_items")
      .delete()
      .eq("user_id", state.user_id)
      .eq("day_id", dayId)
      .eq("objective", state.objective)
      .eq("track", state.track);

    if (error) throw new Error(error.message);
  }

  async function insertItemsForDay(dayId, items) {
    if (!items?.length) return;

    const payload = items.map((it, idx) => ({
      user_id: state.user_id,
      day_id: dayId,
      objective: state.objective,
      track: state.track,
      exercise_id: it.exercise_id,
      sets: it.sets,
      reps: it.reps,
      notes: it.notes || null,
      sort_order: idx + 1,
    }));

    const { error } = await sb.from("user_day_items").insert(payload);
    if (error) throw new Error(error.message);
  }

  async function duplicateWeekInMonth(fromWeek, toWeek) {
    if (!state.user_id || !state.month) throw new Error("Primero abrí una alumna y elegí mes.");
    if (!fromWeek || !toWeek) throw new Error("Elegí semana origen y destino.");
    if (Number(fromWeek) === Number(toWeek)) throw new Error("Origen y destino no pueden ser iguales.");

    const ok = confirm(`Esto REEMPLAZA los ejercicios en Semana ${toWeek} (Mes ${state.month}).\n\n¿Continuar?`);
    if (!ok) return;

    setRoutineToolsMsg("Duplicando semana…", "small");

    const maps = await getMonthMaps(state.month);
    const dayNumbers = [1, 2, 3, 4, 5];

    for (const dn of dayNumbers) {
      const srcDayId = maps.dayIdByWeekDay[`${fromWeek}:${dn}`];
      const dstDayId = maps.dayIdByWeekDay[`${toWeek}:${dn}`];
      if (!srcDayId || !dstDayId) continue;

      const srcItems = await fetchItemsForDay(state.user_id, srcDayId);
      await deleteItemsForDay(dstDayId);
      await insertItemsForDay(dstDayId, srcItems);
    }

    setRoutineToolsMsg("Semana duplicada ✅", "notice");
    await loadStudentMonthOverview().catch(() => {});
    if (state.day_id) await loadItems().catch(() => {});
  }

  async function duplicateMonth(fromMonth, toMonth) {
    if (!state.user_id) throw new Error("Primero abrí una alumna.");
    if (!fromMonth || !toMonth) throw new Error("Elegí mes origen y destino.");
    if (Number(fromMonth) === Number(toMonth)) throw new Error("Origen y destino no pueden ser iguales.");

    const ok = confirm(`Esto REEMPLAZA el Mes ${toMonth} copiando desde Mes ${fromMonth}.\n\n¿Continuar?`);
    if (!ok) return;

    setRoutineToolsMsg("Duplicando mes…", "small");

    const fromMaps = await getMonthMaps(Number(fromMonth));
    const toMaps = await getMonthMaps(Number(toMonth));

    const destDayIds = Object.values(toMaps.dayIdByWeekDay);
    if (destDayIds.length) {
      const { error: delErr } = await sb
        .from("user_day_items")
        .delete()
        .eq("user_id", state.user_id)
        .eq("objective", state.objective)
        .eq("track", state.track)
        .in("day_id", destDayIds);

      if (delErr) throw new Error(delErr.message);
    }

    for (const key of Object.keys(fromMaps.dayIdByWeekDay)) {
      const srcDayId = fromMaps.dayIdByWeekDay[key];
      const dstDayId = toMaps.dayIdByWeekDay[key];
      if (!srcDayId || !dstDayId) continue;

      const srcItems = await fetchItemsForDay(state.user_id, srcDayId);
      await insertItemsForDay(dstDayId, srcItems);
    }

    setRoutineToolsMsg("Mes duplicado ✅", "notice");
    if (state.month === Number(toMonth)) await loadStudentMonthOverview().catch(() => {});
  }

  async function importRoutineFromEmail(email) {
    const srcEmail = (email || "").trim();
    if (!srcEmail) throw new Error("Ingresá el email del usuario origen.");
    if (!state.user_id || !state.month) throw new Error("Primero abrí una alumna y elegí mes.");

    const ok = confirm(`Esto REEMPLAZA la rutina del Mes ${state.month} del alumno actual copiando desde:\n${srcEmail}\n\n¿Continuar?`);
    if (!ok) return;

    setRoutineToolsMsg("Importando rutina…", "small");

    const { data, error } = await sb.rpc("admin_find_user_by_email", { p_email: srcEmail });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const srcUserId = row?.user_id;
    if (!srcUserId) throw new Error("No encontré el usuario origen.");

    const maps = await getMonthMaps(state.month);
    const dayIds = Object.values(maps.dayIdByWeekDay);
    if (!dayIds.length) throw new Error("No pude resolver días del mes.");

    const { data: srcItems, error: sErr } = await sb
      .from("user_day_items")
      .select("day_id, exercise_id, sets, reps, notes, sort_order")
      .eq("user_id", srcUserId)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .in("day_id", dayIds);

    if (sErr) throw new Error(sErr.message);
    if (!srcItems?.length) throw new Error("El usuario origen no tiene items en este mes (para objetivo/modalidad).");

    const { error: delErr } = await sb
      .from("user_day_items")
      .delete()
      .eq("user_id", state.user_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .in("day_id", dayIds);

    if (delErr) throw new Error(delErr.message);

    const byDay = {};
    for (const it of srcItems || []) (byDay[it.day_id] ||= []).push(it);

    for (const dayIdStr of Object.keys(byDay)) {
      const items = byDay[dayIdStr].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      await insertItemsForDay(dayIdStr, items);
    }

    setRoutineToolsMsg("Rutina importada ✅", "notice");
    await loadStudentMonthOverview().catch(() => {});
    if (state.day_id) await loadItems().catch(() => {});
  }

  dupWeekBtn?.addEventListener("click", () => {
    setRoutineToolsMsg("");
    duplicateWeekInMonth(Number(dupWeekFrom?.value || 0), Number(dupWeekTo?.value || 0)).catch((e) => setRoutineToolsMsg(e?.message || String(e), "error"));
  });

  dupMonthBtn?.addEventListener("click", () => {
    setRoutineToolsMsg("");
    duplicateMonth(Number(dupMonthFrom?.value || 0), Number(dupMonthTo?.value || 0)).catch((e) => setRoutineToolsMsg(e?.message || String(e), "error"));
  });

  importRoutineBtn?.addEventListener("click", () => {
    setRoutineToolsMsg("");
    importRoutineFromEmail(importFromEmail?.value || "").catch((e) => setRoutineToolsMsg(e?.message || String(e), "error"));
  });

  // =====================================================
  // Premium — Storage + Recorded/Live (tu implementación original)
  // =====================================================
  async function uploadCoverIfAny() {
    const file = rcCoverFile?.files?.[0];
    if (!file) return (rcCoverUrl?.value || "").trim() || null;

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `covers/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const up = await sb.storage.from("class_covers").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (up.error) throw new Error(up.error.message);

    const pub = sb.storage.from("class_covers").getPublicUrl(path);
    return pub.data?.publicUrl || null;
  }

  function monthFromDateInput(d) {
    if (!d) return null;
    const m = Number(String(d).split("-")[1] || "");
    return m >= 1 && m <= 12 ? m : null;
  }

  async function saveRecordedClass() {
    setMsg(rcMsg, "Guardando…", "small");

    const month = Number(rcMonth?.value || 0) || monthFromDateInput(rcDate?.value) || null;
    const date = rcDate?.value || null;
    const title = (rcTitle?.value || "").trim();
    const topic = (rcTopic?.value || "").trim();
    const youtube_url = (rcYoutube?.value || "").trim();
    const notes = (rcNotes?.value || "").trim() || null;

    if (!month) throw new Error("Falta mes.");
    if (!date) throw new Error("Falta fecha.");
    if (!title) throw new Error("Falta título.");
    if (!topic) throw new Error("Falta temática.");
    if (!youtube_url) throw new Error("Falta URL de YouTube.");

    const cover_url = await uploadCoverIfAny();

    const { data: me } = await sb.auth.getUser();
    const created_by = me?.user?.id || null;

    const ins = await sb.from("recorded_classes").insert({
      month_number: month,
      class_date: date,
      title,
      topic,
      youtube_url,
      cover_url,
      notes,
      created_by,
    });

    if (ins.error) throw new Error(ins.error.message);

    setMsg(rcMsg, "Clase grabada guardada ✅", "notice");
    if (rcCoverFile) rcCoverFile.value = "";
    if (rcCoverUrl) rcCoverUrl.value = "";
    if (rcNotes) rcNotes.value = "";

    await loadRecordedClasses();
  }

  async function loadRecordedClasses() {
    if (!rcList) return;

    rcList.innerHTML = `<div class="small">Cargando…</div>`;

    const { data, error } = await sb
      .from("recorded_classes")
      .select("id, month_number, class_date, title, topic, youtube_url, cover_url, notes")
      .order("class_date", { ascending: false });

    if (error) {
      rcList.innerHTML = `<div class="error">${esc(error.message)}</div>`;
      return;
    }

    if (!data?.length) {
      rcList.innerHTML = `<div class="notice small">Sin clases grabadas.</div>`;
      return;
    }

    rcList.innerHTML = data
      .map(
        (c) => `
        <div class="item" style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between">
          <div style="display:flex;gap:12px;align-items:flex-start">
            ${c.cover_url ? `<img src="${esc(c.cover_url)}" alt="cover" style="width:64px;height:64px;object-fit:cover;border-radius:12px">` : ""}
            <div>
              <div><b>${esc(c.title)}</b></div>
              <div class="small">${esc(c.topic)} · ${esc(c.class_date)} · Mes ${esc(c.month_number)}</div>
              ${c.notes ? `<div class="small" style="margin-top:6px;opacity:.9">${esc(c.notes)}</div>` : ""}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <a class="btn" target="_blank" rel="noopener" href="${esc(c.youtube_url)}">Abrir</a>
            <button class="btn" type="button" data-rc-del="${esc(c.id)}">Eliminar</button>
          </div>
        </div>
      `
      )
      .join("");

    rcList.querySelectorAll("[data-rc-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-rc-del");
        if (!id) return;
        if (!confirm("¿Eliminar esta clase grabada?")) return;

        const del = await sb.from("recorded_classes").delete().eq("id", id);
        if (del.error) return alert(del.error.message);

        await loadRecordedClasses();
      });
    });
  }

  function setLiveCoverPreview(url) {
    if (!lcCoverPreview) return;
    if (!url) {
      lcCoverPreview.style.display = "none";
      lcCoverPreview.removeAttribute("src");
      return;
    }
    lcCoverPreview.src = url;
    lcCoverPreview.style.display = "block";
  }

  async function uploadLiveCoverIfAny() {
    const file = lcCoverFile?.files?.[0];
    if (!file) return (lcCoverUrl?.value || "").trim() || null;

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `live/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const up = await sb.storage.from("class_covers").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (up.error) throw new Error(up.error.message);

    const pub = sb.storage.from("class_covers").getPublicUrl(path);
    return pub.data?.publicUrl || null;
  }

  function dtLocalArgentinaToIso(dtLocal) {
    const v = String(dtLocal || "").trim();
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) throw new Error("Fecha/hora inválida.");

    const isoWithOffset = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || "00"}-03:00`;
    const d = new Date(isoWithOffset);
    if (Number.isNaN(d.getTime())) throw new Error("No pude interpretar fecha/hora AR.");
    return d.toISOString();
  }

  function monthFromDtLocal(dtLocal) {
    const v = String(dtLocal || "").trim();
    const m = Number(v.slice(5, 7));
    return m >= 1 && m <= 12 ? m : null;
  }

  const AR_TZ = "America/Argentina/Buenos_Aires";
  function fmtArgentinaDateTime(iso) {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("es-AR", {
        timeZone: AR_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch (_) {
      return String(iso || "");
    }
  }

  async function saveLiveClass() {
    setMsg(lcMsg, "Guardando…", "small");

    const startsLocal = (lcStartsAt?.value || "").trim();
    const title = (lcTitle?.value || "").trim();
    const topic = (lcTopic?.value || "").trim();
    const zoom = (lcZoom?.value || "").trim();
    const pass = (lcPasscode?.value || "").trim() || null;
    const reminder = Number(lcReminderMin?.value || 60);

    if (!startsLocal) throw new Error("Falta fecha/hora.");
    if (!title) throw new Error("Falta título.");
    if (!topic) throw new Error("Falta temática.");
    if (!zoom) throw new Error("Falta link Zoom.");

    const starts_at_iso = dtLocalArgentinaToIso(startsLocal);
    const month_number = monthFromDtLocal(startsLocal);
    if (!month_number) throw new Error("No pude resolver el mes.");

    const cover_url = await uploadLiveCoverIfAny();

    const { data: me } = await sb.auth.getUser();
    const created_by = me?.user?.id || null;

    const ins = await sb.from("live_classes").insert({
      title,
      topic,
      starts_at: starts_at_iso,
      zoom_join_url: zoom,
      zoom_passcode: pass,
      month_number,
      reminder_minutes_before: reminder,
      status: "scheduled",
      created_by,
      cover_url,
    });

    if (ins.error) throw new Error(ins.error.message);

    setMsg(lcMsg, "Clase en vivo publicada ✅", "notice");

    if (lcCoverFile) lcCoverFile.value = "";
    if (lcCoverUrl) lcCoverUrl.value = "";
    setLiveCoverPreview("");

    await loadLiveClassesAdmin();
  }

  async function loadLiveClassesAdmin() {
    if (!lcList) return;

    lcList.innerHTML = `<div class="small">Cargando…</div>`;

    const { data, error } = await sb
      .from("live_classes")
      .select("id, title, topic, starts_at, zoom_join_url, zoom_passcode, reminder_minutes_before, reminded_at, status, cover_url")
      .order("starts_at", { ascending: true })
      .limit(50);

    if (error) {
      lcList.innerHTML = `<div class="error">${esc(error.message)}</div>`;
      return;
    }

    if (!data?.length) {
      lcList.innerHTML = `<div class="notice small">No hay clases en vivo cargadas.</div>`;
      return;
    }

    lcList.innerHTML = data
      .map(
        (c) => `
        <div class="item" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div style="display:flex;gap:12px;align-items:flex-start">
            ${c.cover_url ? `<img src="${esc(c.cover_url)}" alt="cover" style="width:64px;height:64px;object-fit:cover;border-radius:12px">` : ""}
            <div>
              <div><b>${esc(c.title)}</b></div>
              <div class="small">${esc(c.topic)} · ${esc(fmtArgentinaDateTime(c.starts_at))} (AR)</div>
              <div class="small" style="margin-top:6px;opacity:.9">
                Reminder: ${esc(c.reminder_minutes_before)} min · Estado: ${esc(c.status || "")}
                ${c.reminded_at ? ` · Recordatorio enviado: ${esc(fmtArgentinaDateTime(c.reminded_at))} (AR)` : ""}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <a class="btn" target="_blank" rel="noopener" href="${esc(c.zoom_join_url)}">Zoom</a>
            <button class="btn" type="button" data-lc-del="${esc(c.id)}">Eliminar</button>
          </div>
        </div>
      `
      )
      .join("");

    lcList.querySelectorAll("[data-lc-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-lc-del");
        if (!id) return;
        if (!confirm("¿Eliminar esta clase en vivo?")) return;

        const del = await sb.from("live_classes").delete().eq("id", id);
        if (del.error) return alert(del.error.message);

        await loadLiveClassesAdmin();
      });
    });
  }

  rcSaveBtn?.addEventListener("click", () => saveRecordedClass().catch((e) => setMsg(rcMsg, e?.message || String(e), "error")));
  rcRefreshBtn?.addEventListener("click", () => loadRecordedClasses().catch(console.error));

  lcSaveBtn?.addEventListener("click", () => saveLiveClass().catch((e) => setMsg(lcMsg, e?.message || String(e), "error")));
  lcRefreshBtn?.addEventListener("click", () => loadLiveClassesAdmin().catch(console.error));

  lcCoverUrl?.addEventListener("input", () => setLiveCoverPreview((lcCoverUrl.value || "").trim()));
  lcCoverFile?.addEventListener("change", () => {
    const f = lcCoverFile.files?.[0];
    if (!f) return setLiveCoverPreview("");
    setLiveCoverPreview(URL.createObjectURL(f));
  });

  // =====================================================
  // Init
  // =====================================================
  (async function init() {
    try {
      const ok = await ensureAdminSession();
      if (!ok) return;

      exitStudentMode();
      ensureRoutineCommentsViewToggle();

      // Módulos “seguros”
      await loadKPIs().catch(console.error);
      await loadPlansIntoActiveUsersFilter().catch(console.error);
      await loadActiveUsers().catch(console.error);

      await loadExercisesLibrary().catch(console.error);

      await loadAlerts().catch(console.error);
      await loadRoutineComments().catch(() => {});

      await loadRecordedClasses().catch(console.error);
      await loadLiveClassesAdmin().catch(console.error);

      initWeeklyQuoteAdmin();

      // Dropdown ejercicios: listo aunque no haya alumna (cache)
      await loadExercisesDropdown().catch(() => {});

      console.log("[ADMIN] Ready ✅");
    } catch (e) {
      console.error("[ADMIN] init crash:", e);
      alert(e?.message || String(e));
    }
  })();
})();