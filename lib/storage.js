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
    version: 8,
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
};
