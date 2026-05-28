const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

const GIST_ID = process.env.GITHUB_GIST_ID || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const USE_GIST = Boolean(GIST_ID && GITHUB_TOKEN);

function defaultState() {
  return {
    version: 5,
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

async function readStateFromGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: githubHeaders(),
  });
  if (res.status === 404) return defaultState();
  if (!res.ok) throw new Error(`Gist read HTTP ${res.status}`);
  const gist = await res.json();
  const file = gist.files?.["state.json"];
  if (!file?.content) return defaultState();
  try {
    const parsed = JSON.parse(file.content);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {
    console.error("Błąd parsowania gist:", e.message);
  }
  return defaultState();
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
  writeState,
  storageMode,
  USE_GIST,
};
