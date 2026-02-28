// admin.js — limpio + robusto
// KPIs + editor de días + biblioteca ejercicios + rutinas activas + alumnos + premium + frase de la semana
(() => {
  "use strict";

  // =====================================================
  // Guard rails
  // =====================================================
  if (!window.sb) {
    console.error("[ADMIN] sb no existe. Revisá supabaseClient.js y el orden de scripts.");
    alert("Supabase client (sb) no está cargado. Revisá el orden de scripts.");
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
    el.className = kind; // "notice" | "error" | "small"
    el.textContent = text || "";
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

  function monthNameEs(m) {
    const names = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    return names[m - 1] || `Mes ${m}`;
  }

  const objLabel = (v) => (v === "muscle_gain" ? "Ganar masa" : "Perder peso");
  const trackLabel = (v) => (v === "home" ? "Casa" : "Gimnasio");

  const AR_TZ = "America/Argentina/Buenos_Aires";

// Convierte "YYYY-MM-DDTHH:mm" (datetime-local) a ISO UTC interpretándolo como hora AR.
// Importante: NO depende de la TZ del dispositivo.
function dtLocalArgentinaToIso(dtLocal) {
  const v = String(dtLocal || "").trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error("Fecha/hora inválida (datetime-local).");

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] || 0);

  // Creamos un string con offset AR fijo "-03:00"
  // (evita que el Date() use la TZ del dispositivo).
  const isoWithOffset = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}-03:00`;
  const d = new Date(isoWithOffset);
  if (Number.isNaN(d.getTime())) throw new Error("No pude interpretar fecha/hora AR.");
  return d.toISOString();
}

// Mes a partir del string "YYYY-MM-DDTHH:mm" (no depende de TZ)
function monthFromDtLocal(dtLocal) {
  const v = String(dtLocal || "").trim();
  const m = Number(v.slice(5, 7));
  return (m >= 1 && m <= 12) ? m : null;
}

// Formatea un ISO a “Argentina” (para listados), sin depender de TZ del dispositivo.
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

  // =====================================================
  // Cache meses
  // =====================================================
  const monthTitles = {}; // { [month_number]: title }

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
  // Elements: selector/editor
  // =====================================================
  const monthSel = $("monthSel");
  const objSel = $("objSel");
  const trackSel = $("trackSel");
  const weekSel = $("weekSel");
  const daySel = $("daySel");
  const loadBtn = $("loadBtn");
  const selMsg = $("selMsg");

  const logoutBtn = $("logoutBtn");

  const dayTitle = $("dayTitle");
  const dayMeta = $("dayMeta");
  const ctxBadge = $("ctxBadge");
  const dayEdit = $("dayEdit");
  const dayPanel = $("dayPanel");

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
  // Biblioteca ejercicios
  // =====================================================
  const exTrack = $("exTrack");
  const exGroup = $("exGroup");
  const exName = $("exName");
  const exVideo = $("exVideo");
  const exCues = $("exCues");
  const createExerciseBtn = $("createExerciseBtn");
  const exMsg = $("exMsg");
  const exRefreshBtn = $("exRefreshBtn");
  const exList = $("exList");
  const exObjective = $("exObjective");

  // =====================================================
  // Rutinas activas
  // =====================================================
  const activeRefreshBtn = $("activeRefreshBtn");
  const activeObjSel = $("activeObjSel");
  const activeTrackSel = $("activeTrackSel");
  const activeMonthTitle = $("activeMonthTitle");
  const activeMonthSubtitle = $("activeMonthSubtitle");
  const activeRoutinesMsg = $("activeRoutinesMsg");

  // Fallback legacy table
  const activeRoutinesTbody = $("activeRoutinesTbody");

  // Duplicar mes
  const copyMonthSrcSel = $("copyMonthSrcSel");
  const copyMonthAllCtx = $("copyMonthAllCtx");
  const copyMonthOverwrite = $("copyMonthOverwrite");
  const copyMonthBtn = $("copyMonthBtn");
  const copyMonthMsg = $("copyMonthMsg");

  // Menú meses
  const activeMonthMenuBtn = $("activeMonthMenuBtn");
  const activeMonthMenu = $("activeMonthMenu");
  const activeMonthMenuList = $("activeMonthMenuList");
  const activeMonthMenuCloseBtn = $("activeMonthMenuCloseBtn");
  const activePrevBtn = $("activePrevBtn");
  const activeNextBtn = $("activeNextBtn");

  // =====================================================
  // Alumnos + alertas
  // =====================================================
  const studentEmail = $("studentEmail");
  const findStudentBtn = $("findStudentBtn");
  const studentMsg = $("studentMsg");
  const studentCard = $("studentCard");
  const studentEmailOut = $("studentEmailOut");
  const studentPlanOut = $("studentPlanOut");
  const studentStatusOut = $("studentStatusOut");
  const studentPaidOut = $("studentPaidOut");
  const openStudentCaseBtn = $("openStudentCaseBtn");

  const ovObjective = $("ovObjective");
  const ovTrack = $("ovTrack");
  const ovReason = $("ovReason");
  const saveOverrideBtn = $("saveOverrideBtn");
  const clearOverrideStudentBtn = $("clearOverrideStudentBtn");
  const ovMsg = $("ovMsg");

  const stuRoutineMeta = $("stuRoutineMeta");
  const stuRoutineMsg = $("stuRoutineMsg");
  const stuRoutineBox = $("stuRoutineBox");

  const alertsMsg = $("alertsMsg");
  const alertsList = $("alertsList");

  // =====================================================
  // Premium: clases
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
  // State
  // =====================================================
  const state = {
    month: null,
    week: null,
    day: null,
    objective: "fat_loss",
    track: "gym",
    week_id: null,
    day_id: null,
    day_label: null,
  };

  let foundUserId = null;
  let activeMonthOverride = null; // number|null
  let activeMonthsList = []; // [{month_number,title,published:boolean}]

  // =====================================================
  // Weekly Quote (Frase de la semana) — tabla weekly_quote
  // Columnas: id(int), title(text), phrase(text), image_url(text), updated_at(timestamptz)
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

    // Si esta sección no está en el HTML, no rompemos el admin
    if (!elTitle || !elPhrase || !btnSave || !btnRefresh) return;

    const TABLE = "weekly_quote";
    const SINGLETON_ID = 1;
    const BUCKET = "class_covers"; // ✅ ya lo usás en Premium
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

        updatePreview({
          title: row.title,
          phrase: row.phrase,
          image_url: row.image_url,
        });

        setLocalMsg("OK", true);
      } catch (e) {
        console.error("weekly_quote load:", e);
        setLocalMsg("No pude cargar (RLS o falta registro id=1).");
      }
    };

    const save = async () => {
      try {
        const title = (elTitle.value || "").trim();
        const phrase = (elPhrase.value || "").trim();
        if (!title || !phrase) return setLocalMsg("Completá Título y Copy.");

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
        console.error("weekly_quote save:", e);
        setLocalMsg("No pude guardar (RLS / Storage policy).");
      }
    };

    btnRefresh.addEventListener("click", load);
    btnSave.addEventListener("click", save);

    // Preview por URL en vivo
    elUrl.addEventListener("input", () => {
      updatePreview({
        title: elTitle.value,
        phrase: elPhrase.value,
        image_url: (elUrl.value || "").trim(),
      });
    });

    // Preview si elige archivo (sin subir todavía)
    elFile?.addEventListener("change", () => {
      const f = elFile.files?.[0];
      if (!f) return;
      const localUrl = URL.createObjectURL(f);
      updatePreview({
        title: elTitle.value,
        phrase: elPhrase.value,
        image_url: localUrl,
      });
    });

    load();
  }

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
        ? by.map((x) => `
            <div class="item" style="display:flex;justify-content:space-between;gap:10px">
              <div><b>${esc(x.slug)}</b></div>
              <div class="small">${esc(x.qty)}</div>
            </div>
          `).join("")
        : `<div class="notice small">Sin activos.</div>`;
    }
  }

  // =====================================================
  // Auth / Admin
  // =====================================================
  async function ensureAdminSession() {
    const { data: sdata, error: sErr } = await sb.auth.getSession();
    if (sErr) console.error("[ADMIN] getSession error:", sErr);

    if (!sdata?.session) {
      window.location.href = "./admin-login.html";
      return false;
    }

    const { data: isAdmin, error: aErr } = await sb.rpc("is_admin");
    if (aErr) console.error("[ADMIN] is_admin error:", aErr);

    if (isAdmin !== true) {
      alert("Tu usuario no tiene permisos admin.");
      window.location.href = "./index.html";
      return false;
    }

    return true;
  }

  // =====================================================
  // Mes publicado + menú meses
  // =====================================================
  async function getPublishedMonthNumber() {
    const { data, error } = await sb
      .from("month_release")
      .select("month_number, release_at")
      .eq("is_published", true)
      .lte("release_at", new Date().toISOString())
      .order("release_at", { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);

    const row = data?.[0];
    if (!row?.month_number) throw new Error("No hay mes publicado en month_release.");

    return Number(row.month_number);
  }

  async function getActiveMonthNumber() {
    if (Number.isFinite(activeMonthOverride)) return Number(activeMonthOverride);
    return await getPublishedMonthNumber();
  }

  async function buildActiveMonthMenu() {
    if (!activeMonthMenuList) return;

    const { data: pm, error: pmErr } = await sb
      .from("program_months")
      .select("month_number,title")
      .order("month_number", { ascending: true });

    if (pmErr) throw new Error(pmErr.message);

    const { data: mr, error: mrErr } = await sb
      .from("month_release")
      .select("month_number")
      .eq("is_published", true);

    if (mrErr) throw new Error(mrErr.message);

    const pubSet = new Set((mr || []).map((x) => Number(x.month_number)));

    activeMonthsList = (pm || []).map((x) => ({
      month_number: Number(x.month_number),
      title: x.title,
      published: pubSet.has(Number(x.month_number)),
    }));

    const current = await getActiveMonthNumber();

    activeMonthMenuList.innerHTML = activeMonthsList.map((m) => {
      const pills = [
        m.published ? `<span class="pill pub">Publicado</span>` : "",
        m.month_number === current ? `<span class="pill sel">Viendo</span>` : "",
      ].filter(Boolean).join(" ");

      return `
        <div class="rowline" data-set-active-month="${esc(m.month_number)}">
          <div>
            <div><b>Mes ${esc(m.month_number)}</b> <span class="small" style="opacity:.8">— ${esc(m.title || "")}</span></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">${pills}</div>
        </div>
      `;
    }).join("");

    activeMonthMenuList.querySelectorAll("[data-set-active-month]").forEach((row) => {
      row.addEventListener("click", async () => {
        const m = Number(row.getAttribute("data-set-active-month"));
        if (!m) return;

        activeMonthOverride = m;

        if (activeMonthMenu) activeMonthMenu.style.display = "none";
        if (activeMonthMenuBtn) activeMonthMenuBtn.setAttribute("aria-expanded", "false");

        await loadActiveRoutinesTable();
        await buildActiveMonthMenu().catch(() => {});
      });
    });
  }

  function wireActiveMonthMenu() {
    if (!activeMonthMenuBtn || !activeMonthMenu) return;

    const openMenu = async () => {
      activeMonthMenu.style.display = "block";
      activeMonthMenuBtn.setAttribute("aria-expanded", "true");
      await buildActiveMonthMenu().catch(console.error);
    };

    const closeMenu = () => {
      activeMonthMenu.style.display = "none";
      activeMonthMenuBtn.setAttribute("aria-expanded", "false");
    };

    activeMonthMenuBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const isOpen = activeMonthMenu.style.display === "block";
      if (isOpen) closeMenu();
      else await openMenu();
    });

    activeMonthMenuCloseBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenu();
    });

    document.addEventListener("click", (e) => {
      if (!activeMonthMenu || !activeMonthMenuBtn) return;
      const inside = activeMonthMenu.contains(e.target) || activeMonthMenuBtn.contains(e.target);
      if (!inside) closeMenu();
    });

    activePrevBtn?.addEventListener("click", async () => {
      const current = await getActiveMonthNumber();
      const idx = activeMonthsList.findIndex((x) => x.month_number === current);
      if (idx > 0) {
        activeMonthOverride = activeMonthsList[idx - 1].month_number;
        await loadActiveRoutinesTable();
        await buildActiveMonthMenu().catch(() => {});
      }
    });

    activeNextBtn?.addEventListener("click", async () => {
      const current = await getActiveMonthNumber();
      const idx = activeMonthsList.findIndex((x) => x.month_number === current);
      if (idx >= 0 && idx < activeMonthsList.length - 1) {
        activeMonthOverride = activeMonthsList[idx + 1].month_number;
        await loadActiveRoutinesTable();
        await buildActiveMonthMenu().catch(() => {});
      }
    });
  }

  // =====================================================
  // Rutinas activas — render por semanas
  // =====================================================
  function getWeekTbody(weekNumber) {
    return document.querySelector(`tbody[data-week="${weekNumber}"]`);
  }
  function hasWeekVisor() {
    return !!getWeekTbody(1);
  }
  function setWeekPlaceholder(text) {
    for (let w = 1; w <= 4; w++) {
      const tb = getWeekTbody(w);
      if (!tb) continue;
      tb.innerHTML = `<tr><td colspan="6" class="small" style="padding:12px;opacity:.8">${esc(text)}</td></tr>`;
    }
  }
  function clearLegacyPlaceholder(text) {
    if (!activeRoutinesTbody) return;
    activeRoutinesTbody.innerHTML = `<tr><td colspan="7" class="small" style="padding:12px;opacity:.8">${esc(text)}</td></tr>`;
  }

  function wireActiveEditButtons(month, objective, track) {
    document.querySelectorAll('button[data-active-edit="1"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const w = btn.getAttribute("data-week");
        const d = btn.getAttribute("data-day");
        if (!w || !d) return;

        if (monthSel) monthSel.value = String(month);
        if (objSel) objSel.value = objective;
        if (trackSel) trackSel.value = track;
        if (weekSel) weekSel.value = String(w);
        if (daySel) daySel.value = String(d);

        const secSelector = document.getElementById("sec-selector");
        const secEditor = document.getElementById("sec-editor");

        if (secSelector?.tagName === "DETAILS") secSelector.open = true;
        if (secEditor?.tagName === "DETAILS") secEditor.open = true;

        setMsg(selMsg, "Cargando día…", "small");

        try {
          const ok = await loadDay();
          if (ok) dayTitle?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (e) {
          console.error(e);
          setMsg(selMsg, e?.message || String(e), "error");
          alert(e?.message || String(e));
        }
      }, { once: true });
    });
  }

  async function loadActiveRoutinesTable() {
    if (!activeObjSel || !activeTrackSel) return;

    const month = await getActiveMonthNumber();
    const objective = activeObjSel.value || "fat_loss";
    const track = activeTrackSel.value || "gym";

    const title = monthTitles[month] || "";
    if (activeMonthTitle) activeMonthTitle.textContent = `Mes ${month} — ${monthNameEs(month)}`;
    if (activeMonthSubtitle) {
      activeMonthSubtitle.textContent = `${title ? `${title} · ` : ""}${objLabel(objective)} · ${trackLabel(track)}`;
    }

    if (activeRoutinesMsg) setMsg(activeRoutinesMsg, "Cargando…", "small");
    if (hasWeekVisor()) setWeekPlaceholder("Cargando…");
    else clearLegacyPlaceholder("Cargando…");

    try {
      const { data: weeksRows, error: wErr } = await sb
        .from("weeks")
        .select("id, week_number")
        .eq("month_number", month)
        .order("week_number", { ascending: true });

      if (wErr) throw new Error(wErr.message);

      if (!weeksRows?.length) {
        if (activeRoutinesMsg) setMsg(activeRoutinesMsg, "No hay semanas para este mes.", "notice");
        if (hasWeekVisor()) setWeekPlaceholder("Sin datos.");
        else clearLegacyPlaceholder("Sin datos.");
        return;
      }

      const weekIds = weeksRows.map((w) => w.id);
      const weekNumById = {};
      for (const w of weeksRows) weekNumById[w.id] = w.week_number;

      const { data: daysRows, error: dErr } = await sb
        .from("week_days")
        .select("id, week_id, day_number, label, muscle_group, focus")
        .in("week_id", weekIds)
        .order("day_number", { ascending: true });

      if (dErr) throw new Error(dErr.message);

      if (!daysRows?.length) {
        if (activeRoutinesMsg) setMsg(activeRoutinesMsg, "No hay días para este mes.", "notice");
        if (hasWeekVisor()) setWeekPlaceholder("Sin datos.");
        else clearLegacyPlaceholder("Sin datos.");
        return;
      }

      const dayIds = daysRows.map((d) => d.id);

      const { data: itemsRows, error: iErr } = await sb
        .from("day_items")
        .select("day_id")
        .in("day_id", dayIds)
        .eq("objective", objective)
        .eq("track", track);

      if (iErr) throw new Error(iErr.message);

      const countByDayId = {};
      for (const it of (itemsRows || [])) {
        countByDayId[it.day_id] = (countByDayId[it.day_id] || 0) + 1;
      }

      const ordered = daysRows
        .map((d) => ({ ...d, week_number: weekNumById[d.week_id] || 0 }))
        .sort((a, b) => (a.week_number - b.week_number) || (a.day_number - b.day_number));

      const activeDays = ordered.filter((d) => (countByDayId[d.id] || 0) > 0).length;

      if (activeRoutinesMsg) {
        setMsg(
          activeRoutinesMsg,
          `Mes ${month}: ${ordered.length} día(s) · Activos (con items): ${activeDays} · ${objLabel(objective)} · ${trackLabel(track)}`,
          "small"
        );
      }

      if (hasWeekVisor()) {
        for (let w = 1; w <= 4; w++) {
          const tb = getWeekTbody(w);
          if (!tb) continue;

          const days = ordered.filter((x) => Number(x.week_number) === w);
          if (!days.length) {
            tb.innerHTML = `<tr><td colspan="6" class="small" style="padding:12px;opacity:.8">Sin datos.</td></tr>`;
            continue;
          }

          tb.innerHTML = days.map((d) => {
            const cnt = countByDayId[d.id] || 0;
            return `
              <tr>
                <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">Día ${esc(d.day_number)}</td>
                <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(d.label)}</td>
                <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(d.muscle_group || "—")}</td>
                <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(d.focus || "—")}</td>
                <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(cnt)}</td>
                <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">
                  <button class="btn primary" type="button" data-active-edit="1"
                    data-week="${esc(d.week_number)}" data-day="${esc(d.day_number)}"
                    style="white-space:nowrap">Editar</button>
                </td>
              </tr>
            `;
          }).join("");
        }
      } else if (activeRoutinesTbody) {
        activeRoutinesTbody.innerHTML = ordered.map((d) => {
          const cnt = countByDayId[d.id] || 0;
          return `
            <tr>
              <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">Semana ${esc(d.week_number)}</td>
              <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">Día ${esc(d.day_number)}</td>
              <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(d.label)}</td>
              <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(d.muscle_group || "—")}</td>
              <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(d.focus || "—")}</td>
              <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">${esc(cnt)}</td>
              <td style="padding:12px;border-bottom:1px solid rgba(0,0,0,.06)">
                <button class="btn primary" type="button" data-active-edit="1"
                  data-week="${esc(d.week_number)}" data-day="${esc(d.day_number)}"
                  style="white-space:nowrap">Editar</button>
              </td>
            </tr>
          `;
        }).join("") || `<tr><td colspan="7" class="small" style="padding:12px;opacity:.8">Sin datos.</td></tr>`;
      }

      wireActiveEditButtons(month, objective, track);
    } catch (e) {
      console.error("[ADMIN] loadActiveRoutinesTable error:", e);
      if (activeRoutinesMsg) setMsg(activeRoutinesMsg, e?.message || String(e), "error");
      if (hasWeekVisor()) setWeekPlaceholder("Error cargando datos.");
      else clearLegacyPlaceholder("Error cargando datos.");
    }
  }

  function initActiveRoutinesUI() {
    activeRefreshBtn?.addEventListener("click", () => loadActiveRoutinesTable().catch(console.error));
    activeObjSel?.addEventListener("change", () => loadActiveRoutinesTable().catch(console.error));
    activeTrackSel?.addEventListener("change", () => loadActiveRoutinesTable().catch(console.error));
    copyMonthBtn?.addEventListener("click", () =>
      copyMonthToPublished().catch((e) => setMsg(copyMonthMsg, e?.message || String(e), "error"))
    );
  }

  async function copyMonthToPublished() {
    if (!copyMonthSrcSel) return;

    const srcMonth = Number(copyMonthSrcSel.value || 0);
    if (!srcMonth) return setMsg(copyMonthMsg, "Elegí mes origen.", "error");

    const dstMonth = await getPublishedMonthNumber();
    if (srcMonth === dstMonth) return setMsg(copyMonthMsg, "Mes origen y destino son el mismo.", "error");

    const overwrite = !!copyMonthOverwrite?.checked;
    const allCtx = !!copyMonthAllCtx?.checked;

    const objective = activeObjSel?.value || "fat_loss";
    const track = activeTrackSel?.value || "gym";

    setMsg(copyMonthMsg, "Duplicando…", "small");

    const contexts = allCtx
      ? [
          { objective: "fat_loss", track: "gym" },
          { objective: "fat_loss", track: "home" },
          { objective: "muscle_gain", track: "gym" },
          { objective: "muscle_gain", track: "home" },
        ]
      : [{ objective, track }];

    let totalInserted = 0;
    let totalDeleted = 0;

    for (const c of contexts) {
      const { data, error } = await sb.rpc("admin_copy_month", {
        p_src_month: srcMonth,
        p_dst_month: dstMonth,
        p_objective: c.objective,
        p_track: c.track,
        p_overwrite: overwrite,
      });

      if (error) {
        setMsg(copyMonthMsg, `Error (${objLabel(c.objective)} · ${trackLabel(c.track)}): ${error.message}`, "error");
        return;
      }

      totalInserted += Number(data?.inserted || 0);
      totalDeleted += Number(data?.deleted || 0);
    }

    setMsg(copyMonthMsg, `Listo ✅ Insertados: ${totalInserted} · Borrados: ${totalDeleted} · Destino: Mes ${dstMonth}`, "notice");
    await loadActiveRoutinesTable();
    await buildActiveMonthMenu().catch(() => {});
  }

  // =====================================================
  // Months loader (selector + copyMonthSrcSel)
  // =====================================================
  async function loadMonths() {
    if (!monthSel) return;

    monthSel.innerHTML = `<option value="">Cargando…</option>`;

    const { data, error } = await sb
      .from("program_months")
      .select("month_number,title")
      .order("month_number", { ascending: true });

    if (error) {
      monthSel.innerHTML = `<option value="">Error</option>`;
      throw new Error(error.message);
    }

    if (!data?.length) {
      monthSel.innerHTML = `<option value="">Sin meses cargados</option>`;
      return;
    }

    for (const m of data) monthTitles[m.month_number] = m.title;

    const html = data.map((m) =>
      `<option value="${m.month_number}">Mes ${m.month_number} — ${esc(m.title)}</option>`
    ).join("");

    monthSel.innerHTML = html;

    if (copyMonthSrcSel) {
      copyMonthSrcSel.innerHTML = html;
      const nowM = new Date().getMonth() + 1;
      const exists = data.some((x) => Number(x.month_number) === nowM);
      copyMonthSrcSel.value = exists ? String(nowM) : String(data[0].month_number);
    }
  }

  async function loadWeeksForMonth(month) {
    if (!weekSel) {
      console.warn("[ADMIN] No existe #weekSel en el HTML.");
      setMsg(selMsg, "Falta selector de semana (id=weekSel) en admin.html.", "error");
      return;
    }

    if (!month) {
      weekSel.innerHTML = `<option value="">Elegí un mes…</option>`;
      return;
    }

    weekSel.innerHTML = `<option value="">Cargando…</option>`;

    const { data, error } = await sb
      .from("weeks")
      .select("id, week_number, title")
      .eq("month_number", month)
      .order("week_number", { ascending: true });

    if (error) {
      weekSel.innerHTML = `<option value="">Error</option>`;
      setMsg(selMsg, error.message, "error");
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      weekSel.innerHTML = `<option value="">Sin semanas para este mes</option>`;
      return;
    }

    weekSel.innerHTML =
      `<option value="">Elegí semana…</option>` +
      rows.map((w) =>
        `<option value="${w.week_number}">Semana ${w.week_number}${w.title ? ` — ${esc(w.title)}` : ""}</option>`
      ).join("");

    const has = rows.some((r) => String(r.week_number) === String(weekSel.value));
    if (!weekSel.value || !has) weekSel.value = String(rows[0].week_number);

    await loadDaysForMonthWeek(month, Number(weekSel.value));
  }

  async function loadDaysForMonthWeek(month, weekNumber) {
    if (!daySel) return;

    if (!month || !weekNumber) {
      daySel.innerHTML = `<option value="">Elegí mes y semana…</option>`;
      updateLoadDayUI();
      return;
    }

    daySel.innerHTML = `<option value="">Cargando…</option>`;

    const { data: w, error: wErr } = await sb
      .from("weeks")
      .select("id")
      .eq("month_number", month)
      .eq("week_number", weekNumber)
      .maybeSingle();

    if (wErr || !w?.id) {
      daySel.innerHTML = `<option value="">Sin días</option>`;
      updateLoadDayUI();
      return;
    }

    const { data: days, error: dErr } = await sb
      .from("week_days")
      .select("day_number, label")
      .eq("week_id", w.id)
      .order("day_number", { ascending: true });

    if (dErr) {
      daySel.innerHTML = `<option value="">Error</option>`;
      setMsg(selMsg, dErr.message, "error");
      updateLoadDayUI();
      return;
    }

    const rows = Array.isArray(days) ? days : [];
    if (!rows.length) {
      daySel.innerHTML =
        `<option value="">Elegí día…</option>` +
        [1, 2, 3, 4, 5].map((n) => `<option value="${n}">Día ${n}</option>`).join("");
      daySel.value = "1";
      updateLoadDayUI();
      return;
    }

    daySel.innerHTML =
      `<option value="">Elegí día…</option>` +
      rows.map((d) =>
        `<option value="${d.day_number}">Día ${d.day_number}${d.label ? ` — ${esc(d.label)}` : ""}</option>`
      ).join("");

    const has = rows.some((r) => String(r.day_number) === String(daySel.value));
    if (!daySel.value || !has) daySel.value = String(rows[0].day_number);

    updateLoadDayUI();
  }

  // =====================================================
  // Exercises dropdown (para agregar al día)
  // =====================================================
  async function loadExercisesDropdown() {
    if (!exerciseSel) return;

    const ctxTrack = trackSel?.value || state.track || "gym";
    exerciseSel.innerHTML = `<option value="">Cargando…</option>`;

    const { data, error } = await sb
      .from("exercises")
      .select("id,name,track,objective,muscle_group,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      exerciseSel.innerHTML = `<option value="">Error</option>`;
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      exerciseSel.innerHTML = `<option value="">Sin ejercicios</option>`;
      return;
    }

    const MG_LABEL = {
      lower: "Tren inferior",
      upper: "Tren superior",
      abs: "Abdominales",
      activation: "Activación",
      cardio: "Cardio",
      unknown: "Sin grupo",
    };

    const normTrack = (v) => (v === "gym" || v === "home" || v === "both") ? v : "both";

    const normMG = (v) => {
      const raw = String(v || "").trim();
      const key = raw.toLowerCase();
      if (["lower", "upper", "abs", "activation", "cardio"].includes(key)) return key;

      const k = key
        .replaceAll("á", "a").replaceAll("é", "e").replaceAll("í", "i").replaceAll("ó", "o").replaceAll("ú", "u");

      if (k.includes("tren inferior")) return "lower";
      if (k.includes("tren superior")) return "upper";
      if (k.includes("abdominal")) return "abs";
      if (k.includes("activacion")) return "activation";
      if (k.includes("cardio")) return "cardio";

      return "unknown";
    };

    let filtered = rows.filter((e) => {
      const t = normTrack(e.track);
      return t === ctxTrack || t === "both";
    });

    if (!filtered.length) filtered = rows.slice();

    const groups = {};
    for (const e of filtered) {
      const mg = normMG(e.muscle_group);
      (groups[mg] ||= []).push(e);
    }

    const order = ["lower", "upper", "abs", "activation", "cardio", "unknown"];

    const html = order
      .filter((k) => groups[k]?.length)
      .map((k) => {
        const opts = groups[k]
          .map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`)
          .join("");
        return `<optgroup label="${esc(MG_LABEL[k] || "Ejercicios")}">${opts}</optgroup>`;
      })
      .join("");

    exerciseSel.innerHTML =
      `<option value="">Elegí un ejercicio…</option>` +
      (html || `<option value="">No hay ejercicios disponibles</option>`);
  }

  // =====================================================
  // Day context loader + editor
  // =====================================================
  async function loadDay() {
    const month = Number(monthSel?.value);
    const week = Number(weekSel?.value);
    const day = Number(daySel?.value);
    const objective = objSel?.value || "fat_loss";
    const track = trackSel?.value || "gym";

    if (!month || !week || !day) {
      setMsg(selMsg, "Seleccioná mes, semana y día antes de cargar.", "error");
      return false;
    }

    state.month = month;
    state.week = week;
    state.day = day;
    state.objective = objective;
    state.track = track;

    const { data: w, error: wErr } = await sb
      .from("weeks")
      .select("id,title")
      .eq("month_number", month)
      .eq("week_number", week)
      .single();

    if (wErr) throw new Error(`No encontré week_id (mes ${month}, semana ${week}). ${wErr.message}`);

    state.week_id = w.id;

    const { data: d, error: dErr } = await sb
      .from("week_days")
      .select("id,label,muscle_group,focus")
      .eq("week_id", w.id)
      .eq("day_number", day)
      .single();

    if (dErr) throw new Error(`No encontré day_id (día ${day}). ${dErr.message}`);

    state.day_id = d.id;
    state.day_label = d.label;

    if (dayTitle) dayTitle.textContent = `Mes ${month} · Semana ${week} · Día ${day} (${d.label})`;
    if (dayMeta) dayMeta.textContent = "Cargá items sin perder el contexto.";

    if (ctxBadge) {
      ctxBadge.style.display = "inline-flex";
      ctxBadge.textContent = `${objective === "fat_loss" ? "Perder peso" : "Ganar masa"} · ${track === "gym" ? "Gimnasio" : "Casa"}`;
    }

    if (dayEdit) dayEdit.style.display = "block";
    if (dayPanel) dayPanel.style.display = "none";

    if (mgSel) mgSel.value = d.muscle_group || mgSel.value || "Tren inferior";
    if (focusInp) focusInp.value = d.focus || "";

    setMsg(selMsg, "Día cargado ✅", "notice");

    await loadExercisesDropdown();
    await loadItems();
    await loadKPIs();

    return true;
  }

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

  // =====================================================
  // Items del día
  // =====================================================
  async function getNextSortOrder() {
    const { data, error } = await sb
      .from("day_items")
      .select("sort_order")
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
    if (!state.day_id) throw new Error("Primero cargá un día (Cargar día).");

    const exercise_id = exerciseSel?.value;
    if (!exercise_id) throw new Error("Elegí un ejercicio.");

    const sets = Number(setsInp?.value || 0);
    const reps = (repsInp?.value || "").trim();
    const notes = (notesInp?.value || "").trim() || null;

    if (!sets || sets < 1) throw new Error("Series inválidas.");
    if (!reps) throw new Error("Reps es obligatorio (ej: 8-10).");

    const { data: existsRows, error: exErr } = await sb
      .from("day_items")
      .select("id")
      .eq("day_id", state.day_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .eq("exercise_id", exercise_id)
      .limit(1);

    if (exErr) throw new Error(exErr.message);

    if (existsRows?.length) {
      setMsg(itemMsg, "Ese ejercicio ya está cargado en este día (mismo objetivo y modalidad).", "error");
      return;
    }

    const sort_order = await getNextSortOrder();

    const { error } = await sb.from("day_items").insert({
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
  }

  async function loadItems() {
    if (!itemsList) return;

    if (!state.day_id) {
      itemsList.innerHTML = `<div class="small">Cargá un día para ver items.</div>`;
      return;
    }

    itemsList.innerHTML = `<div class="small">Cargando…</div>`;

    const { data, error } = await sb
      .from("day_items")
      .select("id, sort_order, sets, reps, notes, exercises:exercise_id (name, video_url)")
      .eq("day_id", state.day_id)
      .eq("objective", state.objective)
      .eq("track", state.track)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    if (!data?.length) {
      itemsList.innerHTML = `<div class="notice small">Todavía no hay items cargados para este día.</div>`;
      return;
    }

    itemsList.innerHTML = data.map((it) => {
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
    }).join("");

    itemsList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!id) return;
        if (!confirm("¿Eliminar este item?")) return;

        const { error } = await sb.from("day_items").delete().eq("id", id);
        if (error) return alert(error.message);

        await loadItems();
      });
    });
  }

  // =====================================================
  // Biblioteca ejercicios
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

    const { error } = await sb
      .from("exercises")
      .insert({ name, video_url, cues, track, objective, muscle_group, is_active: true });

    if (error) throw new Error(error.message);

    setMsg(exMsg, "Ejercicio creado ✅", "notice");

    if (exName) exName.value = "";
    if (exVideo) exVideo.value = "";
    if (exCues) exCues.value = "";

    await loadExercisesDropdown();
    await loadExercisesLibrary();
  }

  async function loadExercisesLibrary() {
    if (!exList) return;

    exList.innerHTML = `<div class="small">Cargando…</div>`;

    const { data, error } = await sb
      .from("exercises")
      .select("id,name,track,objective,muscle_group,video_url,cues,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      exList.innerHTML = `<div class="error">${esc(error.message)}</div>`;
      return;
    }

    if (!data?.length) {
      exList.innerHTML = `<div class="notice small">Sin ejercicios cargados.</div>`;
      return;
    }

    renderExercisesLibrary(data);
  }

  function renderExercisesLibrary(rows) {
    if (!exList) return;

    const TRACK_LABEL = {
      gym: "Gimnasio",
      home: "Casa",
      both: "Ambos",
      unknown: "Sin modalidad",
    };

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

    const normTrack = (v) => (v === "gym" || v === "home" || v === "both") ? v : "unknown";
    const normMG = (v) => (v === "lower" || v === "upper" || v === "abs" || v === "activation" || v === "cardio") ? v : "unknown";

    const sel = (v, k) => (String(v || "") === String(k) ? "selected" : "");

    const tree = {};
    for (const e of (rows || [])) {
      const t = normTrack(e.track);
      const mg = normMG(e.muscle_group);
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
                const tVal = normTrack(e.track);
                const oVal = e.objective || "both";
                const mgVal = normMG(e.muscle_group);

                return `
                  <div class="item" data-ex-row="${id}" style="display:grid;gap:10px">
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
              <details class="admin-acc" style="margin-top:10px">
                <summary>${esc(MG_LABEL[mg] || "Ejercicios")}</summary>
                <div class="acc-body" style="padding:12px">
                  <div style="display:grid;gap:10px">${items}</div>
                </div>
              </details>
            `;
          })
          .join("");

        return `
          <details class="admin-acc" style="margin-top:10px">
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

      if (!name) {
        setRowMsg("Falta nombre.", "error");
        return;
      }

      try {
        setRowMsg("Guardando…", "small");

        const { error } = await sb
          .from("exercises")
          .update({ name, video_url, cues, objective, track, muscle_group })
          .eq("id", id);

        if (error) throw new Error(error.message);

        setRowMsg("Guardado ✅", "notice");
        await loadExercisesLibrary();
        await loadExercisesDropdown();
      } catch (e) {
        setRowMsg(e?.message || String(e), "error");
      }
      return;
    }

    if (act === "delete") {
      if (!confirm("¿Eliminar este ejercicio? (Se desactiva para no romper rutinas ya armadas)")) return;

      try {
        const { error } = await sb
          .from("exercises")
          .update({ is_active: false })
          .eq("id", id);

        if (error) throw new Error(error.message);

        setMsg(exMsg, "Ejercicio eliminado (desactivado) ✅", "notice");
        await loadExercisesLibrary();
        await loadExercisesDropdown();
      } catch (e) {
        setMsg(exMsg, e?.message || String(e), "error");
      }
    }
  });

  // =====================================================
  // Alertas
  // =====================================================
  async function loadAlerts() {
    if (!alertsList) return;

    alertsList.innerHTML = "";
    setMsg(alertsMsg, "Cargando…", "small");

    const { data, error } = await sb
      .from("admin_alerts")
      .select("id, created_at, email, kind, message, resolved_at")
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

    alertsList.innerHTML = data.map((a) => `
      <div class="item">
        <div><b>${esc(a.kind)}</b> · <span class="small">${new Date(a.created_at).toLocaleString()}</span></div>
        <div class="small">${esc(a.email || "sin email")}</div>
        <div class="small" style="margin-top:6px">${esc(a.message)}</div>
        <div style="margin-top:10px">
          <button class="btn" data-resolve="${esc(a.id)}" type="button">Marcar como resuelto</button>
        </div>
      </div>
    `).join("");

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
  // Alumnos + override + preview
  // =====================================================
  async function loadOverrideForUser(userId) {
    if (!userId) return;

    setMsg(ovMsg, "Cargando override…", "small");

    const { data, error } = await sb
      .from("user_routine_overrides")
      .select("active, objective, track, reason, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setMsg(ovMsg, error.message, "error");
      return;
    }

    if (!data) {
      if (ovObjective) ovObjective.value = "";
      if (ovTrack) ovTrack.value = "";
      if (ovReason) ovReason.value = "";
      setMsg(ovMsg, "Sin override.", "small");
      return;
    }

    if (ovObjective) ovObjective.value = data.objective || "";
    if (ovTrack) ovTrack.value = data.track || "";
    if (ovReason) ovReason.value = data.reason || "";

    setMsg(ovMsg, data.active ? "Override activo ✅" : "Override desactivado.", data.active ? "notice" : "small");
  }

  async function loadStudentActiveRoutineByEmail(email) {
    if (!email) return;

    setMsg(stuRoutineMsg, "Cargando rutina activa…", "small");
    if (stuRoutineBox) stuRoutineBox.innerHTML = "";

    const { data, error } = await sb.rpc("admin_get_user_active_context", { p_email: email });
    if (error) throw new Error(error.message);

    const ctx = Array.isArray(data) ? data[0] : data;
    if (!ctx?.user_id) {
      setMsg(stuRoutineMsg, "No pude resolver contexto del alumno.", "error");
      return;
    }

    if (monthSel) monthSel.value = String(ctx.month_number);
    if (objSel) objSel.value = ctx.objective;
    if (trackSel) trackSel.value = ctx.track;

    if (stuRoutineMeta) {
      const objL = ctx.objective === "fat_loss" ? "Perder peso" : "Ganar masa";
      const trkL = ctx.track === "gym" ? "Gimnasio" : "Casa";
      stuRoutineMeta.textContent = `Mes vigente: ${ctx.month_number} · Objetivo: ${objL} · Modalidad: ${trkL}`;
    }

    const res = await sb.rpc("get_month_content_v2", {
      p_month: ctx.month_number,
      p_objective: ctx.objective,
    });

    if (res.error) throw new Error(res.error.message);

    renderStudentRoutinePreview(res.data, ctx);
    setMsg(stuRoutineMsg, "Rutina cargada ✅ (clickeá un día para editarlo).", "notice");
  }

  function renderStudentRoutinePreview(json, ctx) {
    if (!stuRoutineBox) return;

    const track = ctx.track;
    const DAY_NAMES = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };

    if (!json?.weeks?.length) {
      stuRoutineBox.innerHTML = `<div class="notice small">Este mes todavía no tiene contenido cargado.</div>`;
      return;
    }

    const html = json.weeks.map((w) => {
      const daysHtml = (w.days || []).map((d) => {
        const dayName = DAY_NAMES[d.day_number] || d.label || `Día ${d.day_number}`;
        const items = track === "gym" ? (d.items_gym || []) : (d.items_home || []);
        const count = items.length;
        const first = items.slice(0, 3).map((x) => esc(x.exercise)).join(" · ");
        const subtitle = count ? `${count} ejercicios${first ? ` — ${first}` : ""}` : "Sin ejercicios";

        return `
          <div class="item" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div>
              <div><b>${esc(dayName)}</b> <span class="small" style="opacity:.8">(${esc(d.muscle_group || "")})</span></div>
              <div class="small" style="margin-top:4px;opacity:.9">${esc(subtitle)}</div>
            </div>
            <button class="btn" type="button" data-jump-week="${esc(w.week_number)}" data-jump-day="${esc(d.day_number)}">Editar</button>
          </div>
        `;
      }).join("");

      return `
        <details class="week" style="margin-top:10px">
          <summary style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div><b>Semana ${esc(w.week_number)}</b></div>
            <span class="small">Ver</span>
          </summary>
          <div class="week-body" style="margin-top:10px;display:grid;gap:10px">
            ${daysHtml}
          </div>
        </details>
      `;
    }).join("");

    stuRoutineBox.innerHTML = html;

    stuRoutineBox.querySelectorAll("[data-jump-week]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const w = btn.getAttribute("data-jump-week");
        const d = btn.getAttribute("data-jump-day");
        if (!w || !d) return;

        if (weekSel) weekSel.value = String(w);
        if (daySel) daySel.value = String(d);

        const ok = await loadDay();
        if (ok) dayTitle?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // =====================================================
  // Premium — storage + recorded/live
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

    rcList.innerHTML = data.map((c) => `
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
    `).join("");

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

  // ✅ Interpretar SIEMPRE como hora AR, independientemente del dispositivo
  const starts_at_iso = dtLocalArgentinaToIso(startsLocal);

  // ✅ Mes desde el string (no depende de TZ)
  const month_number = monthFromDtLocal(startsLocal);
  if (!month_number) throw new Error("No pude resolver el mes desde la fecha/hora.");

  // ✅ Portada
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
    cover_url, // <- requiere columna; ver SQL arriba si no existe
  });

  if (ins.error) throw new Error(ins.error.message);

  setMsg(lcMsg, "Clase en vivo publicada ✅", "notice");

  // Limpieza
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
      .limit(20);

    if (error) {
      lcList.innerHTML = `<div class="error">${esc(error.message)}</div>`;
      return;
    }

    if (!data?.length) {
      lcList.innerHTML = `<div class="notice small">No hay clases en vivo cargadas.</div>`;
      return;
    }

   lcList.innerHTML = data.map((c) => `
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
`).join("");

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

  // =====================================================
  // UI bindings
  // =====================================================
  kpiRefreshBtn?.addEventListener("click", () => loadKPIs().catch(console.error));

  logoutBtn?.addEventListener("click", async () => {
    try { await sb.auth.signOut(); } catch (_) {}
    window.location.href = "./index.html";
  });

  function selectionsOk() {
    return !!(monthSel?.value && weekSel?.value && daySel?.value);
  }

  function updateLoadDayUI() {
    const ok = selectionsOk();
    if (loadBtn) loadBtn.disabled = !ok;
    if (!ok) setMsg(selMsg, "Elegí mes, semana y día.", "small");
    else setMsg(selMsg, "", "small");
  }

  ["change", "input"].forEach((evt) => {
    monthSel?.addEventListener(evt, updateLoadDayUI);
    weekSel?.addEventListener(evt, updateLoadDayUI);
    daySel?.addEventListener(evt, updateLoadDayUI);
  });

  monthSel?.addEventListener("change", async () => {
    const m = Number(monthSel.value || 0);
    await loadWeeksForMonth(m);
  });

  weekSel?.addEventListener("change", async () => {
    const m = Number(monthSel?.value || 0);
    const w = Number(weekSel?.value || 0);
    await loadDaysForMonthWeek(m, w);
  });

  updateLoadDayUI();

  loadBtn?.addEventListener("click", async () => {
    updateLoadDayUI();
    if (loadBtn?.disabled) return;

    setMsg(selMsg, "Cargando día…", "small");

    try {
      await loadDay();
    } catch (e) {
      console.error("[ADMIN] loadDay crash:", e);
      setMsg(selMsg, e?.message || String(e), "error");
      alert(e?.message || String(e));
    }
  });

  saveDayMetaBtn?.addEventListener("click", async () => {
    try {
      await saveDayMeta();
    } catch (e) {
      console.error("[ADMIN] saveDayMeta crash:", e);
      setMsg(metaMsg, e?.message || String(e), "error");
      alert(e?.message || String(e));
    }
  });

  refreshItemsBtn?.addEventListener("click", async () => {
    try { await loadItems(); } catch (e) { console.error(e); }
  });

  addItemBtn?.addEventListener("click", async () => {
    setMsg(itemMsg, "");
    try {
      await addItemToDay();
    } catch (e) {
      console.error("[ADMIN] addItemToDay crash:", e);
      setMsg(itemMsg, e?.message || String(e), "error");
      alert(e?.message || String(e));
    }
  });

  createExerciseBtn?.addEventListener("click", async () => {
    setMsg(exMsg, "");
    try {
      await createExercise();
    } catch (e) {
      console.error("[ADMIN] createExercise crash:", e);
      setMsg(exMsg, e?.message || String(e), "error");
      alert(e?.message || String(e));
    }
  });

  exRefreshBtn?.addEventListener("click", () => loadExercisesLibrary().catch(console.error));

  trackSel?.addEventListener("change", () => loadExercisesDropdown().catch(console.error));
  objSel?.addEventListener("change", () => loadExercisesDropdown().catch(console.error));

  findStudentBtn?.addEventListener("click", async () => {
    try {
      const email = (studentEmail?.value || "").trim();
      if (!email) return setMsg(studentMsg, "Ingresá un email.", "error");

      setMsg(studentMsg, "Buscando…", "small");

      const { data, error } = await sb.rpc("admin_find_user_by_email", { p_email: email });
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;

      if (!row?.user_id) {
        foundUserId = null;
        if (studentCard) studentCard.style.display = "none";
        setMsg(studentMsg, "No encontrado.", "error");

        setMsg(ovMsg, "", "small");
        setMsg(stuRoutineMsg, "", "small");
        if (stuRoutineBox) stuRoutineBox.innerHTML = "";
        if (stuRoutineMeta) stuRoutineMeta.textContent = "";
        return;
      }

      foundUserId = row.user_id;

      if (studentEmailOut) studentEmailOut.textContent = row.email;
      if (studentPlanOut) studentPlanOut.textContent = `Plan: ${row.plan_slug || "—"}`;
      if (studentStatusOut) studentStatusOut.textContent = `Estado: ${row.plan_status || "—"}`;
      if (studentPaidOut) studentPaidOut.textContent = `Pago hasta: ${row.paid_through || "—"}`;

      if (studentCard) studentCard.style.display = "block";
      setMsg(studentMsg, "Encontrado ✅", "notice");

      await loadOverrideForUser(foundUserId);
      await loadStudentActiveRoutineByEmail(row.email);
    } catch (e) {
      console.error(e);
      setMsg(studentMsg, e?.message || String(e), "error");
    }
  });

  openStudentCaseBtn?.addEventListener("click", async () => {
    const email = (studentEmailOut?.textContent || studentEmail?.value || "").trim();
    if (!email) return alert("Primero buscá un alumno.");

    try {
      await loadStudentActiveRoutineByEmail(email);
      stuRoutineBox?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      alert(e?.message || String(e));
    }
  });

  saveOverrideBtn?.addEventListener("click", async () => {
    try {
      if (!foundUserId) return alert("Primero buscá un alumno.");

      setMsg(ovMsg, "Guardando…", "small");

      const obj = (ovObjective?.value || "").trim() || null;
      const trk = (ovTrack?.value || "").trim() || null;
      const reason = (ovReason?.value || "").trim() || null;

      const me = await sb.auth.getUser();
      const myId = me?.data?.user?.id || null;

      const { error } = await sb
        .from("user_routine_overrides")
        .upsert({
          user_id: foundUserId,
          active: true,
          objective: obj,
          track: trk,
          reason,
          updated_by: myId,
        }, { onConflict: "user_id" });

      if (error) throw new Error(error.message);

      setMsg(ovMsg, "Override guardado ✅", "notice");
    } catch (e) {
      console.error("[ADMIN] saveOverride crash:", e);
      setMsg(ovMsg, e?.message || String(e), "error");
      alert(e?.message || String(e));
    }
  });

  clearOverrideStudentBtn?.addEventListener("click", async () => {
    try {
      if (!foundUserId) return alert("Primero buscá un alumno.");

      setMsg(ovMsg, "Desactivando…", "small");

      const me = await sb.auth.getUser();
      const myId = me?.data?.user?.id || null;

      const { error } = await sb
        .from("user_routine_overrides")
        .upsert({
          user_id: foundUserId,
          active: false,
          objective: null,
          track: null,
          reason: null,
          updated_by: myId,
        }, { onConflict: "user_id" });

      if (error) return setMsg(ovMsg, error.message, "error");

      if (ovObjective) ovObjective.value = "";
      if (ovTrack) ovTrack.value = "";
      if (ovReason) ovReason.value = "";

      setMsg(ovMsg, "Override desactivado.", "notice");
    } catch (e) {
      setMsg(ovMsg, e?.message || String(e), "error");
    }
  });

  rcSaveBtn?.addEventListener("click", () => saveRecordedClass().catch((e) => setMsg(rcMsg, e?.message || String(e), "error")));
  rcRefreshBtn?.addEventListener("click", () => loadRecordedClasses().catch(console.error));

  lcSaveBtn?.addEventListener("click", () => saveLiveClass().catch((e) => setMsg(lcMsg, e?.message || String(e), "error")));
  lcRefreshBtn?.addEventListener("click", () => loadLiveClassesAdmin().catch(console.error));

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

lcCoverUrl?.addEventListener("input", () => {
  setLiveCoverPreview((lcCoverUrl.value || "").trim());
});

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

      await loadMonths();

      const m = Number(monthSel?.value || 0);
      if (m) await loadWeeksForMonth(m);
      else updateLoadDayUI();

      if (weekSel && !weekSel.value) weekSel.value = "1";
      if (daySel && !daySel.value) daySel.value = "1";
      updateLoadDayUI();

      await loadKPIs();

      initActiveRoutinesUI();
      wireActiveMonthMenu();
      await loadActiveRoutinesTable();
      await buildActiveMonthMenu().catch(() => {});

      await loadExercisesDropdown();

      await loadAlerts();
      await loadRecordedClasses();
      await loadLiveClassesAdmin();
      await loadExercisesLibrary();

      // ✅ Frase de la semana (no rompe si no está el acordeón en el HTML)
      initWeeklyQuoteAdmin();

      console.log("[ADMIN] Ready ✅");
    } catch (e) {
      console.error("[ADMIN] init crash:", e);
      alert(e?.message || String(e));
    }
  })();
})();