require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const {
  ensureDataDir,
  readState,
  readAuthConfig,
  writeState,
  storageMode,
} = require("./lib/storage");

const PORT = parseInt(process.env.PORT, 10) || 5175;
const ROOT = __dirname;

const ENV_AUTH_USER = (process.env.AUTH_USER || "admin").trim();
const ENV_AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me-in-production";
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD && SESSION_SECRET === "dev-only-change-me-in-production") {
  console.error("Ustaw SESSION_SECRET przed uruchomieniem w produkcji.");
  process.exit(1);
}

if (IS_PROD && storageMode() !== "gist") {
  console.error("Ustaw GITHUB_GIST_ID i GITHUB_TOKEN — dane na Render muszą być w GitHub Gist.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "10mb" }));

let authUser = ENV_AUTH_USER;
let passwordHash = bcrypt.hashSync("admin", 12);

function isLoggedIn(req) {
  return Boolean(req.session && req.session.user);
}

function requireAuth(req, res, next) {
  if (isLoggedIn(req)) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Wymagane logowanie" });
  }
  return res.redirect("/login.html");
}

// ── stan w pamięci + rzadszy zapis do gist ────────────────────────────
// GitHub limituje częste zapisy (secondary rate limit) — trzymamy stan
// w pamięci i wysyłamy do gista najwyżej co FLUSH_INTERVAL_MS.
const FLUSH_INTERVAL_MS = 30 * 1000;
let cachedState = null;
let dirty = false;
let flushing = false;

async function loadStateCached() {
  if (cachedState) return cachedState;
  cachedState = await readState();
  return cachedState;
}

async function flushStateToStorage() {
  if (!dirty || flushing || !cachedState) return;
  flushing = true;
  const snapshot = cachedState;
  try {
    await writeState(snapshot);
    if (cachedState === snapshot) dirty = false;
  } catch (e) {
    console.error("Błąd zapisu do magazynu (ponowię za chwilę):", e.message);
  } finally {
    flushing = false;
  }
}

setInterval(flushStateToStorage, FLUSH_INTERVAL_MS);

// Przy zamykaniu instancji (deploy/restart na Render) dopisz zaległe zmiany
process.on("SIGTERM", async () => {
  try { await flushStateToStorage(); } catch (e) { /* najlepsze co możemy */ }
  process.exit(0);
});

function registerRoutes() {
  app.post("/api/login", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (username !== authUser || !bcrypt.compareSync(password, passwordHash)) {
      return res.status(401).json({ error: "Nieprawidłowy login lub hasło" });
    }

    req.session.user = username;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Błąd sesji" });
      res.json({ ok: true, user: username });
    });
  });

  app.get("/login.html", (req, res) => {
    if (isLoggedIn(req)) return res.redirect("/");
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
    res.json({ user: req.session.user });
  });

  app.get("/api/state", async (req, res) => {
    try {
      res.json(await loadStateCached());
    } catch (e) {
      console.error("Błąd odczytu:", e.message);
      res.status(500).json({ error: "Nie udało się wczytać danych" });
    }
  });

  app.put("/api/state", (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || !Array.isArray(body.employees)) {
      return res.status(400).json({ error: "Nieprawidłowy format danych" });
    }
    // Zapis do pamięci — do gista trafi zbiorczo (interwał), co chroni
    // konto GitHub przed limitem częstych zapisów.
    cachedState = body;
    dirty = true;
    res.json({ ok: true });
  });

  app.use(express.static(ROOT));

  app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "index.html"));
  });
}

async function bootstrap() {
  let password = ENV_AUTH_PASSWORD;

  try {
    const authCfg = await readAuthConfig();
    if (authCfg?.user) authUser = String(authCfg.user).trim();
    if (authCfg?.password) password = String(authCfg.password);
    if (authCfg?.password || authCfg?.user) {
      console.log("Logowanie z konfiguracji gist (auth.json)");
    }
  } catch (e) {
    console.warn("Nie udało się wczytać auth.json:", e.message);
  }

  if (IS_PROD && (!password || password.length < 4)) {
    console.error("Ustaw hasło w auth.json (gist) lub AUTH_PASSWORD (min. 4 znaki).");
    process.exit(1);
  }

  passwordHash = password
    ? bcrypt.hashSync(password, 12)
    : bcrypt.hashSync("admin", 12);

  if (!password && !IS_PROD) {
    console.warn("⚠  Brak AUTH_PASSWORD — logowanie: admin / admin (tylko do testów lokalnych!)");
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

  app.listen(PORT, () => {
    ensureDataDir();
    console.log(`Kalendarz urlopowy: port ${PORT} | storage: ${storageMode()}`);
    if (!IS_PROD) console.log(`Login: ${authUser} / ${password || "admin"}`);
  });
}

bootstrap().catch((e) => {
  console.error("Błąd startu serwera:", e);
  process.exit(1);
});
