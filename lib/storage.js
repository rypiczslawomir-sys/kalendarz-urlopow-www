// Kalendarz urlopowy — © 2026 Sławomir Rypicz. Wszelkie prawa zastrzeżone.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
// W wersji desktopowej (Electron) DATA_DIR wskazuje na folder w AppData —
// folder instalacji w Program Files jest tylko do odczytu.
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

const GIST_ID = process.env.GITHUB_GIST_ID || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const USE_GIST = Boolean(GIST_ID && GITHUB_TOKEN);

function defaultState() {
  return {
    version: 10,
    year: new Date().getFullYear(),
    activeCode: "U",
    activeHours: 8,
    employees: [],
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStateFromFile() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return defaultState();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {
    console.error("Błąd odczytu pliku danych:", e.message);
  }
  return defaultState();
}

function readAuthConfigFromFile() {
  const authFile = path.join(DATA_DIR, "auth.json");
  if (!fs.existsSync(authFile)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(authFile, "utf8"));
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {
    console.error("Błąd odczytu auth.json:", e.message);
  }
  return null;
}

function readJsonFromDataDir(name, fallback) {
  ensureDataDir();
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {
    console.error(`Błąd odczytu ${name}:`, e.message);
  }
  return fallback;
}

function writeJsonToDataDir(name, obj) {
  ensureDataDir();
  const file = path.join(DATA_DIR, name);
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function writeStateToFile(data) {
  ensureDataDir();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function githubHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: githubHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Gist read HTTP ${res.status}`);
  return res.json();
}

function parseGistJsonFile(gist, fileName, fallback) {
  const file = gist?.files?.[fileName];
  if (!file?.content) return fallback;
  try {
    const parsed = JSON.parse(file.content);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {
    console.error(`Błąd parsowania ${fileName} w gist:`, e.message);
  }
  return fallback;
}

async function readStateFromGist() {
  const gist = await fetchGist();
  if (!gist) return defaultState();
  return parseGistJsonFile(gist, "state.json", defaultState());
}

async function readAuthConfigFromGist() {
  const gist = await fetchGist();
  if (!gist) return null;
  return parseGistJsonFile(gist, "auth.json", null);
}

async function writeStateToGist(data) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: githubHeaders(),
    body: JSON.stringify({
      files: {
        "state.json": { content: JSON.stringify(data, null, 2) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gist write HTTP ${res.status}`);
}

// ── wielu użytkowników: dowolny plik JSON w magazynie ──────────────────
// Nazwy plików: users.json, state-<userId>.json, backup-<userId>-<dzień>.json

async function readJsonFileByName(name, fallback) {
  if (USE_GIST) {
    const gist = await fetchGist();
    if (!gist) return fallback;
    return parseGistJsonFile(gist, name, fallback);
  }
  return readJsonFromDataDir(name, fallback);
}

// Zapis wielu plików naraz: w trybie gist to JEDEN request PATCH (ważne dla
// limitów API GitHuba — stan + kopia zapasowa idą w tym samym zapisie).
// Wartość null usuwa plik.
async function writeJsonFiles(filesMap) {
  if (USE_GIST) {
    const files = {};
    for (const [name, obj] of Object.entries(filesMap)) {
      files[name] = obj === null ? null : { content: JSON.stringify(obj, null, 2) };
    }
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: githubHeaders(),
      body: JSON.stringify({ files }),
    });
    if (!res.ok) throw new Error(`Gist write HTTP ${res.status}`);
    return;
  }
  for (const [name, obj] of Object.entries(filesMap)) {
    if (obj === null) {
      const file = path.join(DATA_DIR, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      writeJsonToDataDir(name, obj);
    }
  }
}

async function readUsers() {
  return readJsonFileByName("users.json", null);
}

async function writeUsers(data) {
  return writeJsonFiles({ "users.json": data });
}

async function listBackupsFor(userKey) {
  const prefix = `backup-${userKey}-`;
  const out = [];
  if (USE_GIST) {
    const gist = await fetchGist();
    if (!gist) return out;
    for (const [name, f] of Object.entries(gist.files || {})) {
      if (!name.startsWith(prefix) || !name.endsWith(".json")) continue;
      let savedAt = null;
      try { savedAt = JSON.parse(f.content).savedAt || null; } catch (e) { /* pomiń metadane */ }
      out.push({ name, savedAt });
    }
    return out;
  }
  ensureDataDir();
  for (const name of fs.readdirSync(DATA_DIR)) {
    if (!name.startsWith(prefix) || !name.endsWith(".json")) continue;
    let savedAt = null;
    try {
      savedAt = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")).savedAt || null;
    } catch (e) { /* pomiń metadane */ }
    out.push({ name, savedAt });
  }
  return out;
}

async function readState() {
  if (USE_GIST) return readStateFromGist();
  return readStateFromFile();
}

async function readAuthConfig() {
  if (USE_GIST) return readAuthConfigFromGist();
  return readAuthConfigFromFile();
}

async function writeState(data) {
  if (USE_GIST) return writeStateToGist(data);
  writeStateToFile(data);
}

function storageMode() {
  return USE_GIST ? "gist" : "file";
}

module.exports = {
  defaultState,
  ensureDataDir,
  readState,
  readAuthConfig,
  writeState,
  storageMode,
  USE_GIST,
  readJsonFileByName,
  writeJsonFiles,
  readUsers,
  writeUsers,
  listBackupsFor,
};
