(function () {
  "use strict";

  const H = window.PLHolidays;

  // ─── konfiguracja ─────────────────────────────────────────────────────
  const STORAGE_KEY = "kalendarz-urlopow-v1";
  const STATE_VERSION = 9;
  const YEAR_MIN = 2024;
  const YEAR_MAX = 2060;

  /** Szerokości kolumn lewego panelu — zgodne z css/styles.css (.col-*) */
  const STICKY_COL_WIDTHS = {
    "col-lp": 44, "col-name": 240, "col-pool": 60, "col-wyk": 84, "col-l4": 60, "col-m": 60, "col-zm": 60, "col-abs": 64, "col-actions": 68,
  };
  function frozenPanelWidthPx() {
    const poolCount = CODES.filter((c) => c.defaultPool !== null).length;
    return (
      STICKY_COL_WIDTHS["col-lp"] +
      STICKY_COL_WIDTHS["col-name"] +
      poolCount * STICKY_COL_WIDTHS["col-pool"] +
      poolCount * STICKY_COL_WIDTHS["col-wyk"] +
      STICKY_COL_WIDTHS["col-l4"] +
      STICKY_COL_WIDTHS["col-m"] +
      STICKY_COL_WIDTHS["col-zm"] +
      STICKY_COL_WIDTHS["col-abs"] +
      STICKY_COL_WIDTHS["col-actions"]
    );
  }

  function linkRowHover(trA, trB) {
    function enter() { trA.classList.add("row-sync-hover"); trB.classList.add("row-sync-hover"); }
    function leave() { trA.classList.remove("row-sync-hover"); trB.classList.remove("row-sync-hover"); }
    trA.addEventListener("mouseenter", enter);
    trB.addEventListener("mouseenter", enter);
    trA.addEventListener("mouseleave", leave);
    trB.addEventListener("mouseleave", leave);
  }

  // Funkcje pracownicze – używane do liczenia obsady dnia.
  const FUNCTIONS = [
    { id: "prow-layup", label: "Prowadzenie lay-up", short: "P-LU",  color: "#3b82f6" },
    { id: "layup",      label: "Lay-up",             short: "LU",    color: "#f97316" },
    { id: "tickety",    label: "Tickety",            short: "TKT",   color: "#ec4899" },
    { id: "selekcja",   label: "Selekcja",           short: "SEL",   color: "#14b8a6" },
    { id: "flow",       label: "Flow",               short: "FLW",   color: "#8b5cf6" },
  ];
  function getFunction(id) {
    return FUNCTIONS.find((f) => f.id === id) || null;
  }

  /** Działy — każdy ma własną listę obszarów szkoleniowych. */
  const TRAIN_LU_TKT_SEL = ["LU", "Tickety", "Selekcja"];
  const TRAINING_AREAS = [
    { id: "LU",        label: "Lay-up (LU)", short: "LU",  color: "#f97316" },
    { id: "Tickety",   label: "Tickety",     short: "TKT", color: "#ec4899" },
    { id: "Selekcja",  label: "Selekcja",    short: "SEL", color: "#14b8a6" },
    { id: "FLOW",      label: "Flow",        short: "FLW", color: "#8b5cf6" },
  ];
  const DEPARTMENTS = [
    { id: "LTM",  label: "LTM",  color: "#6366f1",  trainings: TRAIN_LU_TKT_SEL },
    { id: "STM",  label: "STM",  color: "#8b5cf6",  trainings: TRAIN_LU_TKT_SEL },
    { id: "BUTY", label: "BUTY", color: "#d97706",  trainings: TRAIN_LU_TKT_SEL },
    { id: "APP",  label: "APP",  color: "#10b981",  trainings: TRAIN_LU_TKT_SEL },
    { id: "KIDS", label: "KIDS", color: "#e11d48",  trainings: TRAIN_LU_TKT_SEL },
    { id: "BBM",  label: "BBM",  color: "#eab308",  trainings: TRAIN_LU_TKT_SEL },
    { id: "HGS",  label: "HGS",  color: "#0ea5e9",  trainings: ["FLOW", "Selekcja"] },
    { id: "RCV",  label: "RCV",  color: "#a855f7",  trainings: ["FLOW"] },
    { id: "SHIP", label: "SHIP", color: "#0891b2",  trainings: ["FLOW"] },
    { id: "BULK", label: "BULK", color: "#64748b",  trainings: ["FLOW"] },
  ];

  function getDepartment(id) {
    return DEPARTMENTS.find((d) => d.id === id) || null;
  }
  function getTrainingArea(id) {
    return TRAINING_AREAS.find((t) => t.id === id) || null;
  }
  function getDepartmentTrainings(deptId) {
    const dept = getDepartment(deptId);
    if (!dept || !Array.isArray(dept.trainings)) return [];
    return dept.trainings.map(getTrainingArea).filter(Boolean);
  }

  function isValidTrainingPair(deptId, areaId) {
    const dept = getDepartment(deptId);
    return Boolean(dept && dept.trainings.includes(areaId) && getTrainingArea(areaId));
  }
  function trainingKey(deptId, areaId) {
    return deptId + "|" + areaId;
  }
  function normalizeTrainingList(raw, legacyDept) {
    const out = [];
    const seen = new Set();
    function add(deptId, areaId) {
      if (!isValidTrainingPair(deptId, areaId)) return;
      const k = trainingKey(deptId, areaId);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ dept: deptId, area: areaId });
    }
    if (!Array.isArray(raw)) return out;
    for (const item of raw) {
      if (typeof item === "string" && legacyDept) add(legacyDept, item);
      else if (item && typeof item === "object") add(item.dept, item.area);
    }
    return out;
  }

  function normalizeAin(raw) {
    return String(raw || "").replace(/\D/g, "").slice(0, 9);
  }

  function normalizeEmployeeFields(emp) {
    const legacyDept = typeof emp.dept === "string" ? emp.dept : "";
    emp.trainings = normalizeTrainingList(emp.trainings, legacyDept);
    if ("dept" in emp) delete emp.dept;
    emp.ain = normalizeAin(emp.ain);
    emp.absExcluded = Boolean(emp.absExcluded);
  }

  const POLISH_MONTHS = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
  ];
  const POLISH_DOW = ["nd", "pn", "wt", "śr", "cz", "pt", "so"];

  // Kody absencji.
  //   hourly:  true  → kod rozliczany godzinowo (pula w godzinach)
  //   hourly:  false → kod rozliczany dziennie  (pula w dniach roboczych)
  //   absence: true  → wlicza się do wskaźnika % absencji (nieobecności
  //            nieplanowane/usprawiedliwione wg praktyki HR i prawa pracy);
  //            urlopy planowane (wypoczynkowy, dodatkowy) się NIE wliczają.
  const CODES = [
    { code: "ZAL", label: "Zaległy (ub. rok)", article: "art. 168 KP",  defaultPool:  0,   hourly: false, absence: false },
    { code: "U",   label: "Wypoczynkowy",     article: "art. 154 KP",   defaultPool: 26,   hourly: false, absence: false },
    { code: "D",   label: "Dodatkowy",        article: "regulamin",     defaultPool:  6,   hourly: false, absence: false },
    { code: "UŻ",  label: "Na żądanie",       article: "art. 167² KP",  defaultPool:  4,   hourly: false, absence: true  },
    { code: "SW",  label: "Siła wyższa",      article: "art. 148¹ KP",  defaultPool: 16,   hourly: true,  absence: true  },
    { code: "OPR", label: "Opieka rodzina",   article: "art. 173¹ KP",  defaultPool:  5,   hourly: false, absence: true  },
    { code: "OP",  label: "Opieka dziecko",   article: "art. 188 KP",   defaultPool: 16,   hourly: true,  absence: true  },
    { code: "KREW", label: "Krwiodastwo",     article: "art. 128¹ KP",  defaultPool: null, hourly: false, absence: true  },
    { code: "NUN", label: "Obecność niepłatna", article: "art. 174 KP", defaultPool: null, hourly: false, absence: true  },
    { code: "M",   label: "Urlop macierzyński", article: "art. 180 KP", defaultPool: null, hourly: false, absence: false },
    { code: "ZM",  label: "Zwolnienie macierzyńskie", article: "L4 w ciąży, art. 92 KP", defaultPool: null, hourly: false, absence: true },
    { code: "L",   label: "L4 (chorobowe)",   article: "art. 92 KP",    defaultPool: null, hourly: false, absence: true  },
  ];

  const ABSENCE_CODES = new Set(CODES.filter((c) => c.absence).map((c) => c.code));

  const PROW_LAYUP_ID = "prow-layup";

  // Migracja kodów ze starej wersji v1 (pojedyncze litery)
  const OLD_TO_NEW_CODE = {
    F: "D",
    Z: "UŻ",
    S: "SW",
    R: "OPR",
    D: "OP",
  };

  // ─── state ────────────────────────────────────────────────────────────
  let state = {
    version: STATE_VERSION,
    year: new Date().getFullYear(),
    activeCode: "U",
    activeHours: 8,
    employees: [],
  };

  let lastClickedCell = null;       // { empId, dateKey, td } - do shift+click
  let lastBlockedToast = 0;         // debounce toastów "weekend/święto"
  let lastProwLayupToast = 0;       // debounce ostrzeżenia prow-layup
  let _holMapCache = { year: null, map: null };
  let selectedDayKey = null;        // wybrany dzień dla panelu statystyk (nie persistowany)
  let selectedDayKeys = new Set();  // zaznaczone dni (Ctrl+klik = wiele) dla panelu sumy urlopów
  let viewMode = "year";            // zakres widoku: "year" | "month" | "weeks"
  let viewMonth = new Date().getMonth();
  let viewWeekFromIdx = 0;          // indeksy w liście tygodni roku
  let viewWeekToIdx = 0;
  let empModalCtx = null;           // { mode: "add"|"edit", id }
  let empModalTrainings = [];       // tymczasowa lista szkoleń w modalu

  function getHolMap(year) {
    if (_holMapCache.year !== year) {
      _holMapCache.year = year;
      _holMapCache.map = H.holidayMap(year);
    }
    return _holMapCache.map;
  }

  // ─── persistence (serwer) ─────────────────────────────────────────────
  let saveTimer = null;
  // Wskaźnik zapisu w nagłówku: dirty = zmiany czekają na wysłanie/potwierdzenie
  const saveInfo = { dirty: false, error: false, lastSavedAt: null, everChanged: false };
  let lastSaveErrToast = 0;

  async function loadState() {
    try {
      const res = await fetch("/api/state", { credentials: "same-origin" });
      if (res.status === 401) {
        window.location.href = "/login.html";
        return false;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);

      let parsed = await res.json();
      const hadLocal = localStorage.getItem(STORAGE_KEY);
      const serverEmpty = !parsed?.employees?.length;

      if (serverEmpty && hadLocal) {
        try {
          parsed = JSON.parse(hadLocal);
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }
      }

      if (parsed && typeof parsed === "object") {
        const oldVersion = parsed.version;
        state = Object.assign(state, parsed);
        migrateState(state);
        if (oldVersion !== state.version) saveState();
        for (const emp of state.employees) {
          if (!emp.pools) emp.pools = {};
          for (const c of CODES) {
            if (c.defaultPool !== null && emp.pools[c.code] === undefined) {
              emp.pools[c.code] = c.defaultPool;
            }
          }
          if (!emp.days || typeof emp.days !== "object") emp.days = {};
          if (typeof emp.lastName !== "string") emp.lastName = "";
          if (typeof emp.firstName !== "string") emp.firstName = "";
          if (!Array.isArray(emp.funcs)) emp.funcs = [];
          normalizeEmployeeFields(emp);
        }
        if (serverEmpty && hadLocal) {
          saveState();
          showToast("Przeniesiono dane z tej przeglądarki na serwer.");
        }
      }
      return true;
    } catch (e) {
      console.warn("Błąd wczytywania stanu:", e);
      showToast("Nie udało się wczytać danych z serwera.");
      return false;
    }
  }

  function saveState() {
    saveInfo.dirty = true;
    saveInfo.everChanged = true;
    updateSaveStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 1500);
  }

  async function flushSave() {
    try {
      const res = await fetch("/api/state", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      saveInfo.dirty = false;
      saveInfo.error = false;
      saveInfo.lastSavedAt = Date.now();
      updateSaveStatus();
    } catch (e) {
      console.warn("Nie udało się zapisać:", e);
      saveInfo.error = true;
      updateSaveStatus();
      if (Date.now() - lastSaveErrToast > 15000) {
        lastSaveErrToast = Date.now();
        showToast("Błąd zapisu — ponawiam automatycznie…");
      }
      // Automatyczna ponowna próba — zmiany wciąż czekają w pamięci
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 5000);
    }
  }

  function fmtAgo(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 5) return "przed chwilą";
    if (s < 60) return s + " s temu";
    const m = Math.floor(s / 60);
    if (m < 60) return m + " min temu";
    const d = new Date(Date.now() - ms);
    return "o " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function updateSaveStatus() {
    const el = document.getElementById("saveStatus");
    if (!el) return;
    if (saveInfo.error && saveInfo.dirty) {
      el.className = "save-status error";
      el.textContent = "⚠ Błąd zapisu — ponawiam…";
      el.title = "Nie udało się wysłać zmian na serwer. Próba zostanie powtórzona automatycznie. Nie zamykaj strony.";
      return;
    }
    if (saveInfo.dirty) {
      el.className = "save-status dirty";
      el.textContent = "● Zapisywanie…";
      el.title = "Zmiany są wysyłane na serwer. Poczekaj na „Zapisano” przed zamknięciem strony.";
      return;
    }
    if (saveInfo.lastSavedAt) {
      el.className = "save-status saved";
      el.textContent = "✓ Zapisano · " + fmtAgo(Date.now() - saveInfo.lastSavedAt);
      el.title = "Wszystkie zmiany zostały wysłane na serwer — można bezpiecznie zamknąć stronę.";
      return;
    }
    el.className = "save-status idle";
    el.textContent = "Brak zmian";
    el.title = "Od otwarcia strony nie wprowadzono żadnych zmian.";
  }

  function migrateState(s) {
    if (s.version === STATE_VERSION) return;

    // v? → v2: kody pojedyncze litery → nowe wieloliterowe
    if (!s.version || s.version < 2) {
      for (const emp of s.employees || []) {
        if (emp.pools) {
          const newPools = {};
          for (const [k, v] of Object.entries(emp.pools)) {
            newPools[OLD_TO_NEW_CODE[k] || k] = v;
          }
          emp.pools = newPools;
        }
        if (emp.days) {
          const newDays = {};
          for (const [k, v] of Object.entries(emp.days)) {
            if (typeof v === "string") {
              newDays[k] = OLD_TO_NEW_CODE[v] || v;
            } else if (v && typeof v === "object" && v.code) {
              newDays[k] = Object.assign({}, v, { code: OLD_TO_NEW_CODE[v.code] || v.code });
            }
          }
          emp.days = newDays;
        }
      }
      if (s.activeCode && OLD_TO_NEW_CODE[s.activeCode]) {
        s.activeCode = OLD_TO_NEW_CODE[s.activeCode];
      }
      if (typeof s.activeHours !== "number") s.activeHours = 8;
      s.version = 2;
    }

    // v2 → v3: SW i OP — pula z dni na godziny (×8)
    if (s.version === 2) {
      for (const emp of s.employees || []) {
        if (emp.pools) {
          if (typeof emp.pools.SW === "number") emp.pools.SW = emp.pools.SW * 8;
          if (typeof emp.pools.OP === "number") emp.pools.OP = emp.pools.OP * 8;
        }
      }
      s.version = 3;
    }

    // v3 → v4: rozbicie name → lastName + firstName, dodanie func
    if (s.version === 3) {
      for (const emp of s.employees || []) {
        if (typeof emp.lastName !== "string" && typeof emp.firstName !== "string") {
          // Stara konwencja placeholderu była "Imię i nazwisko" — pierwsze słowo = imię,
          // pozostałe = nazwisko. Brak spacji → cała wartość traktujemy jako nazwisko.
          const raw = (emp.name || "").trim();
          if (!raw) {
            emp.firstName = "";
            emp.lastName  = "";
          } else {
            const parts = raw.split(/\s+/);
            if (parts.length === 1) {
              emp.firstName = "";
              emp.lastName  = parts[0];
            } else {
              emp.firstName = parts[0];
              emp.lastName  = parts.slice(1).join(" ");
            }
          }
        }
        if (typeof emp.func !== "string") emp.func = "";
      }
      s.version = 4;
    }

    // v4 → v5: func (string) → funcs (array) — wiele funkcji na pracownika
    if (s.version === 4) {
      for (const emp of s.employees || []) {
        if (Array.isArray(emp.funcs)) {
          // już ma poprawne pole — zostawiamy
        } else if (typeof emp.func === "string" && emp.func) {
          emp.funcs = [emp.func];
        } else {
          emp.funcs = [];
        }
        delete emp.func;
      }
      s.version = 5;
    }

    // v5 → v6: dział + ukończone szkolenia obszarowe
    if (s.version === 5) {
      for (const emp of s.employees || []) {
        if (typeof emp.dept !== "string") emp.dept = "";
        if (!Array.isArray(emp.trainings)) emp.trainings = [];
      }
      s.version = 6;
    }

    // v6 → v7: wiele działów — szkolenia jako { dept, area }
    if (s.version === 6) {
      for (const emp of s.employees || []) {
        normalizeEmployeeFields(emp);
      }
      s.version = 7;
    }

    // v7 → v8: numer AIN pracownika
    if (s.version === 7) {
      for (const emp of s.employees || []) {
        if (typeof emp.ain !== "string") emp.ain = "";
        emp.ain = normalizeAin(emp.ain);
      }
      s.version = 8;
    }

    // v8 → v9: flaga wykluczenia ze statystyk absencji działu (np. kierownik)
    // + AIN skrócony z 10 do 9 cyfr
    if (s.version === 8) {
      for (const emp of s.employees || []) {
        emp.absExcluded = Boolean(emp.absExcluded);
        emp.ain = normalizeAin(emp.ain);
      }
      s.version = 9;
    }
  }

  // ─── helpery: wartość komórki (string lub obiekt {code, h}) ───────────
  function codeCssId(code) {
    return (code || "").replace(/Ż/g, "Z");
  }
  function getCode(val) {
    if (!val) return null;
    return typeof val === "string" ? val : val.code;
  }
  function getHours(val) {
    if (!val) return 0;
    if (typeof val === "string") return 8;
    return val.h || 8;
  }
  function makeValue(code, hours) {
    if (!code) return null;
    if (!hours || hours >= 8) return code;
    return { code: code, h: hours };
  }
  function valuesEqual(a, b) {
    return getCode(a) === getCode(b) && getHours(a) === getHours(b);
  }
  function isHourlyCode(code) {
    const c = CODES.find(function (x) { return x.code === code; });
    return c && c.hourly;
  }
  function formatUsage(days) {
    if (Number.isInteger(days)) return String(days);
    const s = days.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return s.replace(".", ",");
  }
  // Jednostka, w jakiej liczona jest pula danego kodu
  //   hourly: godziny;  inne: dni
  // Tylko null/undefined (brak puli, np. L4) = brak limitu.
  // Pula 0 = zero dozwolonych dni/godzin.
  function poolHoursLimit(emp, code) {
    const pool = emp.pools[code];
    if (pool === null || pool === undefined || typeof pool !== "number" || isNaN(pool)) return Infinity;
    const clamped = Math.max(0, pool);
    return isHourlyCode(code) ? clamped : clamped * 8;
  }
  function fitsPool(emp, code, oldVal, newHoursForCell, includeUZinU) {
    const limit = poolHoursLimit(emp, code);
    if (limit === Infinity) return true;
    const oldCode = getCode(oldVal);
    let current = getUsage(emp, code, state.year).totalHours;
    let oldCounted = oldCode === code ? getHours(oldVal) : 0;
    if (includeUZinU && code === "U") {
      current += getUsage(emp, "UŻ", state.year).totalHours;
      if (oldCode === "UŻ") oldCounted = getHours(oldVal);
    }
    return (current - oldCounted + newHoursForCell) <= limit;
  }

  // UŻ (na żądanie) jest częścią puli urlopu wypoczynkowego (art. 167² KP):
  // dzień UŻ pomniejsza również limit U.
  function wouldFitInPool(emp, newCode, oldVal, newHoursForCell) {
    if (newCode === "U") return fitsPool(emp, "U", oldVal, newHoursForCell, true);
    if (newCode === "UŻ") {
      return fitsPool(emp, "UŻ", oldVal, newHoursForCell, false) &&
             fitsPool(emp, "U", oldVal, newHoursForCell, true);
    }
    return fitsPool(emp, newCode, oldVal, newHoursForCell, false);
  }

  // ─── helpers ──────────────────────────────────────────────────────────
  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function makeEmployee(opts) {
    opts = opts || {};
    const pools = {};
    for (const c of CODES) {
      if (c.defaultPool !== null) pools[c.code] = c.defaultPool;
    }
    return {
      id: createId(),
      lastName:  opts.lastName  || "",
      firstName: opts.firstName || "",
      ain:       normalizeAin(opts.ain),
      absExcluded: Boolean(opts.absExcluded),
      funcs:     Array.isArray(opts.funcs) ? opts.funcs.slice() : [],
      trainings: normalizeTrainingList(opts.trainings, ""),
      pools,
      days: {},
    };
  }

  let empInfoHideTimer = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getEmpFuncs(emp) {
    return (Array.isArray(emp.funcs) ? emp.funcs : []).map(getFunction).filter(Boolean);
  }

  function getEmpTrainingsByDept(emp) {
    const groups = new Map();
    for (const tr of normalizeTrainingList(emp.trainings, "")) {
      const dept = getDepartment(tr.dept);
      const area = getTrainingArea(tr.area);
      if (!dept || !area) continue;
      if (!groups.has(dept.id)) groups.set(dept.id, { dept, areas: [] });
      groups.get(dept.id).areas.push(area);
    }
    return Array.from(groups.values()).sort((a, b) => a.dept.label.localeCompare(b.dept.label, "pl"));
  }

  function renderEmpInfoPopover(emp) {
    const pop = document.getElementById("empInfoPopover");
    const funcs = getEmpFuncs(emp);
    const deptGroups = getEmpTrainingsByDept(emp);
    const name = getDisplayName(emp);
    const ain = normalizeAin(emp.ain);
    const ainRow = ain
      ? `<div class="emp-info-ain"><span class="emp-info-ain-label">Nr AIN</span><span class="emp-info-ain-value">${escapeHtml(ain)}</span></div>`
      : "";

    let funcRows = "";
    if (funcs.length === 0) {
      funcRows = '<tr><td class="emp-info-empty" colspan="2">Brak przypisanych obszarów</td></tr>';
    } else {
      funcRows = funcs.map((fn) =>
        `<tr>
          <td><span class="emp-info-dot" style="background:${fn.color}"></span></td>
          <td>${fn.label}</td>
        </tr>`
      ).join("");
    }

    let trainRows = "";
    if (deptGroups.length === 0) {
      trainRows = '<tr><td class="emp-info-empty" colspan="2">Brak szkoleń</td></tr>';
    } else {
      trainRows = deptGroups.map(({ dept, areas }) => {
        const areaTags = areas.map((a) =>
          `<span class="emp-info-area-tag" style="background:${a.color}">${a.short}</span>`
        ).join("");
        return `<tr>
          <td><span class="emp-info-dept" style="background:${dept.color}">${dept.label}</span></td>
          <td class="emp-info-areas">${areaTags}</td>
        </tr>`;
      }).join("");
    }

    pop.innerHTML = `
      <div class="emp-info-title">${escapeHtml(name)}</div>
      ${ainRow}
      <div class="emp-info-grid">
        <div class="emp-info-section">
          <div class="emp-info-section-title">Obszary pracy</div>
          <table class="emp-info-table">
            <tbody>${funcRows}</tbody>
          </table>
        </div>
        <div class="emp-info-section">
          <div class="emp-info-section-title">Szkolenia (działy)</div>
          <table class="emp-info-table">
            <tbody>${trainRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function positionEmpInfoPopover(anchor, pop) {
    const rect = anchor.getBoundingClientRect();
    pop.hidden = false;
    const margin = 8;
    let left = rect.right + margin;
    let top = rect.top + (rect.height - pop.offsetHeight) / 2;

    if (left + pop.offsetWidth > window.innerWidth - margin) {
      left = rect.left - pop.offsetWidth - margin;
    }
    if (top + pop.offsetHeight > window.innerHeight - margin) {
      top = window.innerHeight - pop.offsetHeight - margin;
    }
    if (top < margin) top = margin;

    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }

  function showEmpInfoPopover(anchorEl, emp) {
    clearTimeout(empInfoHideTimer);
    renderEmpInfoPopover(emp);
    positionEmpInfoPopover(anchorEl, document.getElementById("empInfoPopover"));
  }

  function hideEmpInfoPopover() {
    const pop = document.getElementById("empInfoPopover");
    if (pop) pop.hidden = true;
  }

  function attachEmpInfoHover(tdName, emp) {
    tdName.addEventListener("mouseenter", () => showEmpInfoPopover(tdName, emp));
    tdName.addEventListener("mouseleave", () => {
      empInfoHideTimer = setTimeout(hideEmpInfoPopover, 150);
    });
  }

  function getDisplayName(emp) {
    const ln = (emp.lastName  || "").trim();
    const fn = (emp.firstName || "").trim();
    if (ln && fn) return ln + " " + fn;       // "Kowalski Jan"
    if (ln)       return ln;
    if (fn)       return fn;
    // Fallback dla starych danych nieprzemigrowanych
    return (emp.name || "").trim() || "(bez nazwiska)";
  }

  function getUsage(emp, code, year) {
    const prefix = `${year}-`;
    const holMap = getHolMap(year);
    let totalHours = 0;
    for (const [k, v] of Object.entries(emp.days)) {
      if (!k.startsWith(prefix)) continue;
      if (getCode(v) !== code) continue;
      const d = parseDateKey(k);
      if (!d) continue;
      // Nie licz weekendów i świąt — to dni wolne, nie absencje
      if (H.isWeekend(d)) continue;
      if (holMap.has(k)) continue;
      totalHours += getHours(v);
    }
    return { totalHours: totalHours, days: totalHours / 8 };
  }

  function isLockedTd(td) {
    if (!td) return false;
    return td.classList.contains("weekend") || td.classList.contains("holiday");
  }

  function isLockedKey(key) {
    const d = parseDateKey(key);
    if (!d) return false;
    if (H.isWeekend(d)) return true;
    return getHolMap(state.year).has(key);
  }

  function notifyBlocked(msg) {
    const now = Date.now();
    if (now - lastBlockedToast > 2500) {
      showToast(msg || "Nie można dodać urlopu w weekend lub święto");
      lastBlockedToast = now;
    }
  }

  function isWorkingDayKey(key) {
    const d = parseDateKey(key);
    if (!d) return false;
    if (H.isWeekend(d)) return false;
    return !getHolMap(state.year).has(key);
  }

  // Ostrzeżenie: wszyscy z funkcją Prowadzenie lay-up nieobecni w danym dniu roboczym
  function checkProwLayupCoverage(key) {
    if (!isWorkingDayKey(key)) return { warn: false, total: 0, present: 0 };

    const prowEmps = state.employees.filter(
      (e) => Array.isArray(e.funcs) && e.funcs.includes(PROW_LAYUP_ID)
    );
    if (prowEmps.length === 0) return { warn: false, total: 0, present: 0 };

    const present = prowEmps.filter((e) => !isEmpAbsentOn(e, key)).length;
    return {
      warn: present === 0,
      total: prowEmps.length,
      present,
    };
  }

  function notifyProwLayupWarning(coverage) {
    const now = Date.now();
    if (now - lastProwLayupToast > 3000) {
      const n = coverage.total;
      showToast(`⚠ KRYTYCZNE: Brak prowadzącego lay-up! Wszystkie ${n} osoby nieobecne`, "alert");
      lastProwLayupToast = now;
    }
  }

  function updateProwLayupHeaderMark(key) {
    const th = document.querySelector(`.kalendarz-scroll thead .day-header[data-date-key="${key}"]`);
    if (!th) return;
    const cov = checkProwLayupCoverage(key);
    th.classList.toggle("prow-layup-warn", cov.warn);
  }

  function renderDayCell(td, val) {
    td.removeAttribute("data-code");
    td.innerHTML = "";
    if (!val) return;
    const code = getCode(val);
    const hours = getHours(val);
    td.setAttribute("data-code", code);

    const letters = document.createElement("span");
    letters.className = "code-letters";
    letters.textContent = code;
    td.appendChild(letters);

    if (hours < 8) {
      const tag = document.createElement("span");
      tag.className = "hours-tag";
      tag.textContent = hours + "h";
      td.appendChild(tag);
    }
  }

  function syncFrozenColgroup(fixedSpec) {
    const table = document.querySelector("table.kalendarz-frozen");
    if (!table) return;
    let cg = table.querySelector("colgroup");
    if (!cg) {
      cg = document.createElement("colgroup");
      table.insertBefore(cg, table.firstChild);
    }
    cg.replaceChildren();
    for (const spec of fixedSpec) {
      const col = document.createElement("col");
      col.className = spec.cls;
      const w = STICKY_COL_WIDTHS[spec.cls];
      if (w) col.style.width = w + "px";
      cg.appendChild(col);
    }
  }

  // ─── widok: zakres wyświetlanych dni ──────────────────────────────────
  function getYearWeeksList(year) {
    const list = [];
    for (const d of H.buildYearDates(year)) {
      const wk = H.fiscalWeekNumber(d);
      if (!list.length || list[list.length - 1].wk !== wk) list.push({ wk, dates: [] });
      list[list.length - 1].dates.push(d);
    }
    return list;
  }

  function getVisibleDates() {
    const all = H.buildYearDates(state.year);
    if (viewMode === "month") {
      return all.filter((d) => d.getMonth() === viewMonth);
    }
    if (viewMode === "weeks") {
      const list = getYearWeeksList(state.year);
      const from = Math.max(0, Math.min(viewWeekFromIdx, viewWeekToIdx));
      const to = Math.min(list.length - 1, Math.max(viewWeekFromIdx, viewWeekToIdx));
      const keys = new Set();
      for (let i = from; i <= to; i++) {
        for (const d of list[i].dates) keys.add(H.dateKey(d));
      }
      return all.filter((d) => keys.has(H.dateKey(d)));
    }
    return all;
  }

  function fmtShortDate(d) {
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function populateViewSelectors() {
    const mSel = document.getElementById("viewMonthSel");
    mSel.innerHTML = "";
    POLISH_MONTHS.forEach((m, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = m;
      if (i === viewMonth) o.selected = true;
      mSel.appendChild(o);
    });

    const list = getYearWeeksList(state.year);
    if (viewWeekFromIdx >= list.length) viewWeekFromIdx = 0;
    if (viewWeekToIdx >= list.length) viewWeekToIdx = list.length - 1;
    for (const [selId, selectedIdx] of [["viewWeekFrom", viewWeekFromIdx], ["viewWeekTo", viewWeekToIdx]]) {
      const sel = document.getElementById(selId);
      sel.innerHTML = "";
      list.forEach((g, i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = `W${g.wk} (${fmtShortDate(g.dates[0])})`;
        if (i === selectedIdx) o.selected = true;
        sel.appendChild(o);
      });
    }
  }

  function syncViewBarVisibility() {
    document.getElementById("viewMonthSel").hidden = viewMode !== "month";
    document.getElementById("viewWeeksWrap").hidden = viewMode !== "weeks";
  }

  // ─── czyszczenie absencji tygodnia ────────────────────────────────────
  function clearWeekAbsences(wkLabel, datesArr) {
    const keys = datesArr.map((d) => H.dateKey(d));
    const first = datesArr[0];
    const last = datesArr[datesArr.length - 1];
    if (!confirm(
      `Usunąć WSZYSTKIE absencje wszystkich pracowników w tygodniu ${wkLabel} ` +
      `(${fmtShortDate(first)}–${fmtShortDate(last)}.${state.year})?\n\nTej operacji nie można cofnąć.`
    )) return;

    let removed = 0;
    for (const emp of state.employees) {
      for (const k of keys) {
        if (emp.days && emp.days[k]) { delete emp.days[k]; removed++; }
      }
    }
    if (!removed) {
      showToast("Brak absencji w tym tygodniu");
      return;
    }
    saveState();
    renderAll();
    showToast(`Usunięto ${removed} wpisów absencji z tygodnia ${wkLabel}`);
  }

  // ─── render: header ───────────────────────────────────────────────────
  function renderHead(dates, holMap, todayKey) {
    const theadFrozen = document.getElementById("kalendarzHeadFrozen");
    const theadScroll = document.getElementById("kalendarzHead");
    theadFrozen.innerHTML = "";
    theadScroll.innerHTML = "";

    const fixedSpec = [
      { cls: "col-lp",      label: "" },
      { cls: "col-name",    label: "Pracownik" },
    ];
    for (const c of CODES.filter((c) => c.defaultPool !== null)) {
      fixedSpec.push({ cls: "col-pool", label: "" });
      fixedSpec.push({ cls: "col-wyk",  label: "" });
    }
    fixedSpec.push({ cls: "col-l4", label: "" });
    fixedSpec.push({ cls: "col-m", label: "" });
    fixedSpec.push({ cls: "col-zm", label: "" });
    fixedSpec.push({ cls: "col-abs", label: "" });
    fixedSpec.push({ cls: "col-actions", label: "" });
    syncFrozenColgroup(fixedSpec);

    // ── wiersz 1: miesiące ──
    const trMonthF = document.createElement("tr");
    trMonthF.className = "row-months";
    fixedSpec.forEach((spec) => {
      const th = document.createElement("th");
      th.className = `fixed-cell ${spec.cls}`;
      th.textContent = spec.label;
      trMonthF.appendChild(th);
    });
    theadFrozen.appendChild(trMonthF);

    const trMonthS = document.createElement("tr");
    trMonthS.className = "row-months";
    let currentMonth = -1;
    let monthTh = null;
    let dayInMonth = 0;
    dates.forEach((d) => {
      if (d.getMonth() !== currentMonth) {
        if (monthTh) monthTh.colSpan = dayInMonth;
        currentMonth = d.getMonth();
        dayInMonth = 0;
        monthTh = document.createElement("th");
        monthTh.className = "month-header " + (currentMonth % 2 === 0 ? "odd-month" : "even-month");
        monthTh.textContent = POLISH_MONTHS[currentMonth];
        trMonthS.appendChild(monthTh);
      }
      dayInMonth++;
    });
    if (monthTh) monthTh.colSpan = dayInMonth;
    theadScroll.appendChild(trMonthS);

    // ── wiersz 2: tygodnie fiskalne ──
    const trWeekF = document.createElement("tr");
    trWeekF.className = "row-weeks";
    fixedSpec.forEach((spec) => {
      const th = document.createElement("th");
      th.className = `fixed-cell ${spec.cls}`;
      if (spec.cls === "col-name") {
        th.innerHTML = `<span class="week-row-label">Tydz.</span><span class="week-row-sublabel">fisk.</span>`;
        th.title = "Tydzień fiskalny — rok od 1 lutego (Week 1)";
      }
      trWeekF.appendChild(th);
    });
    theadFrozen.appendChild(trWeekF);

    const trWeekS = document.createElement("tr");
    trWeekS.className = "row-weeks";
    const weekGroups = [];
    dates.forEach((d) => {
      const wk = H.fiscalWeekNumber(d);
      if (!weekGroups.length || weekGroups[weekGroups.length - 1].wk !== wk) {
        weekGroups.push({ wk, dates: [] });
      }
      weekGroups[weekGroups.length - 1].dates.push(d);
    });
    for (const g of weekGroups) {
      const weekTh = document.createElement("th");
      weekTh.className = "week-header week-clickable";
      const isWeekOne = g.wk === 1;
      if (isWeekOne) weekTh.classList.add("week-one");
      const label = H.fiscalWeekLabel(g.wk, isWeekOne);
      weekTh.textContent = label;
      weekTh.colSpan = g.dates.length;
      const fyStart = H.fiscalYearStart(g.dates[0]);
      const baseTitle = isWeekOne
        ? "Week 1 — początek roku fiskalnego (1 lutego)"
        : `Tydzień fiskalny ${g.wk} (rok od ${fyStart.getDate()} ${POLISH_MONTHS[fyStart.getMonth()].toLowerCase()} ${fyStart.getFullYear()})`;
      weekTh.title = baseTitle + "\nKliknij, aby wyczyścić WSZYSTKIE absencje w tym tygodniu.";
      const wkDates = g.dates.slice();
      weekTh.addEventListener("click", () => clearWeekAbsences(label, wkDates));
      trWeekS.appendChild(weekTh);
    }
    theadScroll.appendChild(trWeekS);

    // ── wiersz 3: kolumny absencji + numery dni ──
    const trDaysF = document.createElement("tr");
    trDaysF.className = "row-days";
    const fixedDayCells = [
      { cls: "col-lp",   html: `<span class="lp-hdr" title="Przeciągnij ⋮⋮ aby zmienić kolejność">Lp.</span>` },
      { cls: "col-name", html: "Imię i nazwisko" },
    ];
    for (const c of CODES.filter((c) => c.defaultPool !== null)) {
      const cssId = codeCssId(c.code);
      const unit = c.hourly ? "godz." : "dni";
      fixedDayCells.push({
        cls: "col-pool",
        code: c.code,
        html: `<div class="hdr-pool"><span class="hdr-code hdr-code-${cssId}">${c.code}</span><span class="hdr-sub">PULA</span><span class="hdr-unit">${unit}</span></div>`,
        title: `${c.label} – pula w ${unit}`,
      });
      fixedDayCells.push({
        cls: "col-wyk",
        code: c.code,
        html: `<div class="hdr-wyk"><span class="hdr-sub">WYK.</span><span class="hdr-unit">z puli</span></div>`,
        title: `${c.label} – wykorzystane (${unit}) / pula`,
      });
    }
    fixedDayCells.push({
      cls: "col-l4",
      code: "L",
      html: `<div class="hdr-l4"><span class="hdr-code hdr-code-L">L4</span><span class="hdr-unit">dni</span></div>`,
      title: "Zwolnienie lekarskie",
    });
    fixedDayCells.push({
      cls: "col-m",
      code: "M",
      html: `<div class="hdr-m"><span class="hdr-code hdr-code-M">M</span><span class="hdr-unit">dni</span></div>`,
      title: "Urlop macierzyński (art. 180 KP) — nie wlicza się do % absencji",
    });
    fixedDayCells.push({
      cls: "col-zm",
      code: "ZM",
      html: `<div class="hdr-zm"><span class="hdr-code hdr-code-ZM">ZM</span><span class="hdr-unit">dni</span></div>`,
      title: "Zwolnienie macierzyńskie (L4 w ciąży) — wlicza się do % absencji",
    });
    fixedDayCells.push({
      cls: "col-abs",
      html: `<div class="hdr-abs"><span class="hdr-sub">%ABS dział</span><b class="abs-team-badge" id="absTeamPct">—</b></div>`,
      title: "Procent absencji (bez urlopów U i D). Duża wartość: średnia całego działu.",
    });
    fixedDayCells.push({ cls: "col-actions", html: `<span class="actions-hdr" title="Edytuj / usuń">✎ ×</span>` });

    fixedDayCells.forEach((spec) => {
      const th = document.createElement("th");
      th.className = `fixed-cell ${spec.cls}`;
      th.innerHTML = spec.html;
      if (spec.title) th.title = spec.title;
      if (spec.code) th.dataset.code = spec.code;
      trDaysF.appendChild(th);
    });
    theadFrozen.appendChild(trDaysF);

    const trDaysS = document.createElement("tr");
    trDaysS.className = "row-days";
    dates.forEach((d) => {
      const th = document.createElement("th");
      th.className = "day-header";
      const key = H.dateKey(d);
      th.dataset.dateKey = key;

      if (H.isWeekend(d)) th.classList.add("weekend");
      if (holMap.has(key)) {
        th.classList.add("holiday");
        th.title = (holMap.get(key) || "") + " — kliknij, aby zobaczyć obsadę";
      } else {
        th.title = "Kliknij, aby zobaczyć obsadę dnia";
      }
      const prowCov = checkProwLayupCoverage(key);
      if (prowCov.warn) {
        th.classList.add("prow-layup-warn");
        th.title = "⚠ Brak prowadzącego lay-up — kliknij, aby zobaczyć obsadę";
      }
      if (key === todayKey) th.classList.add("today");
      if (selectedDayKeys.has(key)) th.classList.add("selected");

      th.innerHTML = `<span class="day-num">${d.getDate()}</span><span class="day-dow">${POLISH_DOW[d.getDay()]}</span>`;
      th.addEventListener("click", (e) => selectDay(key, e.ctrlKey || e.metaKey));
      trDaysS.appendChild(th);
    });
    theadScroll.appendChild(trDaysS);
  }

  // ─── render: body ─────────────────────────────────────────────────────
  function renderBody(dates, holMap) {
    const tbodyFrozen = document.getElementById("kalendarzBodyFrozen");
    const tbodyScroll = document.getElementById("kalendarzBody");
    tbodyFrozen.innerHTML = "";
    tbodyScroll.innerHTML = "";

    const frozenColCount = 2 + CODES.filter((c) => c.defaultPool !== null).length * 2 + 5;

    if (state.employees.length === 0) {
      const trF = document.createElement("tr");
      const tdF = document.createElement("td");
      tdF.colSpan = frozenColCount;
      tdF.innerHTML = `
        <div class="empty-state">
          <h2>Brak pracowników</h2>
          <p>Kliknij "+ Dodaj pracownika" w nagłówku, aby zacząć.</p>
        </div>
      `;
      trF.appendChild(tdF);
      tbodyFrozen.appendChild(trF);

      const trS = document.createElement("tr");
      const tdS = document.createElement("td");
      tdS.colSpan = dates.length;
      tdS.className = "cal-scroll-spacer";
      trS.appendChild(tdS);
      tbodyScroll.appendChild(trS);
      return;
    }

    state.employees.forEach((emp, idx) => {
      const trF = document.createElement("tr");
      const trS = document.createElement("tr");
      trF.dataset.empId = emp.id;
      trS.dataset.empId = emp.id;
      if (emp.absExcluded) trF.classList.add("emp-excluded");
      linkRowHover(trF, trS);

      const tdLp = document.createElement("td");
      tdLp.className = "cell-lp col-lp";
      const lpWrap = document.createElement("div");
      lpWrap.className = "lp-wrap";
      const dragHandle = document.createElement("span");
      dragHandle.className = "drag-handle";
      dragHandle.draggable = true;
      dragHandle.title = "Przeciągnij, aby zmienić kolejność";
      dragHandle.textContent = "⋮⋮";
      dragHandle.addEventListener("click", (e) => e.stopPropagation());
      const lpNum = document.createElement("span");
      lpNum.className = "lp-num";
      lpNum.textContent = idx + 1;
      lpWrap.appendChild(dragHandle);
      lpWrap.appendChild(lpNum);
      tdLp.appendChild(lpWrap);
      trF.appendChild(tdLp);

      const tdName = document.createElement("td");
      tdName.className = "cell-name col-name";
      tdName.title = "Najedź — obszary i szkolenia. Kliknij — edycja.";
      const nameWrap = document.createElement("div");
      nameWrap.className = "name-wrap";
      const nameMain = document.createElement("div");
      nameMain.className = "emp-name";
      const display = getDisplayName(emp);
      if (display === "(bez nazwiska)") nameMain.classList.add("placeholder");
      nameMain.textContent = display;
      nameWrap.appendChild(nameMain);
      tdName.appendChild(nameWrap);
      attachEmpInfoHover(tdName, emp);
      tdName.addEventListener("click", () => openEmpModal({ mode: "edit", id: emp.id }));
      trF.appendChild(tdName);

      for (const c of CODES.filter((c) => c.defaultPool !== null)) {
        const tdPool = document.createElement("td");
        tdPool.className = "cell-pool col-pool";
        tdPool.dataset.code = c.code;
        const poolInput = document.createElement("input");
        poolInput.type = "number";
        poolInput.min = "0";
        poolInput.max = "366";
        poolInput.value = emp.pools[c.code] ?? 0;
        poolInput.addEventListener("input", (e) => {
          const v = parseInt(e.target.value, 10);
          emp.pools[c.code] = isNaN(v) ? 0 : v;
          tdPool.classList.toggle("pool-zero", emp.pools[c.code] === 0);
          saveState();
          updateUsageCells(emp);
          updateSummary();
        });
        tdPool.classList.toggle("pool-zero", (emp.pools[c.code] ?? 0) === 0);
        tdPool.appendChild(poolInput);
        trF.appendChild(tdPool);

        const tdWyk = document.createElement("td");
        tdWyk.className = "cell-wyk col-wyk";
        tdWyk.dataset.code = c.code;
        trF.appendChild(tdWyk);
      }

      const tdL4 = document.createElement("td");
      tdL4.className = "cell-l4 col-l4";
      tdL4.dataset.code = "L";
      trF.appendChild(tdL4);

      const tdM = document.createElement("td");
      tdM.className = "cell-m col-m";
      tdM.dataset.code = "M";
      trF.appendChild(tdM);

      const tdZM = document.createElement("td");
      tdZM.className = "cell-zm col-zm";
      tdZM.dataset.code = "ZM";
      trF.appendChild(tdZM);

      const tdAbs = document.createElement("td");
      tdAbs.className = "cell-abs col-abs";
      trF.appendChild(tdAbs);

      const tdActions = document.createElement("td");
      tdActions.className = "cell-actions col-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-edit";
      editBtn.title = "Edytuj pracownika";
      editBtn.textContent = "✎";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEmpModal({ mode: "edit", id: emp.id });
      });
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-del";
      delBtn.title = "Usuń pracownika";
      delBtn.textContent = "×";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeEmployee(emp.id);
      });
      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);
      trF.appendChild(tdActions);

      for (const d of dates) {
        const key = H.dateKey(d);
        const td = document.createElement("td");
        td.className = "day-cell";
        td.dataset.dateKey = key;
        td.dataset.empId = emp.id;
        if (H.isWeekend(d)) td.classList.add("weekend");
        if (holMap.has(key)) {
          td.classList.add("holiday");
          td.title = holMap.get(key);
        }
        renderDayCell(td, emp.days[key]);
        trS.appendChild(td);
      }

      tbodyFrozen.appendChild(trF);
      tbodyScroll.appendChild(trS);
      updateUsageCells(emp);
    });

    syncRowHeights();
  }

  // Wyrównanie wysokości wierszy między lewym panelem a tabelą dni —
  // bez tego wiersze rozjeżdżają się, gdy treść (np. długie nazwisko)
  // podniesie wysokość tylko w jednej z dwóch tabel.
  function syncRowHeights() {
    const rowsF = document.querySelectorAll("#kalendarzBodyFrozen tr");
    const rowsS = document.querySelectorAll("#kalendarzBody tr");
    const n = Math.min(rowsF.length, rowsS.length);
    for (let i = 0; i < n; i++) {
      rowsF[i].style.height = "";
      rowsS[i].style.height = "";
    }
    for (let i = 0; i < n; i++) {
      const h = Math.max(
        rowsF[i].getBoundingClientRect().height,
        rowsS[i].getBoundingClientRect().height
      );
      rowsF[i].style.height = h + "px";
      rowsS[i].style.height = h + "px";
    }
  }

  function updateUsageCells(emp) {
    const tr = document.querySelector(`#kalendarzBodyFrozen tr[data-emp-id="${emp.id}"]`);
    if (!tr) return;

    for (const c of CODES) {
      let td;
      if (c.code === "L")       td = tr.querySelector('td.cell-l4[data-code="L"]');
      else if (c.code === "M")  td = tr.querySelector('td.cell-m[data-code="M"]');
      else if (c.code === "ZM") td = tr.querySelector('td.cell-zm[data-code="ZM"]');
      else                      td = tr.querySelector(`td.cell-wyk[data-code="${c.code}"]`);
      if (!td) continue;

      const usage = getUsage(emp, c.code, state.year);
      let totalHours = usage.totalHours;
      // U pokazuje łączne zużycie: wypoczynkowy + na żądanie (UŻ schodzi z puli U)
      if (c.code === "U") totalHours += getUsage(emp, "UŻ", state.year).totalHours;
      const days = totalHours / 8;
      const pool = emp.pools[c.code];
      const hourly = isHourlyCode(c.code);

      // Wartość użyta w jednostce odpowiadającej puli
      const usedDisplay = hourly ? totalHours : days;
      const usedTxt = formatUsage(usedDisplay);

      // Format wyk./pula + klasy wizualne stanu
      const hasPool = pool !== null && pool !== undefined && typeof pool === "number" && !isNaN(pool);
      td.classList.remove("overdrawn", "usage-active", "usage-clear", "pool-disabled", "usage-full");

      if (hasPool) {
        if (pool === 0) {
          td.textContent = "⊘";
          td.classList.add("pool-disabled");
          td.title = `${c.label} — brak puli (0 ${hourly ? "godz." : "dni"})`;
        } else {
          td.textContent = `(${usedTxt}/${pool})`;
          if (usedDisplay > pool) {
            td.classList.add("overdrawn");
          } else if (usedDisplay > 0) {
            td.classList.add("usage-active");
            if (usedDisplay >= pool) td.classList.add("usage-full");
          } else {
            td.classList.add("usage-clear");
          }
          // Tooltip — pełne info dni + godziny
          const fullDays = Math.floor(totalHours / 8);
          const extraHours = totalHours - fullDays * 8;
          let tip;
          if (extraHours > 0) {
            tip = `${fullDays} dni + ${extraHours} godz. = ${totalHours} godz.`;
          } else {
            tip = `${fullDays} dni (${totalHours} godz.)`;
          }
          tip += ` z puli ${pool} ${hourly ? "godz." : "dni"}`;
          if (c.code === "U") {
            const uzDays = getUsage(emp, "UŻ", state.year).days;
            if (uzDays > 0) tip += ` (w tym ${formatUsage(uzDays)} dni UŻ — na żądanie schodzi z puli U)`;
          }
          if (usedDisplay > pool) tip += " — PRZEKROCZONO LIMIT";
          else if (usedDisplay > 0) tip += " — wykorzystano w limicie";
          td.title = tip;
        }
      } else {
        td.textContent = usedTxt;
        if (usedDisplay > 0) td.classList.add("usage-active");
        const fullDays = Math.floor(totalHours / 8);
        const extraHours = totalHours - fullDays * 8;
        let tip;
        if (extraHours > 0) {
          tip = `${fullDays} dni + ${extraHours} godz. = ${totalHours} godz.`;
        } else {
          tip = `${fullDays} dni (${totalHours} godz.)`;
        }
        td.title = tip;
      }
    }
  }

  // ─── render: code picker ──────────────────────────────────────────────
  function renderCodePicker() {
    const picker = document.getElementById("codePicker");
    picker.innerHTML = '<span class="picker-label">Aktywny kod:</span>';

    for (const c of CODES) {
      const btn = document.createElement("button");
      btn.className = "code-btn";
      if (c.code === state.activeCode) btn.classList.add("active");
      btn.dataset.code = c.code;

      const chip = document.createElement("span");
      chip.className = "code-chip";
      chip.style.background = `var(--code-${codeCssId(c.code)})`;
      chip.textContent = c.code;

      const info = document.createElement("div");
      info.className = "code-info";
      info.innerHTML = `<span class="code-label">${c.label}</span><span class="code-article">${c.article}</span>`;

      btn.appendChild(chip);
      btn.appendChild(info);

      if (c.hourly) {
        const hoursWrap = document.createElement("div");
        hoursWrap.className = "hours-control";
        const lab = document.createElement("span");
        lab.textContent = "godz.";
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = 1;
        inp.max = 8;
        inp.value = (c.code === state.activeCode) ? state.activeHours : 8;
        inp.title = "Liczba godzin (1-8). 8 = cały dzień.";
        inp.addEventListener("click", (e) => e.stopPropagation());
        inp.addEventListener("input", (e) => {
          let h = parseInt(e.target.value, 10);
          if (isNaN(h) || h < 1) h = 1;
          if (h > 8) h = 8;
          e.target.value = h;
          state.activeCode = c.code;
          state.activeHours = h;
          renderCodePicker();
          saveState();
        });
        hoursWrap.appendChild(lab);
        hoursWrap.appendChild(inp);
        btn.appendChild(hoursWrap);
      }

      btn.addEventListener("click", () => {
        state.activeCode = c.code;
        if (!c.hourly) state.activeHours = 8;
        renderCodePicker();
        saveState();
      });
      picker.appendChild(btn);
    }

    const clearBtn = document.createElement("button");
    clearBtn.className = "code-btn clear";
    if (state.activeCode === null) clearBtn.classList.add("active");
    clearBtn.innerHTML = `<span class="code-chip">✗</span><div class="code-info"><span class="code-label">Wyczyść</span><span class="code-article">usuń wpis</span></div>`;
    clearBtn.addEventListener("click", () => {
      state.activeCode = null;
      renderCodePicker();
    });
    picker.appendChild(clearBtn);

    document.body.classList.toggle("clearing-mode", state.activeCode === null);
  }

  // ─── interakcje z komórkami dni ───────────────────────────────────────
  function onCellClick(e) {
    const td = e.target.closest("td.day-cell");
    if (!td) return;

    const empId = td.dataset.empId;
    const key = td.dataset.dateKey;
    const emp = state.employees.find((x) => x.id === empId);
    if (!emp) return;

    // Shift + click → zaznacz zakres w tym samym wierszu
    if (e.shiftKey && lastClickedCell && lastClickedCell.empId === empId) {
      applyToRange(emp, lastClickedCell.dateKey, key);
      lastClickedCell = { empId, dateKey: key };
      return;
    }

    applyToCell(emp, key, td);
    lastClickedCell = { empId, dateKey: key };
  }

  // Zwraca: "ok" | "locked" | "pool" | "noop"
  function applyToCell(emp, key, td, opts) {
    opts = opts || {};
    const silent = !!opts.silent;
    const forceSet = !!opts.forceSet;
    const oldVal = emp.days[key];
    const newCode = state.activeCode;
    const newHours = isHourlyCode(newCode) ? state.activeHours : 8;

    // Blokada: nie wpisuj kodu w weekend lub święto. Wyczyszczenie jest OK.
    const locked = td ? isLockedTd(td) : isLockedKey(key);
    if (newCode !== null && locked) {
      if (!silent) notifyBlocked();
      return "locked";
    }

    if (newCode === null) {
      if (!(key in emp.days)) return "noop";
      delete emp.days[key];
    } else {
      const newVal = makeValue(newCode, newHours);
      if (!forceSet && valuesEqual(oldVal, newVal)) {
        // toggle = wyczyszczenie
        delete emp.days[key];
      } else {
        if (valuesEqual(oldVal, newVal)) return "noop";
        // Sprawdź limit puli
        if (!wouldFitInPool(emp, newCode, oldVal, newHours)) {
          if (!silent) {
            const code = newCode;
            const pool = emp.pools[code];
            const unit = isHourlyCode(code) ? "godz." : "dni";
            if (code === "UŻ" && fitsPool(emp, "UŻ", oldVal, newHours, false)) {
              notifyBlocked(`Pula urlopu wypoczynkowego (U: ${emp.pools["U"]} dni) wyczerpana — UŻ pomniejsza limit U`);
            } else {
              notifyBlocked(`Pula ${code} wyczerpana (${pool} ${unit})`);
            }
          }
          return "pool";
        }
        emp.days[key] = newVal;
      }
    }

    if (td) renderDayCell(td, emp.days[key]);

    saveState();
    updateUsageCells(emp);
    updateSummary();
    renderDayStats();
    updateProwLayupHeaderMark(key);

    if (!silent && isWorkingDayKey(key)) {
      const cov = checkProwLayupCoverage(key);
      if (cov.warn) notifyProwLayupWarning(cov);
    }

    return "ok";
  }

  function applyToRange(emp, fromKey, toKey) {
    const [a, b] = [fromKey, toKey].sort();
    const aDate = parseDateKey(a);
    const bDate = parseDateKey(b);
    if (!aDate || !bDate) return;

    const tr = document.querySelector(`tr[data-emp-id="${emp.id}"]`);

    let cur = new Date(aDate);
    let skipLocked = 0;
    let skipPool = 0;
    while (cur <= bDate) {
      const k = H.dateKey(cur);
      const td = tr ? tr.querySelector(`td.day-cell[data-date-key="${k}"]`) : null;
      const res = applyToCell(emp, k, td, { silent: true, forceSet: true });
      if (res === "locked") skipLocked++;
      else if (res === "pool") skipPool++;
      cur.setDate(cur.getDate() + 1);
    }

    const parts = [];
    if (skipLocked > 0) parts.push(`${skipLocked} dni wolnych`);
    if (skipPool > 0)   parts.push(`${skipPool} ponad limit puli`);
    if (parts.length > 0) {
      notifyBlocked(`Pominięto: ${parts.join(", ")}`);
    }

    // Ostrzeżenie prow-layup dla dni z zakresu
    let cur2 = new Date(aDate);
    let rangeWarn = false;
    while (cur2 <= bDate) {
      const k = H.dateKey(cur2);
      updateProwLayupHeaderMark(k);
      if (!rangeWarn && checkProwLayupCoverage(k).warn) rangeWarn = true;
      cur2.setDate(cur2.getDate() + 1);
    }
    if (rangeWarn) notifyProwLayupWarning(checkProwLayupCoverage(a));
  }

  function parseDateKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return null;
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }

  // ─── pracownicy: modal add / edit ────────────────────────────────────
  function populateTrainDeptSelect() {
    const sel = document.getElementById("trainAddDept");
    if (!sel) return;
    sel.innerHTML = "";
    for (const dept of DEPARTMENTS) {
      const opt = document.createElement("option");
      opt.value = dept.id;
      opt.textContent = dept.label;
      sel.appendChild(opt);
    }
    syncTrainAreaSelect();
  }

  function syncTrainAreaSelect() {
    const deptSel = document.getElementById("trainAddDept");
    const areaSel = document.getElementById("trainAddArea");
    if (!deptSel || !areaSel) return;
    const deptId = deptSel.value;
    areaSel.innerHTML = "";
    for (const area of getDepartmentTrainings(deptId)) {
      const opt = document.createElement("option");
      opt.value = area.id;
      opt.textContent = area.label;
      areaSel.appendChild(opt);
    }
  }

  function setModalTrainings(list) {
    empModalTrainings = normalizeTrainingList(list, "");
    renderModalTrainList();
  }

  function renderModalTrainList() {
    const list = document.getElementById("empTrainList");
    if (!list) return;
    list.innerHTML = "";
    if (!empModalTrainings.length) {
      const empty = document.createElement("p");
      empty.className = "train-empty";
      empty.textContent = "Brak szkoleń — wybierz dział i obszar poniżej.";
      list.appendChild(empty);
      return;
    }
    for (const tr of empModalTrainings) {
      const dept = getDepartment(tr.dept);
      const area = getTrainingArea(tr.area);
      if (!dept || !area) continue;
      const pill = document.createElement("span");
      pill.className = "train-pill";
      pill.title = dept.label + " — " + area.label;

      const deptTag = document.createElement("span");
      deptTag.className = "train-pill-dept";
      deptTag.style.background = dept.color;
      deptTag.textContent = dept.label;

      const areaTag = document.createElement("span");
      areaTag.className = "train-pill-area";
      areaTag.style.background = area.color;
      areaTag.textContent = area.short;

      const lbl = document.createElement("span");
      lbl.className = "train-pill-label";
      lbl.textContent = area.label;

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "train-pill-remove";
      rm.title = "Usuń szkolenie";
      rm.textContent = "×";
      rm.dataset.key = trainingKey(tr.dept, tr.area);
      rm.addEventListener("click", () => {
        empModalTrainings = empModalTrainings.filter(
          (t) => trainingKey(t.dept, t.area) !== rm.dataset.key
        );
        renderModalTrainList();
      });

      pill.appendChild(deptTag);
      pill.appendChild(areaTag);
      pill.appendChild(lbl);
      pill.appendChild(rm);
      list.appendChild(pill);
    }
  }

  function addModalTraining() {
    const dept = document.getElementById("trainAddDept")?.value;
    const area = document.getElementById("trainAddArea")?.value;
    if (!isValidTrainingPair(dept, area)) {
      showToast("Wybierz dział i obszar szkolenia");
      return;
    }
    const before = empModalTrainings.length;
    empModalTrainings = normalizeTrainingList(
      empModalTrainings.concat([{ dept, area }]),
      ""
    );
    if (empModalTrainings.length === before) {
      showToast("To szkolenie jest już na liście");
      return;
    }
    renderModalTrainList();
  }

  function buildFuncCheckboxes(selectedFuncs) {
    const wrap = document.getElementById("empFuncs");
    wrap.innerHTML = "";
    for (const f of FUNCTIONS) {
      const item = document.createElement("label");
      item.className = "checkbox-item";
      const checked = selectedFuncs.indexOf(f.id) !== -1;
      item.innerHTML = `
        <input type="checkbox" value="${f.id}"${checked ? " checked" : ""}>
        <span class="check-mark"></span>
        <span class="check-badge" style="background:${f.color}">${f.short}</span>
        <span class="check-label">${f.label}</span>
      `;
      wrap.appendChild(item);
    }
  }

  function readSelectedFuncs() {
    const wrap = document.getElementById("empFuncs");
    const boxes = wrap.querySelectorAll('input[type="checkbox"]');
    const out = [];
    boxes.forEach((cb) => { if (cb.checked) out.push(cb.value); });
    return out;
  }

  function openEmpModal(ctx) {
    empModalCtx = ctx || { mode: "add" };
    const modal      = document.getElementById("empModal");
    const titleEl    = document.getElementById("empModalTitle");
    const lnInput    = document.getElementById("empLastName");
    const fnInput    = document.getElementById("empFirstName");
    const ainInput   = document.getElementById("empAin");
    const submitBtn  = document.getElementById("empFormSubmitBtn");

    document.getElementById("empClearAbsBtn").hidden = empModalCtx.mode !== "edit";

    if (empModalCtx.mode === "edit") {
      const emp = state.employees.find((e) => e.id === empModalCtx.id);
      if (!emp) { closeEmpModal(); return; }
      titleEl.textContent = "Edytuj pracownika";
      submitBtn.textContent = "Zapisz zmiany";
      lnInput.value = emp.lastName  || "";
      fnInput.value = emp.firstName || "";
      ainInput.value = normalizeAin(emp.ain);
      document.getElementById("empAbsExcluded").checked = Boolean(emp.absExcluded);
      populateTrainDeptSelect();
      setModalTrainings(emp.trainings);
      buildFuncCheckboxes(Array.isArray(emp.funcs) ? emp.funcs : []);
    } else {
      titleEl.textContent = "Dodaj pracownika";
      submitBtn.textContent = "Dodaj";
      lnInput.value = "";
      fnInput.value = "";
      ainInput.value = "";
      document.getElementById("empAbsExcluded").checked = false;
      populateTrainDeptSelect();
      setModalTrainings([]);
      buildFuncCheckboxes([]);
    }

    modal.hidden = false;
    requestAnimationFrame(() => lnInput.focus());
  }

  function closeEmpModal() {
    const modal = document.getElementById("empModal");
    modal.hidden = true;
    empModalCtx = null;
    empModalTrainings = [];
  }

  function submitEmpForm(e) {
    if (e) e.preventDefault();
    const lnInput = document.getElementById("empLastName");
    const fnInput = document.getElementById("empFirstName");
    const ainInput = document.getElementById("empAin");

    const lastName  = lnInput.value.trim();
    const firstName = fnInput.value.trim();
    const ain       = normalizeAin(ainInput.value);
    const trainings = empModalTrainings.slice();
    const funcs     = readSelectedFuncs();
    const absExcluded = document.getElementById("empAbsExcluded").checked;

    if (!lastName)  { lnInput.focus(); showToast("Nazwisko jest wymagane"); return; }
    if (!firstName) { fnInput.focus(); showToast("Imię jest wymagane");    return; }
    if (ain && ain.length !== 9) {
      ainInput.focus();
      showToast("Nr AIN musi mieć dokładnie 9 cyfr");
      return;
    }

    if (empModalCtx && empModalCtx.mode === "edit") {
      const emp = state.employees.find((x) => x.id === empModalCtx.id);
      if (emp) {
        emp.lastName  = lastName;
        emp.firstName = firstName;
        emp.ain       = ain;
        emp.trainings = trainings;
        emp.funcs     = funcs;
        emp.absExcluded = absExcluded;
      }
      saveState();
      closeEmpModal();
      renderAll();
      showToast("Zapisano zmiany");
    } else {
      state.employees.push(makeEmployee({ lastName, firstName, ain, trainings, funcs, absExcluded }));
      saveState();
      closeEmpModal();
      renderAll();
      showToast("Dodano pracownika");
    }
  }

  function removeEmployee(id) {
    const emp = state.employees.find((e) => e.id === id);
    if (!emp) return;
    const label = getDisplayName(emp) || "tego pracownika";
    if (!confirm(`Usunąć ${label}? Cała historia jego urlopów zostanie skasowana.`)) return;
    state.employees = state.employees.filter((e) => e.id !== id);
    saveState();
    renderAll();
  }

  function reorderEmployee(dragId, targetId) {
    const fromIdx = state.employees.findIndex((e) => e.id === dragId);
    const toIdx   = state.employees.findIndex((e) => e.id === targetId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const [moved] = state.employees.splice(fromIdx, 1);
    state.employees.splice(toIdx, 0, moved);
    saveState();
    renderAll();
    showToast("Zmieniono kolejność na liście");
  }

  function initRowDragDrop() {
    const tbody = document.getElementById("kalendarzBodyFrozen");
    let dragId = null;

    tbody.addEventListener("dragstart", (e) => {
      const handle = e.target.closest(".drag-handle");
      if (!handle) return;
      const tr = handle.closest("tr[data-emp-id]");
      if (!tr) return;
      dragId = tr.dataset.empId;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
      requestAnimationFrame(() => tr.classList.add("dragging"));
    });

    tbody.addEventListener("dragend", () => {
      dragId = null;
      tbody.querySelectorAll(".dragging, .drag-over").forEach((el) => {
        el.classList.remove("dragging", "drag-over");
      });
    });

    tbody.addEventListener("dragover", (e) => {
      const tr = e.target.closest("tr[data-emp-id]");
      if (!tr || tr.dataset.empId === dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      tbody.querySelectorAll("tr.drag-over").forEach((r) => r.classList.remove("drag-over"));
      tr.classList.add("drag-over");
    });

    tbody.addEventListener("dragleave", (e) => {
      const tr = e.target.closest("tr[data-emp-id]");
      if (tr && !tr.contains(e.relatedTarget)) tr.classList.remove("drag-over");
    });

    tbody.addEventListener("drop", (e) => {
      e.preventDefault();
      const tr = e.target.closest("tr[data-emp-id]");
      if (!tr || !dragId) return;
      reorderEmployee(dragId, tr.dataset.empId);
    });
  }

  // ─── panel: obsada na dzień ──────────────────────────────────────────
  function isEmpAbsentOn(emp, key) {
    return !!emp.days[key]; // dowolny kod (U/D/UŻ/SW/OPR/OP/L) = nieobecny
  }

  // Liczy obecnych pracowników per funkcja dla danego dnia.
  // Pracownik z N funkcjami wlicza się do każdej z nich (multi-rola).
  // Sumę "Obecnych razem" liczymy jednak unikalnie (na osobę).
  // Zwraca: { totalEmps, totalPresent, byFunc: [...], unassigned: {...} }
  function computeDayStats(key) {
    const byFunc = {};
    FUNCTIONS.forEach((f) => { byFunc[f.id] = { func: f, total: 0, present: 0, absent: 0 }; });
    const unassigned = { total: 0, present: 0, absent: 0 };

    // Osoby wykluczone ze statystyk (np. kierownik) nie liczą się do obsady
    const counted = state.employees.filter((e) => !e.absExcluded);

    for (const emp of counted) {
      const absent = isEmpAbsentOn(emp, key);
      const funcs = Array.isArray(emp.funcs) ? emp.funcs : [];
      if (funcs.length === 0) {
        unassigned.total++;
        if (absent) unassigned.absent++; else unassigned.present++;
        continue;
      }
      for (const fid of funcs) {
        const bucket = byFunc[fid];
        if (!bucket) continue;
        bucket.total++;
        if (absent) bucket.absent++; else bucket.present++;
      }
    }
    const totalEmps = counted.length;
    const totalPresent = counted.filter((e) => !isEmpAbsentOn(e, key)).length;
    return {
      totalEmps,
      totalPresent,
      byFunc: FUNCTIONS.map((f) => byFunc[f.id]),
      unassigned,
    };
  }

  function formatPolishDate(d) {
    const dow = ["niedziela","poniedziałek","wtorek","środa","czwartek","piątek","sobota"][d.getDay()];
    const dowCap = dow.charAt(0).toUpperCase() + dow.slice(1);
    const monthLow = POLISH_MONTHS[d.getMonth()].toLowerCase();
    const wk = H.fiscalWeekNumber(d);
    const wkLabel = wk === 1 ? "Week 1" : "W" + wk;
    return `${dowCap}, ${d.getDate()} ${monthLow} ${d.getFullYear()} · ${wkLabel}`;
  }

  function renderDayStats() {
    const body = document.getElementById("dayStatsBody");
    if (!body) return;

    if (!selectedDayKey) {
      body.innerHTML = `<div class="day-stats-empty">Kliknij datę w nagłówku, aby zobaczyć obsadę dnia.</div>`;
      renderFuncChart(null, null);
      return;
    }

    const d = parseDateKey(selectedDayKey);
    if (!d) {
      body.innerHTML = `<div class="day-stats-empty">Nieprawidłowa data.</div>`;
      renderFuncChart(null, null);
      return;
    }

    const holMap = getHolMap(state.year);
    const isHol  = holMap.has(selectedDayKey);
    const isWknd = H.isWeekend(d);
    const stats  = computeDayStats(selectedDayKey);

    let dayBadge = "";
    if (isHol) {
      dayBadge = `<span class="day-stats-tag holiday" title="${holMap.get(selectedDayKey)}">święto</span>`;
    } else if (isWknd) {
      dayBadge = `<span class="day-stats-tag weekend">weekend</span>`;
    } else {
      dayBadge = `<span class="day-stats-tag workday">dzień roboczy</span>`;
    }

    const rows = stats.byFunc.map((b) => {
      const ratio = b.total > 0 ? (b.present / b.total) : 0;
      const isProwLayup = b.func.id === PROW_LAYUP_ID;
      const prowWarn = isProwLayup && b.total > 0 && b.present === 0 && isWorkingDayKey(selectedDayKey);
      const lowFlag = prowWarn ? "prow-alert" : ((b.total > 0 && b.present === 0) ? "zero" : (ratio < 0.5 ? "low" : ""));
      return `
        <div class="func-row ${lowFlag}">
          <div class="func-info">
            <span class="func-dot" style="background:${b.func.color}"></span>
            <span class="func-name">${b.func.label}</span>
          </div>
          <div class="func-count">
            <span class="present">${b.present}</span><span class="sep">/</span><span class="total">${b.total}</span>
          </div>
        </div>
      `;
    }).join("");

    let unassignedRow = "";
    if (stats.unassigned.total > 0) {
      unassignedRow = `
        <div class="func-row unassigned">
          <div class="func-info">
            <span class="func-dot" style="background:#64748b"></span>
            <span class="func-name">(bez funkcji)</span>
          </div>
          <div class="func-count">
            <span class="present">${stats.unassigned.present}</span><span class="sep">/</span><span class="total">${stats.unassigned.total}</span>
          </div>
        </div>
      `;
    }

    let prowAlert = "";
    const prowCov = checkProwLayupCoverage(selectedDayKey);
    if (prowCov.warn) {
      prowAlert = `
        <div class="day-stats-alert prow-layup-alert">
          <span class="alert-icon">🚨</span>
          <div class="alert-text">
            <strong>KRYTYCZNE — brak prowadzącego lay-up!</strong>
            Wszystkie ${prowCov.total} osoby z funkcją „Prowadzenie lay-up” mają absencję w tym dniu.
            <em>Co najmniej jedna musi być obecna.</em>
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <div class="day-stats-date">
        <div class="day-stats-date-main">${formatPolishDate(d)}</div>
        <div class="day-stats-date-sub">${dayBadge}</div>
      </div>
      ${prowAlert}
      <div class="day-stats-rows">
        ${rows}
        ${unassignedRow}
      </div>
      <div class="day-stats-total">
        <span>Obecnych razem</span>
        <span class="day-stats-total-val">
          <span class="present">${stats.totalPresent}</span><span class="sep">/</span><span class="total">${stats.totalEmps}</span>
        </span>
      </div>
    `;

    renderFuncChart(stats, d);
  }

  function renderFuncChart(stats, dateObj) {
    const body = document.getElementById("funcChartBody");
    if (!body) return;

    if (!selectedDayKey || !stats || !dateObj) {
      body.innerHTML = `<div class="day-stats-empty">Kliknij datę w nagłówku, aby zobaczyć wykres.</div>`;
      return;
    }

    const slices = [];
    for (const b of stats.byFunc) {
      if (b.present > 0) {
        slices.push({ label: b.func.label, short: b.func.short, color: b.func.color, count: b.present });
      }
    }
    if (stats.unassigned.present > 0) {
      slices.push({ label: "(bez funkcji)", short: "—", color: "#64748b", count: stats.unassigned.present });
    }

    const totalPresent = slices.reduce((s, x) => s + x.count, 0);
    if (totalPresent === 0) {
      body.innerHTML = `
        <div class="func-chart-date">${formatPolishDate(dateObj)}</div>
        <div class="func-chart-empty-pie" title="Brak obecnych"></div>
        <div class="day-stats-empty">Brak obecnych pracowników w tym dniu.</div>
      `;
      return;
    }

    // Procenty względem sumy przypisań funkcji (obecni)
    let cumPct = 0;
    const gradStops = slices.map((s) => {
      const pct = (s.count / totalPresent) * 100;
      const start = cumPct;
      cumPct += pct;
      s.pct = pct;
      return `${s.color} ${start.toFixed(2)}% ${cumPct.toFixed(2)}%`;
    });

    const legend = slices.map((s) => `
      <div class="chart-legend-row">
        <span class="chart-legend-dot" style="background:${s.color}"></span>
        <span class="chart-legend-name">${s.label}</span>
        <span class="chart-legend-val">
          <strong>${s.count}</strong>
          <span class="chart-legend-pct">${s.pct.toFixed(1).replace(".", ",")}%</span>
        </span>
      </div>
    `).join("");

    body.innerHTML = `
      <div class="func-chart-date">${formatPolishDate(dateObj)}</div>
      <div class="func-chart-wrap">
        <div class="func-chart-pie" style="background:conic-gradient(from -90deg, ${gradStops.join(", ")})" title="Obecni wg funkcji">
          <div class="func-chart-hole">
            <span class="func-chart-hole-num">${totalPresent}</span>
            <span class="func-chart-hole-lbl">obecnych</span>
          </div>
        </div>
        <div class="func-chart-legend">${legend}</div>
      </div>
    `;
  }

  function selectDay(key, additive) {
    if (additive && key) {
      // Ctrl/Cmd+klik: dodaj lub usuń dzień z zaznaczenia
      if (selectedDayKeys.has(key)) {
        selectedDayKeys.delete(key);
        if (selectedDayKey === key) {
          const rest = [...selectedDayKeys].sort();
          selectedDayKey = rest.length ? rest[rest.length - 1] : null;
        }
      } else {
        selectedDayKeys.add(key);
        selectedDayKey = key;
      }
    } else {
      selectedDayKey = key;
      selectedDayKeys = new Set(key ? [key] : []);
    }
    applySelectionHighlights();
    renderDayStats();
    renderVacSelection();
    // Synchronizuj panel godzin tygodnia z klikniętym dniem
    if (key) {
      const wi = weekIndexForKey(key);
      if (wi !== null && wi !== weekHoursIdx) {
        weekHoursIdx = wi;
        renderWeekHours();
      }
    }
  }

  function applySelectionHighlights() {
    const all = document.querySelectorAll(".kalendarz-scroll thead .day-header.selected, .kalendarz-scroll tbody .day-cell.col-selected");
    all.forEach((el) => {
      el.classList.remove("selected");
      el.classList.remove("col-selected");
    });
    for (const key of selectedDayKeys) {
      const head = document.querySelector(`.kalendarz-scroll thead .day-header[data-date-key="${key}"]`);
      if (head) head.classList.add("selected");
      const bodyCells = document.querySelectorAll(`.kalendarz-scroll tbody .day-cell[data-date-key="${key}"]`);
      bodyCells.forEach((c) => c.classList.add("col-selected"));
    }
  }

  // ─── przesuwanie pływających paneli (drag & drop za nagłówek) ────────
  function clampPanelPos(panel, left, top) {
    const w = panel.offsetWidth || 300;
    const minLeft = 8 - Math.max(0, w - 90); // można wysunąć, ale uchwyt zostaje
    const maxLeft = window.innerWidth - 90;
    return {
      left: Math.min(Math.max(left, minLeft), maxLeft),
      top: Math.min(Math.max(top, 0), window.innerHeight - 44),
    };
  }

  function setPanelPos(panel, left, top) {
    const p = clampPanelPos(panel, left, top);
    panel.style.position = "fixed";
    panel.style.left = p.left + "px";
    panel.style.top = p.top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.zIndex = "95";
  }

  function resetPanelPos(panel, storageKey) {
    panel.style.position = "";
    panel.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.zIndex = "";
    panel.style.width = "";
    panel.style.height = "";
    delete panel.dataset.savedH;
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey.replace("kalPanelPos:", "kalPanelSize:"));
    } catch (e) { /* ignore */ }
  }

  // Regulacja wielkości okienka (uchwyt w prawym dolnym rogu) + zapamiętanie
  function makePanelResizable(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.add("panel-resizable");
    const storageKey = "kalPanelSize:" + panelId;

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved.w === "number" && typeof saved.h === "number") {
        panel.style.width = saved.w + "px";
        if (!panel.classList.contains("collapsed")) panel.style.height = saved.h + "px";
      }
    } catch (e) { /* ignore */ }

    // Zapisuj rozmiar po zmianie (tylko gdy panel rozwinięty)
    let t = null;
    const ro = new ResizeObserver(() => {
      if (panel.classList.contains("collapsed")) return;
      clearTimeout(t);
      t = setTimeout(() => {
        const r = panel.getBoundingClientRect();
        if (r.width < 50 || r.height < 30) return;
        try { localStorage.setItem(storageKey, JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) })); } catch (e) { /* ignore */ }
      }, 300);
    });
    ro.observe(panel);

    // Przy zwinięciu zdejmij wymuszoną wysokość, przy rozwinięciu przywróć
    const mo = new MutationObserver(() => {
      if (panel.classList.contains("collapsed")) {
        if (panel.style.height) panel.dataset.savedH = panel.style.height;
        panel.style.height = "";
      } else if (panel.dataset.savedH) {
        panel.style.height = panel.dataset.savedH;
        delete panel.dataset.savedH;
      }
    });
    mo.observe(panel, { attributes: true, attributeFilter: ["class"] });
  }

  function makePanelDraggable(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const header = panel.querySelector(".day-stats-header");
    if (!header) return;
    const storageKey = "kalPanelPos:" + panelId;
    header.title = "Przeciągnij, aby przesunąć okienko. Podwójny klik — wróć na domyślne miejsce.";

    // Przywróć zapamiętaną pozycję
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
        setPanelPos(panel, saved.left, saved.top);
      }
    } catch (e) { /* ignore */ }

    header.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      resetPanelPos(panel, storageKey);
    });

    header.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      let moved = false;
      panel.classList.add("panel-dragging");
      const move = (ev) => {
        moved = true;
        setPanelPos(panel, ev.clientX - offX, ev.clientY - offY);
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        panel.classList.remove("panel-dragging");
        if (moved) {
          const r = panel.getBoundingClientRect();
          try { localStorage.setItem(storageKey, JSON.stringify({ left: r.left, top: r.top })); } catch (e2) { /* ignore */ }
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
  }

  // ─── panel: godziny absencji w wybranym tygodniu ─────────────────────
  let weekHoursIdx = null; // indeks w getYearWeeksList(state.year)

  function weekIndexForKey(key) {
    const list = getYearWeeksList(state.year);
    for (let i = 0; i < list.length; i++) {
      if (list[i].dates.some((d) => H.dateKey(d) === key)) return i;
    }
    return null;
  }

  function renderWeekHours() {
    const body = document.getElementById("weekHoursBody");
    if (!body) return;
    const list = getYearWeeksList(state.year);
    if (weekHoursIdx === null || weekHoursIdx < 0 || weekHoursIdx >= list.length) {
      const idx = weekIndexForKey(selectedDayKey || H.dateKey(new Date()));
      weekHoursIdx = idx === null ? 0 : idx;
    }

    const options = list.map((g, i) => {
      const label = `${H.fiscalWeekLabel(g.wk, g.wk === 1)} (${fmtShortDate(g.dates[0])}–${fmtShortDate(g.dates[g.dates.length - 1])})`;
      return `<option value="${i}"${i === weekHoursIdx ? " selected" : ""}>${label}</option>`;
    }).join("");

    // Podział dzień po dniu: tylko dni i kody, w których faktycznie są absencje
    const g = list[weekHoursIdx];
    const people = new Set();
    let totalHours = 0;
    let daysHtml = "";
    for (const d of g.dates) {
      const key = H.dateKey(d);
      const byCode = new Map(); // kod -> { count, hours }
      for (const emp of state.employees) {
        const val = emp.days ? emp.days[key] : null;
        const code = getCode(val);
        if (!code) continue;
        const hrs = getHours(val);
        const cur = byCode.get(code) || { count: 0, hours: 0 };
        cur.count++;
        cur.hours += hrs;
        byCode.set(code, cur);
        people.add(emp.id);
        totalHours += hrs;
      }
      if (!byCode.size) continue; // dzień bez absencji — pomijamy dla czytelności

      let rows = "";
      for (const c of CODES) {
        const entry = byCode.get(c.code);
        if (!entry) continue;
        rows += `
          <div class="vac-sel-row wh-row">
            <span class="vac-sel-code" title="${c.label}"><span class="wh-chip" data-code="${c.code}">${c.code}</span> ${c.label}</span>
            <span class="vac-sel-nums">${entry.count} os. · <b>${formatUsage(entry.hours)} h</b></span>
          </div>`;
      }
      daysHtml += `
        <div class="wh-day-group">
          <div class="wh-day">${POLISH_DOW[d.getDay()]} ${fmtShortDate(d)}</div>
          ${rows}
        </div>`;
    }
    if (!daysHtml) daysHtml = `<div class="day-stats-empty">Brak absencji w tym tygodniu.</div>`;

    const totalRow = totalHours > 0 ? `
      <div class="vac-sel-row vac-sel-total">
        <span class="vac-sel-code">Razem (${people.size} os.)</span>
        <span class="vac-sel-nums">${formatUsage(totalHours / 8)} dn. · <b>${formatUsage(totalHours)} h</b></span>
      </div>` : "";

    body.innerHTML = `
      <div class="week-hours-picker">
        <label>Tydzień: <select id="weekHoursSel">${options}</select></label>
      </div>
      ${daysHtml}
      ${totalRow}
    `;
    document.getElementById("weekHoursSel").addEventListener("change", (e) => {
      weekHoursIdx = parseInt(e.target.value, 10) || 0;
      renderWeekHours();
    });
  }

  // ─── stały alert: brak prowadzącego lay-up w dniach roboczych ─────────
  function renderProwAlert() {
    const bar = document.getElementById("prowAlertBar");
    if (!bar) return;
    const days = [];
    for (const d of H.buildYearDates(state.year)) {
      const key = H.dateKey(d);
      if (checkProwLayupCoverage(key).warn) days.push({ key, d });
    }
    if (!days.length) {
      bar.hidden = true;
      bar.innerHTML = "";
      return;
    }
    const MAX = 12;
    const chips = days.slice(0, MAX).map(({ key, d }) =>
      `<button type="button" class="prow-alert-chip" data-key="${key}" title="Kliknij — pokaż ten dzień">${fmtShortDate(d)}</button>`
    ).join("");
    const more = days.length > MAX ? `<span class="prow-alert-more">+${days.length - MAX} więcej</span>` : "";
    const dniWord = days.length === 1 ? "dzień roboczy" : "dni roboczych";
    bar.innerHTML = `<span class="warn-ico">⚠</span><b>BRAK PROWADZĄCEGO LAY-UP — ${days.length} ${dniWord}:</b>${chips}${more}`;
    bar.hidden = false;
    bar.querySelectorAll(".prow-alert-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        selectDay(key);
        const th = document.querySelector(`.kalendarz-scroll thead .day-header[data-date-key="${key}"]`);
        if (th) th.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      });
    });
  }

  // ─── import absencji z raportu Kronos (.xlsx) ─────────────────────────
  let kronosData = null;        // { people: [...], payCodes: [...] }
  let kronosMap = {};           // kod płacy -> kod kalendarza ("" = pomiń)
  const kronosImported = new Set();

  // Normalizacja nazwisk do porównań (bez ogonków, małe litery)
  function normNamePart(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[łŁ]/g, "l")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
  }

  // Zgadnij kod kalendarza na podstawie kodu płacy Kronos
  function guessCalendarCode(payCode) {
    const p = String(payCode || "").toLowerCase();
    if (p.includes("przepracowane") || p.includes("nadgodzin") || p.includes("holiday indicator")) return "";
    if (p.includes("zaleg")) return "ZAL";
    if (p.includes("bież") || p.includes("biez")) return "U";
    if (p.includes("żąda") || p.includes("zada")) return "UŻ";
    if (p.includes("siła wyż") || p.includes("sila wyz")) return "SW";
    if (p.includes("macierzy")) return "M";
    if (p.includes("choroba") || p.includes("chorob")) return "L";
    if (p.includes("opiek")) return "OPR";
    if (p.includes("bezpłat") || p.includes("bezplat")) return "NUN";
    if (p.includes("krwiod") || p.includes("krew")) return "KREW";
    if (p.includes("urlop")) return "U";
    return "";
  }

  // Parsuje datę w formacie MM/DD/YYYY na klucz YYYY-MM-DD
  function parseKronosDate(raw) {
    const m = String(raw || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }

  function parseKronosWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return null;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

    // Znajdź nagłówek sekcji "Transakcje" (wiersz z ID/Pracown/Data)
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      if (String(r[0]).trim() === "ID" && String(r[1] || "").startsWith("Pracown") && String(r[2] || "").startsWith("Data")) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) return null;

    const peopleMap = new Map(); // id -> { id, rawName, last, first, txns: [] }
    const payCodesSet = new Set();

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const first = String(r[0] || "").trim();
      if (!first) continue;
      if (first === "Sumy" || first === "Kwoty podsumowania") break;
      // wiersz transakcji: [ID, "Nazwisko, Imię", MM/DD/RRRR, dzień, kod płacy, kwota, godziny, ...]
      const id = first.replace(/\D/g, "");
      const rawName = String(r[1] || "").trim();
      const key = parseKronosDate(r[2]);
      const payCode = String(r[4] || "").trim();
      const hours = parseFloat(String(r[6] || "").replace(",", "."));
      if (!id || !rawName || !key || !payCode || !isFinite(hours) || hours <= 0) continue;

      payCodesSet.add(payCode);
      if (!peopleMap.has(id)) {
        const parts = rawName.split(",");
        peopleMap.set(id, {
          id,
          rawName,
          last: (parts[0] || "").trim(),
          first: (parts[1] || "").trim().split(/\s+/)[0] || "",
          txns: [],
        });
      }
      peopleMap.get(id).txns.push({ key, payCode, hours });
    }

    const people = [...peopleMap.values()].sort((a, b) => a.rawName.localeCompare(b.rawName, "pl"));
    return { people, payCodes: [...payCodesSet].sort() };
  }

  // Dopasuj osobę z raportu do pracownika kalendarza: najpierw AIN, potem nazwisko
  function matchKronosPerson(p) {
    const byAin = state.employees.find((e) => normalizeAin(e.ain) && normalizeAin(e.ain) === p.id);
    if (byAin) return byAin;
    const ln = normNamePart(p.last);
    const fn = normNamePart(p.first);
    return state.employees.find(
      (e) => normNamePart(e.lastName) === ln && normNamePart(e.firstName) === fn
    ) || null;
  }

  function openKronosModal() {
    kronosData = null;
    kronosMap = {};
    kronosImported.clear();
    document.getElementById("kronosFile").value = "";
    document.getElementById("kronosInfo").textContent = "Wybierz plik raportu, aby zobaczyć pracowników i ich absencje.";
    document.getElementById("kronosMapWrap").innerHTML = "";
    document.getElementById("kronosEmpList").innerHTML = "";
    document.getElementById("kronosModal").hidden = false;
  }

  function closeKronosModal() {
    document.getElementById("kronosModal").hidden = true;
  }

  async function handleKronosFile(file) {
    if (!file) return;
    const info = document.getElementById("kronosInfo");
    try {
      if (typeof XLSX === "undefined") throw new Error("Brak biblioteki XLSX");
      const buf = await file.arrayBuffer();
      const parsed = parseKronosWorkbook(buf);
      if (!parsed || !parsed.people.length) {
        info.textContent = "⚠ Nie znaleziono sekcji „Transakcje” w tym pliku. Upewnij się, że to raport „Transakcje i sumy pracownika”.";
        document.getElementById("kronosMapWrap").innerHTML = "";
        document.getElementById("kronosEmpList").innerHTML = "";
        return;
      }
      kronosData = parsed;
      kronosMap = {};
      for (const pc of parsed.payCodes) kronosMap[pc] = guessCalendarCode(pc);
      kronosImported.clear();
      const txnCount = parsed.people.reduce((s, p) => s + p.txns.length, 0);
      info.textContent = `Znaleziono ${parsed.people.length} pracowników i ${txnCount} wpisów. Sprawdź mapowanie kodów, potem importuj wybrane osoby.`;
      renderKronosMap();
      renderKronosEmpList();
    } catch (e) {
      console.warn("Błąd odczytu raportu Kronos:", e);
      info.textContent = "⚠ Nie udało się odczytać pliku: " + e.message;
    }
  }

  function renderKronosMap() {
    const wrap = document.getElementById("kronosMapWrap");
    if (!kronosData) { wrap.innerHTML = ""; return; }
    const opts = (sel) => `<option value=""${sel === "" ? " selected" : ""}>— pomiń —</option>` +
      CODES.map((c) => `<option value="${c.code}"${sel === c.code ? " selected" : ""}>${c.code} — ${c.label}</option>`).join("");
    const rows = kronosData.payCodes.map((pc, i) => `
      <div class="kr-map-row">
        <span class="kr-map-name" title="${escapeHtml(pc)}">${escapeHtml(pc)}</span>
        <select class="kr-map-sel" data-pc-idx="${i}">${opts(kronosMap[pc] ?? "")}</select>
      </div>`).join("");
    wrap.innerHTML = `<div class="kr-section-title">Mapowanie kodów płacy → kody kalendarza</div>${rows}`;
    wrap.querySelectorAll(".kr-map-sel").forEach((sel) => {
      sel.addEventListener("change", () => {
        const pc = kronosData.payCodes[parseInt(sel.dataset.pcIdx, 10)];
        kronosMap[pc] = sel.value;
        renderKronosEmpList();
      });
    });
  }

  // Zbierz wpisy osoby wg zmapowanych kodów: klucz daty -> { code, hours }
  function collectKronosEntries(p) {
    const perDate = new Map();
    for (const t of p.txns) {
      const code = kronosMap[t.payCode];
      if (!code) continue;
      const list = perDate.get(t.key) || [];
      list.push({ code, hours: t.hours });
      perDate.set(t.key, list);
    }
    const out = new Map();
    for (const [key, list] of perDate) {
      const byCode = new Map();
      for (const e of list) byCode.set(e.code, (byCode.get(e.code) || 0) + e.hours);
      // przy kilku kodach tego samego dnia wybierz ten z większą liczbą godzin
      let best = null;
      for (const [code, hours] of byCode) {
        if (!best || hours > best.hours) best = { code, hours };
      }
      if (best && best.hours > 0) {
        out.set(key, { code: best.code, hours: Math.min(8, Math.round(best.hours * 100) / 100) });
      }
    }
    return out;
  }

  function kronosEntriesSummary(entries) {
    const cnt = new Map();
    for (const { code } of entries.values()) cnt.set(code, (cnt.get(code) || 0) + 1);
    return CODES.filter((c) => cnt.has(c.code))
      .map((c) => `<span class="wh-chip" data-code="${c.code}" title="${c.label}">${c.code}</span> ${cnt.get(c.code)} dn.`)
      .join(" · ");
  }

  function renderKronosEmpList() {
    const wrap = document.getElementById("kronosEmpList");
    if (!kronosData) { wrap.innerHTML = ""; return; }

    const empOptions = (selId) => `<option value="">— nie importuj / brak w kalendarzu —</option>` +
      state.employees.map((e) => `<option value="${e.id}"${e.id === selId ? " selected" : ""}>${escapeHtml(getDisplayName(e))}</option>`).join("");

    const rows = kronosData.people.map((p, i) => {
      const entries = collectKronosEntries(p);
      const matched = matchKronosPerson(p);
      const done = kronosImported.has(p.id);
      const summary = entries.size
        ? kronosEntriesSummary(entries)
        : `<span class="kr-none">brak absencji po zmapowaniu</span>`;
      const matchBadge = matched
        ? (normalizeAin(matched.ain) === p.id
            ? `<span class="kr-badge kr-badge-ain" title="Dopasowano po numerze AIN">AIN ✓</span>`
            : `<span class="kr-badge kr-badge-name" title="Dopasowano po nazwisku">nazwisko ✓</span>`)
        : `<span class="kr-badge kr-badge-no" title="Nie znaleziono w kalendarzu — wybierz ręcznie">brak dopasowania</span>`;
      return `
        <div class="kr-emp-row${done ? " kr-done" : ""}" data-pid="${p.id}">
          <div class="kr-emp-main">
            <div class="kr-emp-name">${escapeHtml(p.rawName)} <span class="kr-emp-id">(${p.id})</span> ${matchBadge}</div>
            <div class="kr-emp-summary">${summary}</div>
          </div>
          <div class="kr-emp-actions">
            <select class="kr-emp-sel" data-p-idx="${i}">${empOptions(matched ? matched.id : "")}</select>
            <button type="button" class="btn btn-primary btn-sm kr-import-btn" data-p-idx="${i}"${entries.size && !done ? "" : " disabled"}>${done ? "✓ Zaimportowano" : "Importuj"}</button>
          </div>
        </div>`;
    }).join("");

    wrap.innerHTML = `<div class="kr-section-title">Pracownicy z raportu — importuj pojedynczo</div><div class="kr-emp-list">${rows}</div>`;

    wrap.querySelectorAll(".kr-import-btn").forEach((btn) => {
      btn.addEventListener("click", () => importKronosPerson(parseInt(btn.dataset.pIdx, 10)));
    });
  }

  function importKronosPerson(idx) {
    const p = kronosData?.people?.[idx];
    if (!p) return;
    const row = document.querySelector(`.kr-emp-row[data-pid="${p.id}"]`);
    const sel = row ? row.querySelector(".kr-emp-sel") : null;
    const empId = sel ? sel.value : "";
    if (!empId) { showToast("Wybierz pracownika z kalendarza, do którego zaciągnąć absencje"); return; }
    const emp = state.employees.find((e) => e.id === empId);
    if (!emp) return;

    const entries = collectKronosEntries(p);
    if (!entries.size) { showToast("Brak absencji do importu (sprawdź mapowanie kodów)"); return; }

    const holMaps = {};
    const holFor = (year) => (holMaps[year] = holMaps[year] || H.holidayMap(year));

    let added = 0, changed = 0, same = 0, skippedFree = 0, outsideYear = 0;
    for (const [key, e] of entries) {
      const d = parseDateKey(key);
      if (!d) continue;
      if (H.isWeekend(d) || holFor(d.getFullYear()).has(key)) { skippedFree++; continue; }
      const newVal = makeValue(e.code, e.hours >= 8 ? 8 : e.hours);
      const oldVal = emp.days[key];
      if (oldVal && valuesEqual(oldVal, newVal)) { same++; continue; }
      if (oldVal) changed++; else added++;
      emp.days[key] = newVal;
      if (!key.startsWith(state.year + "-")) outsideYear++;
    }

    // Uzupełnij AIN z raportu, jeśli pracownik go nie miał
    if (!normalizeAin(emp.ain) && p.id.length === 9) emp.ain = p.id;

    kronosImported.add(p.id);
    saveState();
    renderAll();
    renderKronosEmpList();

    let msg = `${getDisplayName(emp)}: dodano ${added}`;
    if (changed) msg += `, nadpisano ${changed}`;
    if (same) msg += `, bez zmian ${same}`;
    if (skippedFree) msg += `, pominięto ${skippedFree} (weekend/święto)`;
    if (outsideYear) msg += `, ${outsideYear} poza rokiem ${state.year}`;
    showToast(msg);
  }

  // ─── formularz: ręczne wpisywanie absencji ────────────────────────────
  function absFormRowHtml() {
    const codeOpts = CODES.map((c) =>
      `<option value="${c.code}"${c.code === state.activeCode ? " selected" : ""}>${c.code} — ${c.label}</option>`
    ).join("");
    const min = `${state.year}-01-01`;
    const max = `${state.year}-12-31`;
    return `<div class="af-row">
      <select class="af-code" title="Rodzaj absencji">${codeOpts}</select>
      <input type="date" class="af-from" min="${min}" max="${max}" title="Od (włącznie)">
      <span class="af-sep">→</span>
      <input type="date" class="af-to" min="${min}" max="${max}" title="Do (włącznie)">
      <button type="button" class="af-remove" title="Usuń ten wiersz">×</button>
    </div>`;
  }

  function addAbsFormRow() {
    const wrap = document.getElementById("absFormRows");
    wrap.insertAdjacentHTML("beforeend", absFormRowHtml());
    const row = wrap.lastElementChild;
    row.querySelector(".af-remove").addEventListener("click", () => {
      row.remove();
      if (!wrap.children.length) addAbsFormRow();
    });
    // Wygoda: po wybraniu "od" podpowiedz tę samą datę w "do"
    const fromEl = row.querySelector(".af-from");
    const toEl = row.querySelector(".af-to");
    fromEl.addEventListener("change", () => {
      if (fromEl.value && (!toEl.value || toEl.value < fromEl.value)) toEl.value = fromEl.value;
    });
  }

  function openAbsFormModal() {
    if (!state.employees.length) { showToast("Najpierw dodaj pracowników"); return; }
    const sel = document.getElementById("absFormEmp");
    sel.innerHTML = state.employees
      .map((e) => `<option value="${e.id}">${escapeHtml(getDisplayName(e))}</option>`)
      .join("");
    const wrap = document.getElementById("absFormRows");
    wrap.innerHTML = "";
    addAbsFormRow();
    document.getElementById("absFormModal").hidden = false;
  }

  function closeAbsFormModal() {
    document.getElementById("absFormModal").hidden = true;
  }

  function submitAbsForm() {
    const empId = document.getElementById("absFormEmp").value;
    const emp = state.employees.find((e) => e.id === empId);
    if (!emp) { showToast("Wybierz pracownika"); return; }

    const rows = [...document.querySelectorAll("#absFormRows .af-row")];
    let added = 0, changed = 0, same = 0, skippedFree = 0, blockedPool = 0, invalid = 0;
    const holMaps = {};
    const holFor = (year) => (holMaps[year] = holMaps[year] || H.holidayMap(year));

    for (const row of rows) {
      const code = row.querySelector(".af-code").value;
      let from = row.querySelector(".af-from").value;
      let to = row.querySelector(".af-to").value;
      if (!from && !to) continue; // pusty wiersz — ignoruj
      if (!from || !to) { invalid++; row.classList.add("af-row-error"); continue; }
      row.classList.remove("af-row-error");
      if (from > to) { const t = from; from = to; to = t; }

      const start = parseDateKey(from);
      const end = parseDateKey(to);
      if (!start || !end) { invalid++; continue; }

      for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const key = H.dateKey(cur);
        if (H.isWeekend(cur) || holFor(cur.getFullYear()).has(key)) {
          skippedFree++;
          continue;
        }
        const oldVal = emp.days[key];
        const newVal = makeValue(code, 8);
        if (oldVal && valuesEqual(oldVal, newVal)) { same++; continue; }
        if (!wouldFitInPool(emp, code, oldVal, 8)) { blockedPool++; continue; }
        if (oldVal) changed++; else added++;
        emp.days[key] = newVal;
      }
    }

    if (invalid) {
      showToast(`Uzupełnij daty „od" i „do" w ${invalid} wierszu/ach`);
      return;
    }
    if (!added && !changed) {
      let msg = "Nic nie dodano";
      if (blockedPool) msg += ` — ${blockedPool} dni przekracza pulę`;
      else if (same) msg += " — wpisy już istnieją";
      else if (skippedFree) msg += " — same weekendy/święta";
      else msg += " — wpisz zakres dat";
      showToast(msg);
      return;
    }

    saveState();
    renderAll();
    closeAbsFormModal();

    let msg = `${getDisplayName(emp)}: dodano ${added}`;
    if (changed) msg += `, nadpisano ${changed}`;
    if (same) msg += `, bez zmian ${same}`;
    if (skippedFree) msg += `, pominięto ${skippedFree} (weekend/święto)`;
    if (blockedPool) msg += `, ${blockedPool} nie zmieściło się w puli`;
    showToast(msg);
  }

  // ─── panel: suma urlopów w zaznaczone dni ─────────────────────────────
  function renderVacSelection() {
    const body = document.getElementById("vacSelBody");
    if (!body) return;

    const keys = [...selectedDayKeys].sort();
    if (!keys.length) {
      body.innerHTML = `<div class="day-stats-empty">Kliknij datę w nagłówku (Ctrl+klik = kilka dni), aby zobaczyć sumę urlopów.</div>`;
      return;
    }

    // Suma godzin per kod absencji + liczba osób
    const byCode = new Map();
    const people = new Set();
    let totalHours = 0;
    for (const key of keys) {
      for (const emp of state.employees) {
        const val = emp.days ? emp.days[key] : null;
        const code = getCode(val);
        if (!code) continue;
        const hrs = getHours(val);
        byCode.set(code, (byCode.get(code) || 0) + hrs);
        people.add(emp.id);
        totalHours += hrs;
      }
    }

    const dayLabels = keys.map((k) => {
      const d = parseDateKey(k);
      return d ? `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}` : k;
    }).join(", ");

    let rows = "";
    for (const c of CODES) {
      const hrs = byCode.get(c.code);
      if (!hrs) continue;
      rows += `
        <div class="vac-sel-row">
          <span class="vac-sel-code" title="${c.label}"><span class="wh-chip" data-code="${c.code}">${c.code}</span> ${c.label}</span>
          <span class="vac-sel-nums">${formatUsage(hrs / 8)} dn. · <b>${formatUsage(hrs)} h</b></span>
        </div>`;
    }
    if (!rows) {
      rows = `<div class="day-stats-empty">Brak absencji w zaznaczone dni.</div>`;
    }

    const totalRow = totalHours > 0 ? `
      <div class="vac-sel-row vac-sel-total">
        <span class="vac-sel-code">Razem (${people.size} os.)</span>
        <span class="vac-sel-nums">${formatUsage(totalHours / 8)} dn. · <b>${formatUsage(totalHours)} h</b></span>
      </div>` : "";

    body.innerHTML = `
      <div class="vac-sel-days">
        <span>Dni: <b>${dayLabels}</b></span>
        <button type="button" class="vac-sel-clear" id="vacSelClearBtn" title="Wyczyść zaznaczenie">wyczyść</button>
      </div>
      ${rows}
      ${totalRow}
      <div class="vac-sel-hint">Ctrl + klik na datę — zaznacz kilka dni. 1 dzień = 8 h.</div>
    `;

    const clearBtn = document.getElementById("vacSelClearBtn");
    if (clearBtn) clearBtn.addEventListener("click", () => selectDay(null));
  }

  // ─── summary ──────────────────────────────────────────────────────────
  function updateSummary() {
    const year = state.year;
    let totalVacDays = 0;
    let totalL4Days = 0;
    for (const emp of state.employees) {
      for (const c of CODES) {
        const { days } = getUsage(emp, c.code, year);
        if (c.code === "L") totalL4Days += days;
        else if (c.defaultPool !== null) totalVacDays += days;
      }
    }

    document.getElementById("statEmployees").textContent = state.employees.length;
    document.getElementById("statTotalVacation").textContent = formatUsage(totalVacDays);
    document.getElementById("statL4").textContent = formatUsage(totalL4Days);
    document.getElementById("statHolidays").textContent = H.getPolishHolidays(year).length;

    updateAbsenceStats();
    renderWeekHours();
    renderProwAlert();
  }

  // ─── procent absencji ─────────────────────────────────────────────────
  let _workDaysCache = { year: null, count: 0 };

  function countWorkingDaysInYear(year) {
    if (_workDaysCache.year === year) return _workDaysCache.count;
    let n = 0;
    for (const d of H.buildYearDates(year)) {
      if (isWorkingDayKey(H.dateKey(d))) n++;
    }
    _workDaysCache = { year, count: n };
    return n;
  }

  // Liczymy tylko dni z kodem oznaczonym absence:true (bez urlopów planowanych)
  function countEmpAbsentDays(emp, year) {
    const prefix = year + "-";
    let n = 0;
    for (const key of Object.keys(emp.days || {})) {
      if (!key.startsWith(prefix)) continue;
      const code = getCode(emp.days[key]);
      if (code && ABSENCE_CODES.has(code) && isWorkingDayKey(key)) n++;
    }
    return n;
  }

  function formatPct(v) {
    return (Math.round(v * 10) / 10).toLocaleString("pl-PL") + "%";
  }

  // Płynny kolor wskaźnika: 0% zielony → 5% żółty → 10%+ czerwony
  function absencePctColor(pct) {
    const t = Math.max(0, Math.min(1, pct / 10));
    const hue = Math.round(120 - 120 * t);
    return {
      bg: `hsl(${hue}, 85%, 86%)`,
      fg: `hsl(${hue}, 95%, 22%)`,
    };
  }

  const ABSENCE_CODES_LABEL = CODES.filter((c) => c.absence).map((c) => c.code).join(", ");

  function updateAbsenceStats() {
    const year = state.year;
    const workDays = countWorkingDaysInYear(year);
    let totalAbsent = 0;
    let countedEmps = 0;

    for (const emp of state.employees) {
      const absent = countEmpAbsentDays(emp, year);
      const excluded = Boolean(emp.absExcluded);
      if (!excluded) {
        totalAbsent += absent;
        countedEmps++;
      }
      const td = document.querySelector(
        `#kalendarzBodyFrozen tr[data-emp-id="${emp.id}"] td.cell-abs`
      );
      if (!td) continue;
      const pct = workDays > 0 ? (absent / workDays) * 100 : 0;
      if (excluded) {
        // Pracownik wyłączony ze statystyk działu — pokazujemy jego % na szaro
        td.textContent = formatPct(pct) + " ✕";
        td.title = `${getDisplayName(emp)}: ${absent} dni absencji z ${workDays} dni roboczych w ${year}. NIE wliczany do statystyk absencji działu (opcja w edycji pracownika).`;
        td.style.backgroundColor = "";
        td.style.color = "";
        td.classList.add("abs-excluded");
      } else {
        const col = absencePctColor(pct);
        td.textContent = formatPct(pct);
        td.title = `${getDisplayName(emp)}: ${absent} dni absencji (${ABSENCE_CODES_LABEL}) z ${workDays} dni roboczych w ${year}. Urlopy U i D nie są wliczane.`;
        td.style.backgroundColor = col.bg;
        td.style.color = col.fg;
        td.classList.remove("abs-excluded");
      }
    }

    const teamEl = document.getElementById("absTeamPct");
    if (teamEl) {
      const teamPct = workDays > 0 && countedEmps > 0
        ? (totalAbsent / (workDays * countedEmps)) * 100
        : 0;
      const col = absencePctColor(teamPct);
      teamEl.textContent = formatPct(teamPct);
      teamEl.style.backgroundColor = col.bg;
      teamEl.style.color = col.fg;
      const excludedNote = countedEmps < state.employees.length
        ? ` Pominięto ${state.employees.length - countedEmps} os. wyłączonych ze statystyk (✕).`
        : "";
      teamEl.title = `Średnia absencja działu: ${totalAbsent} dni absencji / (${workDays} dni roboczych × ${countedEmps} pracowników). Wliczane kody: ${ABSENCE_CODES_LABEL} — bez urlopów planowanych (U, D).${excludedNote}`;
    }
  }

  function computeTrainingStats() {
    const byDept = {};
    for (const dept of DEPARTMENTS) {
      byDept[dept.id] = {};
      for (const tId of dept.trainings) byDept[dept.id][tId] = 0;
    }
    for (const emp of state.employees) {
      for (const tr of normalizeTrainingList(emp.trainings, "")) {
        if (byDept[tr.dept] && byDept[tr.dept][tr.area] !== undefined) {
          byDept[tr.dept][tr.area]++;
        }
      }
    }
    return byDept;
  }

  function renderTrainingStats() {
    const body = document.getElementById("trainingStatsBody");
    if (!body) return;

    const stats = computeTrainingStats();
    const areaIds = [];
    for (const dept of DEPARTMENTS) {
      for (const tId of dept.trainings) {
        if (!areaIds.includes(tId)) areaIds.push(tId);
      }
    }
    const areas = areaIds.map(getTrainingArea).filter(Boolean);

    if (!state.employees.length) {
      body.innerHTML = '<div class="day-stats-empty">Brak pracowników — dodaj pierwszego, aby zobaczyć statystyki szkoleń.</div>';
      return;
    }

    const table = document.createElement("table");
    table.className = "training-stats-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.textContent = "Dział";
    headRow.appendChild(corner);
    for (const area of areas) {
      const th = document.createElement("th");
      th.textContent = area.short;
      th.title = area.label;
      th.style.color = area.color;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Bez kolumny Σ i wiersza "Razem" — każda komórka to liczba osób
    // przeszkolonych w danym dziale na dany obszar, bez ogólnych sum.
    const tbody = document.createElement("tbody");

    for (const dept of DEPARTMENTS) {
      const row = document.createElement("tr");
      const tdDept = document.createElement("td");
      tdDept.className = "cell-dept";
      const dot = document.createElement("span");
      dot.className = "dept-dot";
      dot.style.background = dept.color;
      tdDept.appendChild(dot);
      tdDept.appendChild(document.createTextNode(dept.label));
      row.appendChild(tdDept);

      for (const area of areas) {
        const td = document.createElement("td");
        const allowed = dept.trainings.includes(area.id);
        if (!allowed) {
          td.className = "na";
          td.textContent = "—";
        } else {
          const n = stats[dept.id][area.id] || 0;
          td.textContent = String(n);
          td.title = `${dept.label} / ${getTrainingArea(area.id)?.label || area.id}: ${n} os.`;
          if (n > 0) td.classList.add("count-positive");
        }
        row.appendChild(td);
      }

      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    body.innerHTML = "";
    body.appendChild(table);
  }

  // ─── wydruk rocznego kalendarza pracownika ────────────────────────────
  // Na wydruku pokazujemy urlopy planowane: wypoczynkowy, dodatkowy, na żądanie
  const PRINT_CODES = ["ZAL", "U", "D", "UŻ"];
  const PRINT_COLORS = {
    "ZAL": { bg: "#0d9488", fg: "#ecfdfa" },
    "U":  { bg: "#10b981", fg: "#042f1f" },
    "D":  { bg: "#84cc16", fg: "#1a2400" },
    "UŻ": { bg: "#f59e0b", fg: "#2a1c00" },
  };

  function openPrintModal() {
    if (!state.employees.length) {
      showToast("Brak pracowników do wydruku");
      return;
    }
    const sel = document.getElementById("printEmpSelect");
    sel.innerHTML = "";
    for (const emp of state.employees) {
      const opt = document.createElement("option");
      opt.value = emp.id;
      opt.textContent = getDisplayName(emp);
      sel.appendChild(opt);
    }
    document.getElementById("printYearInfo").textContent = state.year;
    document.getElementById("printModal").hidden = false;
  }

  function closePrintModal() {
    document.getElementById("printModal").hidden = true;
  }

  function printEmployeeCalendar() {
    const sel = document.getElementById("printEmpSelect");
    const emp = state.employees.find((e) => e.id === sel.value);
    if (!emp) return;
    closePrintModal();
    const win = window.open("", "_blank");
    if (!win) {
      showToast("Przeglądarka zablokowała okno wydruku — zezwól na wyskakujące okna");
      return;
    }
    win.document.write(buildPrintHTML(emp, state.year));
    win.document.close();
  }

  function buildPrintHTML(emp, year) {
    const holMap = H.holidayMap(year);
    const dows = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];

    let monthsHtml = "";
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const offset = (new Date(year, m, 1).getDay() + 6) % 7; // pn = 0
      const cells = [];
      for (let i = 0; i < offset; i++) cells.push('<td class="empty"></td>');

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, m, day);
        const key = H.dateKey(d);
        const code = getCode(emp.days[key]);
        let cls = "";
        let style = "";
        if (code && PRINT_COLORS[code]) {
          const c = PRINT_COLORS[code];
          style = `background:${c.bg};color:${c.fg};font-weight:700;`;
        } else if (holMap.has(key)) {
          cls = "hol";
        } else if (H.isWeekend(d)) {
          cls = "wkd";
        }
        cells.push(`<td class="${cls}" style="${style}">${day}</td>`);
      }
      while (cells.length % 7 !== 0) cells.push('<td class="empty"></td>');

      let rows = "";
      for (let i = 0; i < cells.length; i += 7) {
        rows += "<tr>" + cells.slice(i, i + 7).join("") + "</tr>";
      }
      monthsHtml += `
        <div class="pm">
          <div class="pm-t">${POLISH_MONTHS[m]}</div>
          <table>
            <thead><tr>${dows.map((x) => `<th class="${x === "so" || x === "nd" ? "wkd-h" : ""}">${x}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    let sumRows = "";
    let sumPool = 0, sumUsed = 0;
    for (const code of PRINT_CODES) {
      const cDef = CODES.find((x) => x.code === code);
      let days = getUsage(emp, code, year).days;
      let noteTxt = "";
      if (code === "U") {
        // UŻ schodzi z puli urlopu wypoczynkowego
        days += getUsage(emp, "UŻ", year).days;
        noteTxt = " (razem z UŻ)";
      }
      const pool = typeof emp.pools[code] === "number" ? emp.pools[code] : 0;
      const left = Math.max(0, pool - days);
      if (code !== "UŻ") {
        // UŻ mieści się w puli U — nie dublujemy go w sumie
        sumPool += pool;
        sumUsed += days;
      }
      sumRows += `<tr>
        <td class="lbl"><span class="chip" style="background:${PRINT_COLORS[code].bg}"></span>${cDef.label} (${code})${noteTxt}</td>
        <td>${pool}</td>
        <td>${formatUsage(days)}</td>
        <td><b>${formatUsage(left)}</b></td>
      </tr>`;
    }
    sumRows += `<tr class="tot">
      <td class="lbl">Razem</td>
      <td>${sumPool}</td>
      <td>${formatUsage(sumUsed)}</td>
      <td><b>${formatUsage(Math.max(0, sumPool - sumUsed))}</b></td>
    </tr>`;

    const legend = PRINT_CODES.map((code) => {
      const cDef = CODES.find((x) => x.code === code);
      return `<span class="lg"><span class="chip" style="background:${PRINT_COLORS[code].bg}"></span>${cDef.label} (${code})</span>`;
    }).join("");

    const name = escapeHtml(getDisplayName(emp));

    return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Kalendarz urlopowy ${year} — ${name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 8mm; }
  @page { size: A4 portrait; margin: 8mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }

  .head { display: flex; justify-content: space-between; align-items: baseline;
          border-bottom: 2px solid #0f172a; padding-bottom: 3mm; margin-bottom: 4mm; }
  .head h1 { font-size: 14pt; }
  .head .yr { font-size: 12pt; font-weight: 700; }
  .head .sub { font-size: 8pt; color: #64748b; }

  .legend { display: flex; gap: 5mm; flex-wrap: wrap; font-size: 8pt; margin-bottom: 3mm; }
  .lg { display: inline-flex; align-items: center; gap: 1.5mm; }
  .chip { display: inline-block; width: 3.2mm; height: 3.2mm; border-radius: 1mm;
          border: 0.2mm solid rgba(15,23,42,0.25); }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; }
  .pm-t { font-size: 8.5pt; font-weight: 700; text-align: center; padding: 1mm 0;
          background: #e2e8f0; border: 0.2mm solid #cbd5e1; border-bottom: none; }
  .pm table { width: 100%; border-collapse: collapse; }
  .pm th { font-size: 6.5pt; color: #64748b; border: 0.2mm solid #e2e8f0;
           padding: 0.5mm 0; font-weight: 600; background: #f8fafc; }
  .pm th.wkd-h { color: #b91c1c; }
  .pm td { font-size: 7.5pt; text-align: center; border: 0.2mm solid #e2e8f0;
           height: 5.2mm; vertical-align: middle; }
  .pm td.wkd { background: #eef1f5; color: #94a3b8; }
  .pm td.hol { background: #fde8e8; color: #b91c1c; }
  .pm td.empty { background: #fff; border-color: #f1f5f9; }

  .sum { margin-top: 5mm; }
  .sum h2 { font-size: 10pt; margin-bottom: 2mm; }
  .sum table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  .sum th, .sum td { border: 0.25mm solid #94a3b8; padding: 1.6mm 2.5mm; text-align: center; }
  .sum th { background: #e2e8f0; font-size: 8pt; }
  .sum td.lbl { text-align: left; }
  .sum .chip { margin-right: 1.5mm; vertical-align: -0.4mm; }
  .sum tr.tot td { font-weight: 700; background: #f1f5f9; }

  .foot { margin-top: 4mm; display: flex; justify-content: space-between;
          font-size: 7.5pt; color: #64748b; }

  .print-bar { text-align: center; margin-bottom: 4mm; }
  .print-bar button { font-size: 11pt; padding: 2mm 8mm; cursor: pointer; }
</style>
</head>
<body>
  <div class="print-bar no-print"><button onclick="window.print()">🖨 Drukuj</button></div>
  <div class="head">
    <div>
      <h1>${name}</h1>
      <div class="sub">Kalendarz urlopowy — plan urlopów</div>
    </div>
    <div class="yr">Rok ${year}</div>
  </div>
  <div class="legend">${legend}
    <span class="lg"><span class="chip" style="background:#eef1f5"></span>weekend</span>
    <span class="lg"><span class="chip" style="background:#fde8e8"></span>święto</span>
  </div>
  <div class="grid">${monthsHtml}</div>
  <div class="sum">
    <h2>Wykorzystanie urlopów — ${year}</h2>
    <table>
      <thead>
        <tr><th>Rodzaj urlopu</th><th>Pula (dni)</th><th>Rozplanowane / wykorzystane (dni)</th><th>Pozostało do wydania (dni)</th></tr>
      </thead>
      <tbody>${sumRows}</tbody>
    </table>
  </div>
  <div class="foot">
    <span>Wydruk: ${new Date().toLocaleDateString("pl-PL")}</span>
    <span>Kalendarz urlopowy</span>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body>
</html>`;
  }

  // ─── eksport / import ─────────────────────────────────────────────────
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kalendarz-urlopowy-${state.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Plik zapisany");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.employees)) {
          throw new Error("Nieprawidłowy format pliku");
        }
        if (!confirm("Zastąpić obecne dane danymi z pliku?")) return;
        state = parsed;
        saveState();
        // synchronizuj rok z selectem
        document.getElementById("yearSelect").value = state.year;
        renderAll();
        showToast("Dane wczytane");
      } catch (err) {
        alert("Błąd importu: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function showToast(msg, type) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    t.classList.toggle("toast-alert", type === "alert");
    const duration = type === "alert" ? 4500 : 2200;
    setTimeout(() => {
      t.hidden = true;
      t.classList.remove("toast-alert");
    }, duration);
  }

  // ─── główny render ────────────────────────────────────────────────────
  function renderAll() {
    const dates = getVisibleDates();
    const holMap = H.holidayMap(state.year);
    const todayKey = H.dateKey(new Date());

    document.getElementById("brandSubtitle").textContent = `— rok ${state.year}`;

    // Zaznaczenie tylko z bieżącego roku; domyślnie dziś, inaczej 1 stycznia
    selectedDayKeys = new Set([...selectedDayKeys].filter((k) => k.startsWith(state.year + "-")));
    if (!selectedDayKey || !selectedDayKey.startsWith(state.year + "-")) {
      const today = new Date();
      if (today.getFullYear() === state.year) selectedDayKey = todayKey;
      else selectedDayKey = `${state.year}-01-01`;
      selectedDayKeys.add(selectedDayKey);
    }
    if (!selectedDayKeys.size && selectedDayKey) selectedDayKeys.add(selectedDayKey);

    document.documentElement.style.setProperty("--frozen-width", frozenPanelWidthPx() + "px");

    renderHead(dates, holMap, todayKey);
    renderBody(dates, holMap);
    // dopisz klasy zaznaczenia po zbudowaniu wierszy
    applySelectionHighlights();
    updateSummary();
    renderDayStats();
    renderVacSelection();
    renderTrainingStats();
    // Ponowne wyrównanie po pełnym renderze (fonty/układ mogły się zmienić)
    requestAnimationFrame(syncRowHeights);
  }

  // ─── init ─────────────────────────────────────────────────────────────
  async function init() {
    const ok = await loadState();
    if (!ok) return;

    // Year select
    const sel = document.getElementById("yearSelect");
    for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === state.year) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", (e) => {
      state.year = parseInt(e.target.value, 10);
      saveState();
      populateViewSelectors();
      renderAll();
    });

    // Widok: cały rok / miesiąc / zakres tygodni
    populateViewSelectors();
    syncViewBarVisibility();
    document.getElementById("viewModeSel").addEventListener("change", (e) => {
      viewMode = e.target.value;
      syncViewBarVisibility();
      renderAll();
    });
    document.getElementById("viewMonthSel").addEventListener("change", (e) => {
      viewMonth = parseInt(e.target.value, 10);
      renderAll();
    });
    document.getElementById("viewWeekFrom").addEventListener("change", (e) => {
      viewWeekFromIdx = parseInt(e.target.value, 10);
      renderAll();
    });
    document.getElementById("viewWeekTo").addEventListener("change", (e) => {
      viewWeekToIdx = parseInt(e.target.value, 10);
      renderAll();
    });

    // Wyrównywanie wierszy: po załadowaniu fontów i przy zmianie rozmiaru okna
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => syncRowHeights());
    }
    let rhTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(rhTimer);
      rhTimer = setTimeout(syncRowHeights, 150);
    });

    // Add employee – modal
    document.getElementById("addEmployeeBtn").addEventListener("click", () => openEmpModal({ mode: "add" }));
    document.getElementById("empModalCloseBtn").addEventListener("click", closeEmpModal);
    document.getElementById("empFormCancelBtn").addEventListener("click", closeEmpModal);
    document.getElementById("empForm").addEventListener("submit", submitEmpForm);
    document.getElementById("empAin").addEventListener("input", (e) => {
      const cleaned = normalizeAin(e.target.value);
      if (e.target.value !== cleaned) e.target.value = cleaned;
    });
    document.getElementById("empClearAbsBtn").addEventListener("click", () => {
      if (!empModalCtx || empModalCtx.mode !== "edit") return;
      const emp = state.employees.find((x) => x.id === empModalCtx.id);
      if (!emp) return;
      const n = Object.keys(emp.days || {}).length;
      if (!n) { showToast("Ten pracownik nie ma żadnych absencji"); return; }
      if (!confirm(
        `Usunąć WSZYSTKIE absencje pracownika ${getDisplayName(emp)} (${n} wpisów, wszystkie lata)?\n\nTej operacji nie można cofnąć.`
      )) return;
      emp.days = {};
      saveState();
      closeEmpModal();
      renderAll();
      showToast("Usunięto wszystkie absencje pracownika");
    });
    document.getElementById("trainAddDept").addEventListener("change", syncTrainAreaSelect);
    document.getElementById("trainAddBtn").addEventListener("click", addModalTraining);
    populateTrainDeptSelect();
    document.getElementById("empModal").addEventListener("click", (e) => {
      if (e.target.id === "empModal") closeEmpModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const m = document.getElementById("empModal");
        if (m && !m.hidden) closeEmpModal();
        const pm = document.getElementById("printModal");
        if (pm && !pm.hidden) closePrintModal();
      }
    });

    // Panel obsady – zwijanie / rozwijanie
    const dayStats = document.getElementById("dayStats");
    document.getElementById("dayStatsToggleBtn").addEventListener("click", () => {
      const collapsed = dayStats.classList.toggle("collapsed");
      document.getElementById("dayStatsToggleBtn").textContent = collapsed ? "+" : "−";
    });

    const funcChartPanel = document.getElementById("funcChartPanel");
    document.getElementById("funcChartToggleBtn").addEventListener("click", () => {
      const collapsed = funcChartPanel.classList.toggle("collapsed");
      document.getElementById("funcChartToggleBtn").textContent = collapsed ? "+" : "−";
    });

    const trainingStatsPanel = document.getElementById("trainingStatsPanel");
    document.getElementById("trainingStatsToggleBtn").addEventListener("click", () => {
      const collapsed = trainingStatsPanel.classList.toggle("collapsed");
      document.getElementById("trainingStatsToggleBtn").textContent = collapsed ? "+" : "−";
    });

    const vacSelPanel = document.getElementById("vacSelPanel");
    document.getElementById("vacSelToggleBtn").addEventListener("click", () => {
      const collapsed = vacSelPanel.classList.toggle("collapsed");
      document.getElementById("vacSelToggleBtn").textContent = collapsed ? "+" : "−";
    });

    const weekHoursPanel = document.getElementById("weekHoursPanel");
    document.getElementById("weekHoursToggleBtn").addEventListener("click", () => {
      const collapsed = weekHoursPanel.classList.toggle("collapsed");
      document.getElementById("weekHoursToggleBtn").textContent = collapsed ? "+" : "−";
    });

    // Pływające okienka: przesuwanie za nagłówek + regulacja wielkości
    // (pozycja i rozmiar zapamiętywane na urządzeniu)
    ["dayStats", "funcChartPanel", "trainingStatsPanel", "vacSelPanel", "weekHoursPanel"]
      .forEach((id) => { makePanelDraggable(id); makePanelResizable(id); });

    // Motyw jasny/ciemny — zapamiętywany na tym urządzeniu
    function applyTheme(theme) {
      const dark = theme === "dark";
      if (dark) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      const btn = document.getElementById("themeToggleBtn");
      if (btn) {
        btn.textContent = dark ? "☀️" : "🌙";
        btn.title = dark ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw";
      }
      try { localStorage.setItem("kalendarzTheme", dark ? "dark" : "light"); } catch (e) { /* ignore */ }
    }
    let currentTheme = "light";
    try { if (localStorage.getItem("kalendarzTheme") === "dark") currentTheme = "dark"; } catch (e) { /* ignore */ }
    applyTheme(currentTheme);
    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
    });

    // Wskaźnik zapisu: odświeżaj licznik co sekundę
    updateSaveStatus();
    setInterval(updateSaveStatus, 1000);

    // Ostrzeż przed zamknięciem strony, gdy zmiany nie dotarły na serwer.
    // W Electronie preventDefault blokowałby zamknięcie okna bez komunikatu,
    // więc tam polegamy tylko na awaryjnym sendBeacon niżej.
    const isElectron = /Electron/i.test(navigator.userAgent);
    if (!isElectron) {
      window.addEventListener("beforeunload", (e) => {
        if (saveInfo.dirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      });
    }

    // Awaryjny zapis przy zamykaniu/ukrywaniu strony — sendBeacon działa
    // nawet w trakcie zamykania karty (wysyła POST)
    window.addEventListener("pagehide", () => {
      if (!saveInfo.dirty || !navigator.sendBeacon) return;
      try {
        const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
        navigator.sendBeacon("/api/state", blob);
      } catch (e) { /* best effort */ }
    });

    // Import absencji z Kronos
    document.getElementById("kronosBtn").addEventListener("click", openKronosModal);
    document.getElementById("kronosModalCloseBtn").addEventListener("click", closeKronosModal);
    document.getElementById("kronosCloseBtn2").addEventListener("click", closeKronosModal);
    document.getElementById("kronosModal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("kronosModal")) closeKronosModal();
    });
    document.getElementById("kronosFile").addEventListener("change", (e) => {
      handleKronosFile(e.target.files && e.target.files[0]);
    });

    // Ręczne wpisywanie absencji
    document.getElementById("absFormBtn").addEventListener("click", openAbsFormModal);
    document.getElementById("absFormCloseBtn").addEventListener("click", closeAbsFormModal);
    document.getElementById("absFormCancelBtn").addEventListener("click", closeAbsFormModal);
    document.getElementById("absFormAddRowBtn").addEventListener("click", addAbsFormRow);
    document.getElementById("absFormSubmitBtn").addEventListener("click", submitAbsForm);
    document.getElementById("absFormModal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("absFormModal")) closeAbsFormModal();
    });

    // Export / import
    document.getElementById("printBtn").addEventListener("click", openPrintModal);
    document.getElementById("printModalCloseBtn").addEventListener("click", closePrintModal);
    document.getElementById("printCancelBtn").addEventListener("click", closePrintModal);
    document.getElementById("printGoBtn").addEventListener("click", printEmployeeCalendar);
    document.getElementById("printModal").addEventListener("click", (e) => {
      if (e.target.id === "printModal") closePrintModal();
    });

    document.getElementById("exportBtn").addEventListener("click", exportData);
    document.getElementById("importInput").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) importData(f);
      e.target.value = "";
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      try {
        await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
      } catch (e) { /* ignore */ }
      window.location.href = "/login.html";
    });

    // Delegacja kliknięcia na komórki dni
    document.getElementById("kalendarzBody").addEventListener("click", onCellClick);

    initRowDragDrop();

    const empInfoPop = document.getElementById("empInfoPopover");
    empInfoPop.addEventListener("mouseenter", () => clearTimeout(empInfoHideTimer));
    empInfoPop.addEventListener("mouseleave", () => {
      empInfoHideTimer = setTimeout(hideEmpInfoPopover, 150);
    });
    document.getElementById("tableWrap").addEventListener("scroll", hideEmpInfoPopover, { passive: true });

    renderCodePicker();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
