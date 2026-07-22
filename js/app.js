(function () {
  "use strict";

  const H = window.PLHolidays;

  // ─── konfiguracja ─────────────────────────────────────────────────────
  const STORAGE_KEY = "kalendarz-urlopow-v1";
  const STATE_VERSION = 8;
  const YEAR_MIN = 2024;
  const YEAR_MAX = 2060;

  /** Szerokości kolumn lewego panelu — zgodne z css/styles.css (.col-*) */
  const STICKY_COL_WIDTHS = {
    "col-lp": 44, "col-name": 240, "col-pool": 60, "col-wyk": 84, "col-l4": 60, "col-abs": 64, "col-actions": 68,
  };
  function frozenPanelWidthPx() {
    const poolCount = CODES.filter((c) => c.defaultPool !== null).length;
    return (
      STICKY_COL_WIDTHS["col-lp"] +
      STICKY_COL_WIDTHS["col-name"] +
      poolCount * STICKY_COL_WIDTHS["col-pool"] +
      poolCount * STICKY_COL_WIDTHS["col-wyk"] +
      STICKY_COL_WIDTHS["col-l4"] +
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
    return String(raw || "").replace(/\D/g, "").slice(0, 10);
  }

  function normalizeEmployeeFields(emp) {
    const legacyDept = typeof emp.dept === "string" ? emp.dept : "";
    emp.trainings = normalizeTrainingList(emp.trainings, legacyDept);
    if ("dept" in emp) delete emp.dept;
    emp.ain = normalizeAin(emp.ain);
  }

  const POLISH_MONTHS = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
  ];
  const POLISH_DOW = ["nd", "pn", "wt", "śr", "cz", "pt", "so"];

  // Kody absencji.
  //   hourly: true  → kod rozliczany godzinowo (pula w godzinach)
  //   hourly: false → kod rozliczany dziennie  (pula w dniach roboczych)
  const CODES = [
    { code: "U",   label: "Wypoczynkowy",     article: "art. 154 KP",   defaultPool: 26,   hourly: false },
    { code: "D",   label: "Dodatkowy",        article: "regulamin",     defaultPool:  6,   hourly: false },
    { code: "UŻ",  label: "Na żądanie",       article: "art. 167² KP",  defaultPool:  4,   hourly: false },
    { code: "SW",  label: "Siła wyższa",      article: "art. 148¹ KP",  defaultPool: 16,   hourly: true  },
    { code: "OPR", label: "Opieka rodzina",   article: "art. 173¹ KP",  defaultPool:  5,   hourly: false },
    { code: "OP",  label: "Opieka dziecko",   article: "art. 188 KP",   defaultPool: 16,   hourly: true  },
    { code: "KREW", label: "Krwiodastwo",     article: "art. 128¹ KP",  defaultPool: null, hourly: false },
    { code: "NUN", label: "Obecność niepłatna", article: "art. 174 KP", defaultPool: null, hourly: false },
    { code: "L",   label: "L4 (chorobowe)",   article: "art. 92 KP",    defaultPool: null, hourly: false },
  ];

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
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
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
    } catch (e) {
      console.warn("Nie udało się zapisać:", e);
      showToast("Błąd zapisu — odśwież stronę i spróbuj ponownie.");
    }
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

    // v7 → v8: numer AIN pracownika (10 cyfr)
    if (s.version === 7) {
      for (const emp of s.employees || []) {
        if (typeof emp.ain !== "string") emp.ain = "";
        emp.ain = normalizeAin(emp.ain);
      }
      s.version = 8;
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
  function wouldFitInPool(emp, newCode, oldVal, newHoursForCell) {
    const limit = poolHoursLimit(emp, newCode);
    if (limit === Infinity) return true;
    const currentHours = getUsage(emp, newCode, state.year).totalHours;
    const oldHoursForThisCell = (getCode(oldVal) === newCode) ? getHours(oldVal) : 0;
    return (currentHours - oldHoursForThisCell + newHoursForCell) <= limit;
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
    let currentWeek = -1;
    let weekTh = null;
    let daysInWeek = 0;
    dates.forEach((d) => {
      const wk = H.fiscalWeekNumber(d);
      if (wk !== currentWeek) {
        if (weekTh) weekTh.colSpan = daysInWeek;
        currentWeek = wk;
        daysInWeek = 0;
        weekTh = document.createElement("th");
        weekTh.className = "week-header";
        const isWeekOne = wk === 1;
        if (isWeekOne) weekTh.classList.add("week-one");
        weekTh.textContent = H.fiscalWeekLabel(wk, isWeekOne);
        const fyStart = H.fiscalYearStart(d);
        weekTh.title = isWeekOne
          ? "Week 1 — początek roku fiskalnego (1 lutego)"
          : `Tydzień fiskalny ${wk} (rok od ${fyStart.getDate()} ${POLISH_MONTHS[fyStart.getMonth()].toLowerCase()} ${fyStart.getFullYear()})`;
        trWeekS.appendChild(weekTh);
      }
      daysInWeek++;
    });
    if (weekTh) weekTh.colSpan = daysInWeek;
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
      cls: "col-abs",
      html: `<div class="hdr-abs"><span class="hdr-code">%ABS</span><span class="hdr-unit">dział: <b id="absTeamPct">—</b></span></div>`,
      title: "Procent absencji pracownika (dni absencji / dni robocze roku). Poniżej: średnia całego działu.",
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
      if (key === selectedDayKey) th.classList.add("selected");

      th.innerHTML = `<span class="day-num">${d.getDate()}</span><span class="day-dow">${POLISH_DOW[d.getDay()]}</span>`;
      th.addEventListener("click", () => selectDay(key));
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

    const frozenColCount = 2 + CODES.filter((c) => c.defaultPool !== null).length * 2 + 3;

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
      const td = c.code === "L"
        ? tr.querySelector('td.cell-l4[data-code="L"]')
        : tr.querySelector(`td.cell-wyk[data-code="${c.code}"]`);
      if (!td) continue;

      const usage = getUsage(emp, c.code, state.year);
      const totalHours = usage.totalHours;
      const days = usage.days;
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
            notifyBlocked(`Pula ${code} wyczerpana (${pool} ${unit})`);
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

    if (empModalCtx.mode === "edit") {
      const emp = state.employees.find((e) => e.id === empModalCtx.id);
      if (!emp) { closeEmpModal(); return; }
      titleEl.textContent = "Edytuj pracownika";
      submitBtn.textContent = "Zapisz zmiany";
      lnInput.value = emp.lastName  || "";
      fnInput.value = emp.firstName || "";
      ainInput.value = normalizeAin(emp.ain);
      populateTrainDeptSelect();
      setModalTrainings(emp.trainings);
      buildFuncCheckboxes(Array.isArray(emp.funcs) ? emp.funcs : []);
    } else {
      titleEl.textContent = "Dodaj pracownika";
      submitBtn.textContent = "Dodaj";
      lnInput.value = "";
      fnInput.value = "";
      ainInput.value = "";
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

    if (!lastName)  { lnInput.focus(); showToast("Nazwisko jest wymagane"); return; }
    if (!firstName) { fnInput.focus(); showToast("Imię jest wymagane");    return; }
    if (ain && ain.length !== 10) {
      ainInput.focus();
      showToast("Nr AIN musi mieć dokładnie 10 cyfr");
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
      }
      saveState();
      closeEmpModal();
      renderAll();
      showToast("Zapisano zmiany");
    } else {
      state.employees.push(makeEmployee({ lastName, firstName, ain, trainings, funcs }));
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

    for (const emp of state.employees) {
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
    const totalEmps = state.employees.length;
    const totalPresent = state.employees.filter((e) => !isEmpAbsentOn(e, key)).length;
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

  function selectDay(key) {
    selectedDayKey = key;
    // wizualne podświetlenie wybranego dnia
    const all = document.querySelectorAll(".kalendarz-scroll thead .day-header.selected, .kalendarz-scroll tbody .day-cell.col-selected");
    all.forEach((el) => {
      el.classList.remove("selected");
      el.classList.remove("col-selected");
    });
    if (!key) { renderDayStats(); return; }
    const head = document.querySelector(`.kalendarz-scroll thead .day-header[data-date-key="${key}"]`);
    if (head) head.classList.add("selected");
    const bodyCells = document.querySelectorAll(`.kalendarz-scroll tbody .day-cell[data-date-key="${key}"]`);
    bodyCells.forEach((c) => c.classList.add("col-selected"));
    renderDayStats();
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

  function countEmpAbsentDays(emp, year) {
    const prefix = year + "-";
    let n = 0;
    for (const key of Object.keys(emp.days || {})) {
      if (key.startsWith(prefix) && emp.days[key] && isWorkingDayKey(key)) n++;
    }
    return n;
  }

  function formatPct(v) {
    return (Math.round(v * 10) / 10).toLocaleString("pl-PL") + "%";
  }

  function updateAbsenceStats() {
    const year = state.year;
    const workDays = countWorkingDaysInYear(year);
    let totalAbsent = 0;

    for (const emp of state.employees) {
      const absent = countEmpAbsentDays(emp, year);
      totalAbsent += absent;
      const td = document.querySelector(
        `#kalendarzBodyFrozen tr[data-emp-id="${emp.id}"] td.cell-abs`
      );
      if (!td) continue;
      const pct = workDays > 0 ? (absent / workDays) * 100 : 0;
      td.textContent = formatPct(pct);
      td.title = `${getDisplayName(emp)}: ${absent} dni absencji z ${workDays} dni roboczych w ${year}`;
      td.classList.toggle("abs-high", pct >= 15);
      td.classList.toggle("abs-mid", pct >= 7 && pct < 15);
      td.classList.toggle("abs-zero", absent === 0);
    }

    const teamEl = document.getElementById("absTeamPct");
    if (teamEl) {
      const teamPct = workDays > 0 && state.employees.length > 0
        ? (totalAbsent / (workDays * state.employees.length)) * 100
        : 0;
      teamEl.textContent = formatPct(teamPct);
      teamEl.title = `Średnia absencja działu: ${totalAbsent} dni absencji / (${workDays} dni roboczych × ${state.employees.length} pracowników)`;
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
    const dates = H.buildYearDates(state.year);
    const holMap = H.holidayMap(state.year);
    const todayKey = H.dateKey(new Date());

    document.getElementById("brandSubtitle").textContent = `— rok ${state.year}`;

    // Domyślne zaznaczenie: dziś (jeśli mieści się w bieżącym roku), inaczej 1 stycznia
    if (!selectedDayKey || !selectedDayKey.startsWith(state.year + "-")) {
      const today = new Date();
      if (today.getFullYear() === state.year) selectedDayKey = todayKey;
      else selectedDayKey = `${state.year}-01-01`;
    }

    document.documentElement.style.setProperty("--frozen-width", frozenPanelWidthPx() + "px");

    renderHead(dates, holMap, todayKey);
    renderBody(dates, holMap);
    // dopisz klasę col-selected po zbudowaniu wierszy
    if (selectedDayKey) {
      const bodyCells = document.querySelectorAll(`.kalendarz-scroll tbody .day-cell[data-date-key="${selectedDayKey}"]`);
      bodyCells.forEach((c) => c.classList.add("col-selected"));
    }
    updateSummary();
    renderDayStats();
    renderTrainingStats();
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
      renderAll();
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

    // Export / import
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
