require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const { ensureDataDir, readState, writeState, storageMode } = require("./lib/storage");

const PORT = parseInt(process.env.PORT, 10) || 5175;
const ROOT = __dirname;

const AUTH_USER = (process.env.AUTH_USER || "admin").trim();
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me-in-production";
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD && (!AUTH_PASSWORD || AUTH_PASSWORD.length < 8)) {
  console.error("Ustaw AUTH_PASSWORD (min. 8 znaków) przed uruchomieniem w produkcji.");
  process.exit(1);
}

if (IS_PROD && SESSION_SECRET === "dev-only-change-me-in-production") {
  console.error("Ustaw SESSION_SECRET przed uruchomieniem w produkcji.");
  process.exit(1);
}

if (IS_PROD && storageMode() !== "gist") {
  console.error("Ustaw GITHUB_GIST_ID i GITHUB_TOKEN — dane na Render muszą być w GitHub Gist.");
  process.exit(1);
}

const passwordHash = AUTH_PASSWORD
  ? bcrypt.hashSync(AUTH_PASSWORD, 12)
  : bcrypt.hashSync("admin", 12);

if (!AUTH_PASSWORD) {
  console.warn("⚠  Brak AUTH_PASSWORD — logowanie: admin / admin (tylko do testów lokalnych!)");
}

const app = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "10mb" }));
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

app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (username !== AUTH_USER || !bcrypt.compareSync(password, passwordHash)) {
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
    res.json(await readState());
  } catch (e) {
    console.error("Błąd odczytu:", e.message);
    res.status(500).json({ error: "Nie udało się wczytać danych" });
  }
});

app.put("/api/state", async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || !Array.isArray(body.employees)) {
    return res.status(400).json({ error: "Nieprawidłowy format danych" });
  }
  try {
    await writeState(body);
    res.json({ ok: true });
  } catch (e) {
    console.error("Błąd zapisu:", e.message);
    res.status(500).json({ error: "Nie udało się zapisać danych" });
  }
});

app.use(express.static(ROOT));

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, () => {
  ensureDataDir();
  console.log(`Kalendarz urlopowy: port ${PORT} | storage: ${storageMode()}`);
  if (!IS_PROD) console.log(`Login: ${AUTH_USER} / ${AUTH_PASSWORD || "admin"}`);
});
