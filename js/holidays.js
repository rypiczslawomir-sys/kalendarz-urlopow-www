// Polskie święta państwowe — obliczane dla dowolnego roku.
// Wielkanoc liczona algorytmem anonimowym gregoriańskim (Gauss/Meeus).

(function () {
  "use strict";

  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const L = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * L) / 451);
    const month = Math.floor((h + L - 7 * m + 114) / 31);
    const day = ((h + L - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function getPolishHolidays(year) {
    const easter = easterSunday(year);
    return [
      { date: new Date(year, 0, 1),   name: "Nowy Rok" },
      { date: new Date(year, 0, 6),   name: "Trzech Króli" },
      { date: easter,                  name: "Wielkanoc" },
      { date: addDays(easter, 1),     name: "Poniedziałek Wielkanocny" },
      { date: new Date(year, 4, 1),   name: "Święto Pracy" },
      { date: new Date(year, 4, 3),   name: "Święto Konstytucji 3 Maja" },
      { date: addDays(easter, 49),    name: "Zielone Świątki" },
      { date: addDays(easter, 60),    name: "Boże Ciało" },
      { date: new Date(year, 7, 15),  name: "Wniebowzięcie NMP" },
      { date: new Date(year, 10, 1),  name: "Wszystkich Świętych" },
      { date: new Date(year, 10, 11), name: "Święto Niepodległości" },
      { date: new Date(year, 11, 24), name: "Wigilia" },
      { date: new Date(year, 11, 25), name: "Boże Narodzenie" },
      { date: new Date(year, 11, 26), name: "Drugi dzień Bożego Narodzenia" },
    ];
  }

  function holidayMap(year) {
    const map = new Map();
    for (const h of getPolishHolidays(year)) {
      map.set(dateKey(h.date), h.name);
    }
    return map;
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function daysInYear(year) {
    return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
  }

  function buildYearDates(year) {
    const dates = [];
    const start = new Date(year, 0, 1);
    const total = daysInYear(year);
    for (let i = 0; i < total; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  // Rok fiskalny zaczyna się 1 lutego. Styczeń należy do poprzedniego roku fiskalnego.
  function fiscalYearStart(date) {
    const y = date.getFullYear();
    if (date.getMonth() === 0) return new Date(y - 1, 1, 1);
    return new Date(y, 1, 1);
  }

  function daysBetween(from, to) {
    const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((b - a) / 86400000);
  }

  // Tydzień 1 = 1–7 lut (lub od 1 lut w tygodniu 7-dniowych blokach).
  function fiscalWeekNumber(date) {
    const start = fiscalYearStart(date);
    return Math.floor(daysBetween(start, date) / 7) + 1;
  }

  function isFiscalWeekOneStart(date) {
    return date.getMonth() === 1 && date.getDate() === 1;
  }

  function fiscalWeekLabel(weekNum, isWeekOneBlock) {
    if (isWeekOneBlock) return "Week 1";
    return "W" + weekNum;
  }

  // Eksport do globalu (nie używamy modułów — file:// kompatybilność)
  window.PLHolidays = {
    easterSunday,
    getPolishHolidays,
    holidayMap,
    dateKey,
    daysInYear,
    buildYearDates,
    isWeekend,
    isSameDay,
    fiscalYearStart,
    fiscalWeekNumber,
    isFiscalWeekOneStart,
    fiscalWeekLabel,
  };
})();
