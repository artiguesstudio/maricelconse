// admin.js — flujo manual por alumna (limpio)
// Mantiene: KPIs, Frase semanal, Premium, Ejercicios, Editor del día, Alumnos, Alertas
// Agrega: Usuarios activos + Mes a editar + Guardar y enviar rutina (publica rutina sin retardo)
// Mejora: Biblioteca de ejercicios NO colapsa acordeones al editar
// FIX: loadPlansIntoActiveUsersFilter definido como function (hoisting OK)
// FIX: Dropdown de ejercicios muestra TODOS (activos e inactivos), inactivos quedan deshabilitados
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
  const trackLabel = (v) => (v === "home" ? "Casa" : "Gimnasio");

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

  const exerciseSel = $("exerciseSel");
  const setsInp = $("setsInp");
  const repsInp = $("repsInp");
  const notesInp = $("notesInp");
  const addItemBtn = $("addItemBtn");
  const itemMsg = $("itemMsg");
  const itemsList = $("itemsList");
  const refreshItemsBtn = $("refreshItemsBtn");

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
  // Weekly Quote Admin
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
  };

  function setStudentModeMsg(t, kind = "small") {
    if (!studentModeMsg) return;
    studentModeMsg.className = kind;
    studentModeMsg.textContent = t || "";
  }

  function setSaveSendMsg(t, kind = "small") {
    if (!saveSendRoutineMsg) return;
    saveSendRoutineMsg.className = kind;
    saveSendRoutineMsg.textContent = t || "";
  }

  function setEditorHint(t) {
    if (!editorHint) return;
    editorHint.textContent = t || "";
  }

  function enterStudentMode() {
    state.mode = "student";
    setStudentModeMsg("Modo alumno ✅ Editando rutina personalizada.", "notice");

    if (exitStudentModeBtn) exitStudentModeBtn.style.display = "inline-flex";
    if (editStudentModeBtn) editStudentModeBtn.style.display = "none";
    if (saveSendRoutineBtn) saveSendRoutineBtn.style.display = "inline-flex";

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

    setStudentModeMsg("");
    setSaveSendMsg("");
    setEditorHint("Primero buscá un alumno y elegí mes.");

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
      const { data, error } = await sb
        .from("plans")
        .select("slug,name")
        .order("id", { ascending: true });

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

    // Nota: esto lista "status=active" en user_plan (si querés "pagos aprobados" aunque status!=active,
    // lo ideal es apuntar a una VIEW/RPC que use mp_payments / routine_delivery / mp_subscriptions).
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

    const { data: profRows, error: pfErr } = await sb
      .from("profiles")
      .select("user_id,email,full_name")
      .in("user_id", userIds);

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
        if (studentEmail) studentEmail.value = email;
        await findStudent(email);

        const secAlu = document.getElementById("sec-alumnos");
        if (secAlu?.tagName === "DETAILS") secAlu.open = true;
        studentCard?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    const { data, error } = await sb
      .from("program_months")
      .select("month_number,title")
      .order("month_number", { ascending: true });

    if (error) {
      stuMonthSel.innerHTML = `<option value="">Error</option>`;
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      stuMonthSel.innerHTML = `<option value="">Sin meses</option>`;
      return;
    }

    stuMonthSel.innerHTML = rows
      .map(
        (m) =>
          `<option value="${esc(m.month_number)}">Mes ${esc(m.month_number)} — ${esc(m.title || "")}</option>`
      )
      .join("");

    const nowM = new Date().getMonth() + 1;
    const hasNow = rows.some((x) => Number(x.month_number) === nowM);
    stuMonthSel.value = hasNow ? String(nowM) : String(rows[0].month_number);
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
      .map(
        (w) =>
          `<option value="${esc(w.week_number)}">Semana ${esc(w.week_number)}${w.title ? ` — ${esc(w.title)}` : ""}</option>`
      )
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

    const { data, error } = await sb
      .from("week_days")
      .select("day_number,label")
      .eq("week_id", w.id)
      .order("day_number", { ascending: true });

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
      .map(
        (d) =>
          `<option value="${esc(d.day_number)}">Día ${esc(d.day_number)}${d.label ? ` — ${esc(d.label)}` : ""}</option>`
      )
      .join("");

    daySel.value = String(rows[0].day_number);
  }

  weekSel?.addEventListener("change", async () => {
    if (!state.month) return;
    await loadDaysForMonthWeek(state.month, Number(weekSel.value || 0));
  });

  // =====================================================
  // Editor: cargar día (siempre user_day_items)
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

    await loadExercisesDropdown(); // <-- FIX: ahora trae TODOS (100), inactivos deshabilitados
    await loadItems();

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

    const { error } = await sb
      .from("week_days")
      .update({ muscle_group: mg, focus: focusVal })
      .eq("id", state.day_id);

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
  // Editor: exercises dropdown (FIX: muestra TODOS; inactivos deshabilitados)
  // =====================================================
  async function loadExercisesDropdown() {
    if (!exerciseSel) return;

    exerciseSel.innerHTML = `<option value="">Cargando…</option>`;

    // Traemos TODOS (activos e inactivos) para que coincida con Supabase (100 filas)
    const { data, error } = await sb
      .from("exercises")
      .select("id,name,track,objective,muscle_group,is_active")
      .order("name", { ascending: true })
      .limit(2000);

    if (error) {
      exerciseSel.innerHTML = `<option value="">Error</option>`;
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      exerciseSel.innerHTML = `<option value="">Sin ejercicios</option>`;
      return;
    }

    // Para facilitar: mostramos primero activos, luego inactivos (deshabilitados)
    const active = rows.filter((r) => r.is_active !== false);
    const inactive = rows.filter((r) => r.is_active === false);

    const mkOpt = (e, disabled = false) => {
      const name = String(e.name || "").trim() || "Ejercicio";
      const trk = trackHuman(e.track);
      const suffix = disabled ? " (INACTIVO)" : "";
      return `<option value="${esc(e.id)}" ${disabled ? "disabled" : ""}>${esc(name)} — ${esc(trk)}${esc(suffix)}</option>`;
    };

    const activeHtml = active.map((e) => mkOpt(e, false)).join("");
    const inactiveHtml = inactive.map((e) => mkOpt(e, true)).join("");

    exerciseSel.innerHTML =
      `<option value="">Elegí un ejercicio…</option>` +
      `<optgroup label="Activos (${active.length})">${activeHtml || `<option disabled>(sin activos)</option>`}</optgroup>` +
      `<optgroup label="Inactivos (${inactive.length})">${inactiveHtml || `<option disabled>(sin inactivos)</option>`}</optgroup>`;
  }

  // =====================================================
  // Items: user_day_items
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

    setMsg(itemMsg, `Agregado ✅ (orden ${sort_order})`, "notice");

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

  async function loadItems() {
    if (!itemsList) return;

    if (!state.user_id || !state.day_id) {
      itemsList.innerHTML = `<div class="notice small">Cargá un alumno y un día para ver items.</div>`;
      return;
    }

    itemsList.innerHTML = `<div class="small">Cargando…</div>`;

    const { data, error } = await sb
      .from("user_day_items")
      .select("id, sort_order, sets, reps, notes, exercises:exercise_id (name, video_url)")
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

        return `
          <div class="item" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div>
              <div><b>${esc(it.sort_order)}.</b> ${esc(name)}</div>
              <div class="small">${esc(it.sets)}×${esc(it.reps)} ${it.notes ? "· " + esc(it.notes) : ""}</div>
              <div style="margin-top:6px">${video}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn" type="button" data-del="${esc(it.id)}">Eliminar</button>
            </div>
          </div>
        `;
      })
      .join("");

    itemsList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!id) return;
        if (!confirm("¿Eliminar este item?")) return;

        const { error } = await sb.from("user_day_items").delete().eq("id", id);
        if (error) return alert(error.message);

        await loadItems();
        await loadStudentMonthOverview();
      });
    });
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
    await loadExercisesDropdown();
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
    exList?.querySelectorAll('details[data-ex-acc-key]').forEach((d) => {
      if (d.open) open.add(d.getAttribute("data-ex-acc-key"));
    });
    return open;
  }

  function restoreOpenAccordions(openSet) {
    if (!openSet) return;
    exList?.querySelectorAll('details[data-ex-acc-key]').forEach((d) => {
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

    const normTrack2 = (v) => (v === "gym" || v === "home" || v === "both") ? v : "unknown";
    const normMG2 = (v) => (v === "lower" || v === "upper" || v === "abs" || v === "activation" || v === "cardio") ? v : "unknown";
    const sel = (v, k) => (String(v || "") === String(k) ? "selected" : "");

    const tree = {};
    for (const e of rows || []) {
      const t = normTrack2(e.track);
      const mg = normMG2(e.muscle_group);
      (((tree[t] ||= {})[mg] ||= [])).push(e);
    }

    const html = trackOrder
      .filter((t) => tree[t])
      .map((t) => {
        const mgBlocks = mgOrder
          .filter((mg) => tree[t][mg]?.length)
          .map((mg) => {
            const items = tree[t][mg]
              .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"))
              .map((e) => {
                const id = esc(e.id);
                const name = esc(e.name);
                const video = esc(e.video_url || "");
                const cues = esc(e.cues || "");
                const tVal = normTrack2(e.track);
                const oVal = e.objective || "both";
                const mgVal = normMG2(e.muscle_group);

                return `
                  <div class="item" style="display:grid;gap:10px">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
                      <div>
                        <div><b>${name}</b></div>
                        ${video
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
                <summary>${esc(MG_LABEL[mg] || "Ejercicios")}</summary>
                <div class="acc-body" style="padding:12px">
                  <div style="display:grid;gap:10px">${items}</div>
                </div>
              </details>
            `;
          })
          .join("");

        return `
          <details class="admin-acc" data-ex-acc-key="t:${esc(t)}" style="margin-top:10px">
            <summary>${esc(TRACK_LABEL[t] || "Modalidad")}</summary>
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
      editBox.style.display = (!editBox.style.display || editBox.style.display === "none") ? "block" : "none";
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

        const { error } = await sb
          .from("exercises")
          .update({ name, video_url, cues, objective, track, muscle_group })
          .eq("id", id);

        if (error) throw new Error(error.message);

        lastEditedExerciseId = id;
        await loadExercisesLibrary();
        await loadExercisesDropdown();

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
        await loadExercisesDropdown();
      } catch (e) {
        setMsg(exMsg, e?.message || String(e), "error");
      }
    }
  });

  exRefreshBtn?.addEventListener("click", () => loadExercisesLibrary().catch(console.error));

  // =====================================================
  // Alertas
  // =====================================================
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
      setMsg(alertsMsg, error.message, "error");
      return;
    }

    if (!data?.length) {
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
        const sec = document.getElementById("sec-alumnos");
        if (sec?.tagName === "DETAILS") sec.open = true;
        studentCard?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    const { data: prefRow } = await sb
      .from("user_preferences")
      .select("objective, track")
      .eq("user_id", userId)
      .maybeSingle();
    if (prefRow) out.prefs = prefRow;

    const { data: profRow } = await sb
      .from("profiles")
      .select("full_name, training_level, email")
      .eq("user_id", userId)
      .maybeSingle();
    if (profRow) out.profile = profRow;

    return out;
  }

  async function findStudent(email) {
    const e = (email || "").trim();
    if (!e) return;

    setMsg(studentMsg, "Buscando…", "small");
    setSaveSendMsg("");
    setStudentModeMsg("");
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

    const sum = await adminLoadUserSummary(state.user_id);

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

    await loadStudentMonthOverview();
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
    loadStudentMonthOverview().catch(console.error);
  });

  editStudentModeBtn?.addEventListener("click", async () => {
    if (!state.user_id) return alert("Primero buscá un alumno.");
    const m = Number(stuMonthSel?.value || 0);
    if (!m) return alert("Elegí un mes.");
    state.month = m;

    enterStudentMode();
    setSaveSendMsg("");

    await loadWeeksForMonth(state.month);
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
    stuRoutineMeta.textContent = `Mes: ${state.month} · ${objLabel(state.objective)} · ${trackLabel(state.track)}`;

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
        }

        const w = Number(btn.getAttribute("data-edit-week") || 0);
        const d = Number(btn.getAttribute("data-edit-day") || 0);

        if (weekSel) weekSel.value = String(w);
        await loadDaysForMonthWeek(state.month, w);
        if (daySel) daySel.value = String(d);

        const secEditor = document.getElementById("sec-editor");
        if (secEditor?.tagName === "DETAILS") secEditor.open = true;

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
    const { data: weeksRows, error: wErr } = await sb
      .from("weeks")
      .select("id")
      .eq("month_number", state.month);

    if (wErr) throw new Error(wErr.message);

    const weekIds = (weeksRows || []).map((w) => w.id);
    if (!weekIds.length) return 0;

    const { data: daysRows, error: dErr } = await sb
      .from("week_days")
      .select("id")
      .in("week_id", weekIds);

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

      // ✅ Publica y libera: disponible ahora (sin retardo). Debe existir en DB como RPC SECURITY DEFINER.
      const { data: pub, error: pubErr } = await sb.rpc("admin_publish_routine", {
        p_user_id: state.user_id,
      });

      if (pubErr) throw new Error(pubErr.message);
      if (!pub?.ok) throw new Error("No pude publicar la rutina.");

      // ✅ “Aviso” al alumno (mailto)
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

      setSaveSendMsg("Guardado y enviado ✅ (ya debería verse en el campus)", "notice");

      await loadAlerts().catch(() => {});
      await loadStudentMonthOverview().catch(() => {});
    } catch (e) {
      console.error("[ADMIN] saveAndSendRoutine error:", e);
      setSaveSendMsg(e?.message || String(e), "error");
      alert(e?.message || String(e));
    }
  }

  // Bind UNA SOLA VEZ
  saveSendRoutineBtn?.addEventListener("click", saveAndSendRoutine);

  // =====================================================
  // Premium — Storage + Recorded/Live
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

      await loadKPIs();

      await loadPlansIntoActiveUsersFilter(); // <-- FIX: existe y está hoisteada
      await loadActiveUsers();

      // Dropdown: ya está listo aunque no haya alumno seleccionado
      await loadExercisesDropdown();
      await loadExercisesLibrary();

      await loadAlerts();

      await loadRecordedClasses();
      await loadLiveClassesAdmin();

      initWeeklyQuoteAdmin();

      console.log("[ADMIN] Ready ✅");
    } catch (e) {
      console.error("[ADMIN] init crash:", e);
      alert(e?.message || String(e));
    }
  })();
})();