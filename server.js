// Kalendarz urlopowy — © 2026 Sławomir Rypicz. Wszelkie prawa zastrzeżone.
// Projekt stworzony prywatnie, poza obowiązkami ze stosunku pracy.
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const {
  ensureDataDir,
  readState,
  readAuthConfig,
  storageMode,
  defaultState,
  readJsonFileByName,
  writeJsonFiles,
  readUsers,
  writeUsers,
  listBackupsFor,
} = require("./lib/storage");

const PORT = parseInt(process.env.PORT, 10) || 5175;
const ROOT = __dirname;

const ADMIN_LOGIN = "rypicz.slawomir@gmail.com";
const ENV_AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me-in-production";
const IS_PROD = process.env.NODE_ENV === "production";
// Tryb desktopowy (Electron): lokalna aplikacja bez logowania, dane w pliku
const DESKTOP = process.env.DESKTOP_MODE === "1";

if (IS_PROD && !DESKTOP && SESSION_SECRET === "dev-only-change-me-in-production") {
  console.error("Ustaw SESSION_SECRET przed uruchomieniem w produkcji.");
  process.exit(1);
}

if (IS_PROD && !DESKTOP && storageMode() !== "gist") {
  console.error("Ustaw GITHUB_GIST_ID i GITHUB_TOKEN — dane na Render muszą być w GitHub Gist.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "10mb" }));

// ── konta użytkowników ─────────────────────────────────────────────────
// users.json: [{ id, login, hash, role: "admin"|"user", createdAt }]
// Każdy użytkownik ma prywatny stan w state-<id>.json — API nigdy nie
// wydaje danych innego konta, więc izolacja jest po stronie serwera.
let users = [];

// Wirtualny użytkownik trybu desktopowego (bez logowania, stan w state.json)
const DESKTOP_USER = { id: "desktop", login: "desktop", role: "user" };

function createUserId() {
  return "u-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sessionUser(req) {
  if (DESKTOP) return DESKTOP_USER;
  return req.session && req.session.user ? req.session.user : null;
}

function isLoggedIn(req) {
  return Boolean(sessionUser(req));
}

function requireAuth(req, res, next) {
  if (DESKTOP) return next();
  if (isLoggedIn(req)) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Wymagane logowanie" });
  }
  return res.redirect("/login.html");
}

function requireAdmin(req, res, next) {
  const u = sessionUser(req);
  if (!DESKTOP && u && u.role === "admin") return next();
  return res.status(403).json({ error: "Tylko administrator" });
}

async function persistUsers() {
  await writeUsers({ users });
}

function stateFileName(userId) {
  return userId === "desktop" ? "state.json" : `state-${userId}.json`;
}

// ── stan w pamięci + rzadszy zapis do gist (per użytkownik) ────────────
// GitHub limituje częste zapisy (secondary rate limit) — trzymamy stan
// w pamięci i wysyłamy do gista najwyżej co FLUSH_INTERVAL_MS.
const FLUSH_INTERVAL_MS = 30 * 1000;
const caches = new Map(); // userId -> { state, dirty, flushing, lastBackupDate }

async function loadUserState(user) {
  let c = caches.get(user.id);
  if (c && c.state) return c.state;
  let state = await readJsonFileByName(stateFileName(user.id), null);
  // Migracja: pierwszy odczyt admina przejmuje dotychczasowy wspólny state.json
  if (!state && user.role === "admin") {
    try { state = await readState(); } catch (e) { /* start od zera */ }
  }
  if (!state || typeof state !== "object") state = defaultState();
  c = { state, dirty: false, flushing: false, lastBackupDate: null };
  caches.set(user.id, c);
  return state;
}

async function flushUser(userId) {
  const c = caches.get(userId);
  if (!c || !c.dirty || c.flushing || !c.state) return;
  c.flushing = true;
  const snapshot = c.state;
  try {
    const files = { [stateFileName(userId)]: snapshot };
    // Automatyczna kopia zapasowa: raz dziennie, rotacja po dniu tygodnia
    // (7 ostatnich dni). W trybie gist idzie w TYM SAMYM zapisie — zero
    // dodatkowych requestów do API GitHuba.
    const today = new Date().toISOString().slice(0, 10);
    if (c.lastBackupDate !== today) {
      const dow = new Date().getDay();
      files[`backup-${userId}-${dow}.json`] = { savedAt: new Date().toISOString(), state: snapshot };
      c.lastBackupDate = today;
    }
    await writeJsonFiles(files);
    if (c.state === snapshot) c.dirty = false;
  } catch (e) {
    console.error(`Błąd zapisu (${userId}) — ponowię za chwilę:`, e.message);
  } finally {
    c.flushing = false;
  }
}

async function flushAll() {
  for (const userId of caches.keys()) {
    try { await flushUser(userId); } catch (e) { /* pojedynczo */ }
  }
}

setInterval(flushAll, FLUSH_INTERVAL_MS);

// Przy zamykaniu instancji (deploy/restart na Render) dopisz zaległe zmiany
process.on("SIGTERM", async () => {
  try { await flushAll(); } catch (e) { /* najlepsze co możemy */ }
  process.exit(0);
});

function registerRoutes() {
  app.post("/api/login", (req, res) => {
    const login = String(req.body?.username || req.body?.login || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    const user = users.find((u) => u.login.toLowerCase() === login);
    if (!user || !bcrypt.compareSync(password, user.hash)) {
      return res.status(401).json({ error: "Nieprawidłowy login lub hasło" });
    }

    req.session.user = { id: user.id, login: user.login, role: user.role };
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Błąd sesji" });
      res.json({ ok: true, user: user.login, role: user.role });
    });
  });

  app.get("/login.html", (req, res) => {
    if (DESKTOP || isLoggedIn(req)) return res.redirect("/");
    res.sendFile(path.join(ROOT, "login.html"));
  });

  app.use("/css", express.static(path.join(ROOT, "css")));
  app.use("/js/login.js", express.static(path.join(ROOT, "js", "login.js")));

  app.use(requireAuth);

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/me", (req, res) => {
    const u = sessionUser(req);
    res.json({
      user: u && !DESKTOP ? u.login : null,
      role: u && !DESKTOP ? u.role : null,
      desktop: DESKTOP,
    });
  });

  app.get("/api/version", (req, res) => {
    res.json({ version: require("./package.json").version });
  });

  app.get("/api/state", async (req, res) => {
    try {
      res.json(await loadUserState(sessionUser(req)));
    } catch (e) {
      console.error("Błąd odczytu:", e.message);
      res.status(500).json({ error: "Nie udało się wczytać danych" });
    }
  });

  const saveStateHandler = async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || !Array.isArray(body.employees)) {
      return res.status(400).json({ error: "Nieprawidłowy format danych" });
    }
    const u = sessionUser(req);
    // Zapis do pamięci — do gista trafi zbiorczo (interwał), co chroni
    // konto GitHub przed limitem częstych zapisów.
    let c = caches.get(u.id);
    if (!c) {
      c = { state: null, dirty: false, flushing: false, lastBackupDate: null };
      caches.set(u.id, c);
    }
    c.state = body;
    c.dirty = true;
    // W trybie plikowym (desktop/lokalnie) zapis jest tani — od razu na dysk.
    if (storageMode() === "file") {
      try { await flushUser(u.id); } catch (e) { /* interwał ponowi */ }
    }
    res.json({ ok: true });
  };

  app.put("/api/state", saveStateHandler);
  // POST przyjmuje awaryjny zapis navigator.sendBeacon przy zamykaniu strony
  app.post("/api/state", saveStateHandler);

  // Zmiana własnego hasła (każdy zalogowany, poza trybem desktop)
  app.post("/api/password", async (req, res) => {
    if (DESKTOP) return res.status(400).json({ error: "Niedostępne w wersji desktopowej" });
    const u = sessionUser(req);
    const user = users.find((x) => x.id === u.id);
    if (!user) return res.status(401).json({ error: "Wymagane logowanie" });
    const oldPassword = String(req.body?.oldPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!bcrypt.compareSync(oldPassword, user.hash)) {
      return res.status(400).json({ error: "Obecne hasło jest nieprawidłowe" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Nowe hasło musi mieć min. 6 znaków" });
    }
    user.hash = bcrypt.hashSync(newPassword, 12);
    try {
      await persistUsers();
      res.json({ ok: true });
    } catch (e) {
      console.error("Błąd zapisu users.json:", e.message);
      res.status(500).json({ error: "Nie udało się zapisać hasła" });
    }
  });

  // ── panel administratora ──────────────────────────────────────────────
  // Admin zarządza kontami i kopiami zapasowymi, ale NIE ma wglądu w dane
  // kalendarzy innych użytkowników (API nie wystawia takiego endpointu).
  app.get("/api/users", requireAdmin, (req, res) => {
    res.json({
      users: users.map((u) => ({ id: u.id, login: u.login, role: u.role, createdAt: u.createdAt })),
    });
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    const login = String(req.body?.login || "").trim();
    const password = String(req.body?.password || "");
    if (login.length < 3) return res.status(400).json({ error: "Podaj login (min. 3 znaki, np. e-mail)" });
    if (password.length < 6) return res.status(400).json({ error: "Hasło startowe musi mieć min. 6 znaków" });
    if (users.some((u) => u.login.toLowerCase() === login.toLowerCase())) {
      return res.status(400).json({ error: "Konto o tym loginie już istnieje" });
    }
    const user = {
      id: createUserId(),
      login,
      hash: bcrypt.hashSync(password, 12),
      role: "user",
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    try {
      await persistUsers();
      res.json({ ok: true, user: { id: user.id, login: user.login, role: user.role, createdAt: user.createdAt } });
    } catch (e) {
      users = users.filter((u) => u.id !== user.id);
      console.error("Błąd zapisu users.json:", e.message);
      res.status(500).json({ error: "Nie udało się utworzyć konta" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "Nie ma takiego konta" });
    if (user.id === sessionUser(req).id) {
      return res.status(400).json({ error: "Nie można usunąć własnego konta" });
    }
    users = users.filter((u) => u.id !== user.id);
    caches.delete(user.id);
    try {
      await persistUsers();
      // Usuń plik stanu; kopie zapasowe celowo zostają (możliwość odzyskania)
      await writeJsonFiles({ [stateFileName(user.id)]: null });
      res.json({ ok: true });
    } catch (e) {
      console.error("Błąd usuwania konta:", e.message);
      res.status(500).json({ error: "Nie udało się usunąć konta" });
    }
  });

  app.post("/api/users/:id/password", requireAdmin, async (req, res) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "Nie ma takiego konta" });
    const password = String(req.body?.password || "");
    if (password.length < 6) return res.status(400).json({ error: "Hasło musi mieć min. 6 znaków" });
    user.hash = bcrypt.hashSync(password, 12);
    try {
      await persistUsers();
      res.json({ ok: true });
    } catch (e) {
      console.error("Błąd zapisu users.json:", e.message);
      res.status(500).json({ error: "Nie udało się zapisać hasła" });
    }
  });

  app.get("/api/users/:id/backups", requireAdmin, async (req, res) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "Nie ma takiego konta" });
    try {
      const backups = await listBackupsFor(user.id);
      backups.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
      res.json({ backups });
    } catch (e) {
      console.error("Błąd listowania kopii:", e.message);
      res.status(500).json({ error: "Nie udało się pobrać listy kopii" });
    }
  });

  app.post("/api/users/:id/restore", requireAdmin, async (req, res) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "Nie ma takiego konta" });
    const name = String(req.body?.name || "");
    // Tylko kopie tego użytkownika, ścisły wzorzec nazwy
    if (!new RegExp(`^backup-${user.id}-[0-6]\\.json$`).test(name)) {
      return res.status(400).json({ error: "Nieprawidłowa nazwa kopii" });
    }
    try {
      const backup = await readJsonFileByName(name, null);
      if (!backup || !backup.state) return res.status(404).json({ error: "Kopia nie istnieje lub jest uszkodzona" });
      const c = { state: backup.state, dirty: true, flushing: false, lastBackupDate: new Date().toISOString().slice(0, 10) };
      caches.set(user.id, c);
      await writeJsonFiles({ [stateFileName(user.id)]: backup.state });
      c.dirty = false;
      res.json({ ok: true, savedAt: backup.savedAt || null });
    } catch (e) {
      console.error("Błąd przywracania kopii:", e.message);
      res.status(500).json({ error: "Nie udało się przywrócić kopii" });
    }
  });

  app.use(express.static(ROOT));

  app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "index.html"));
  });
}

async function bootstrap() {
  // Wczytaj konta; przy pierwszym starcie utwórz konto administratora.
  // Hasło startowe admina: dotychczasowe hasło z auth.json (gist) lub
  // AUTH_PASSWORD — logowanie nie zmienia się dla obecnego użytkownika.
  if (!DESKTOP) {
    try {
      const store = await readUsers();
      if (store && Array.isArray(store.users) && store.users.length) {
        users = store.users;
        console.log(`Konta użytkowników: ${users.length}`);
      }
    } catch (e) {
      console.warn("Nie udało się wczytać users.json:", e.message);
    }

    if (!users.length) {
      let password = ENV_AUTH_PASSWORD;
      try {
        const authCfg = await readAuthConfig();
        if (authCfg?.password) password = String(authCfg.password);
      } catch (e) { /* env wystarczy */ }

      if (IS_PROD && (!password || password.length < 4)) {
        console.error("Pierwszy start kont: ustaw hasło admina w auth.json (gist) lub AUTH_PASSWORD (min. 4 znaki).");
        process.exit(1);
      }
      if (!password) {
        password = "admin";
        console.warn("⚠  Brak AUTH_PASSWORD — admin z hasłem 'admin' (tylko do testów lokalnych!)");
      }

      users = [{
        id: createUserId(),
        login: ADMIN_LOGIN,
        hash: bcrypt.hashSync(password, 12),
        role: "admin",
        createdAt: new Date().toISOString(),
      }];
      try {
        await persistUsers();
        console.log(`Utworzono konto administratora: ${ADMIN_LOGIN}`);
      } catch (e) {
        console.error("Nie udało się zapisać users.json:", e.message);
        process.exit(1);
      }
    }
  }

  app.use(
    session({
      name: "kalendarz.sid",
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: IS_PROD,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  registerRoutes();

  await new Promise((resolve) => {
    app.listen(PORT, () => {
      ensureDataDir();
      console.log(`Kalendarz urlopowy: port ${PORT} | storage: ${storageMode()} | desktop: ${DESKTOP}`);
      if (!IS_PROD && !DESKTOP) console.log(`Login admina: ${ADMIN_LOGIN}`);
      resolve();
    });
  });
}

// Uruchom bezpośrednio (node server.js); w Electronie bootstrap woła electron-main.js
if (require.main === module) {
  bootstrap().catch((e) => {
    console.error("Błąd startu serwera:", e);
    process.exit(1);
  });
}

module.exports = { bootstrap };
