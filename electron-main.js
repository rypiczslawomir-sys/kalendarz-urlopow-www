const { app, BrowserWindow } = require("electron");
const path = require("path");

const PORT = 5199;
let win = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(start).catch((e) => {
    console.error("Błąd startu aplikacji:", e);
    app.quit();
  });
}

async function start() {
  process.env.DESKTOP_MODE = "1";
  process.env.PORT = String(PORT);
  process.env.DATA_DIR = path.join(app.getPath("userData"), "data");
  // Desktop nie używa GitHub Gist — dane w pliku lokalnym w AppData
  delete process.env.GITHUB_GIST_ID;
  delete process.env.GITHUB_TOKEN;

  const { bootstrap } = require("./server.js");
  await bootstrap();

  win = new BrowserWindow({
    width: 1680,
    height: 950,
    minWidth: 1100,
    minHeight: 650,
    title: "Kalendarz urlopowy",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://127.0.0.1:${PORT}/`);
  win.on("closed", () => { win = null; });
}

app.on("window-all-closed", () => app.quit());
