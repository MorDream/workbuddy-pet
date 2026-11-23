// Electron main process (CJS, because WorkBuddy sets ELECTRON_RUN_AS_NODE=1
// and electron's ESM named exports are unreliable in that context).
const { app, BrowserWindow, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let win = null;
let tray = null;
let controlPort = 17340;
let HOST = '127.0.0.1';
let RUNTIME_DIR = '';
let ROOT = '';
let startServer = null;
let appendLog = () => {};

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: sw, x: sx, y: sy } = display.workArea;
  const w = 360;
  const h = 380;

  win = new BrowserWindow({
    width: w,
    height: h,
    x: sx + sw - w - 12,
    y: sy + 60,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.loadURL(`http://${HOST}:${controlPort}/`);
  win.on('closed', () => { win = null; });
}

function createTray() {
  const iconPath = path.join(ROOT, 'assets', 'tray.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('WorkBuddy Pet — 实时任务进度桌宠');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: () => { if (win?.isVisible()) win.hide(); else win?.show(); } },
    { label: '回到右上角', click: () => {
      const { width: sw, x: sx, y: sy } = screen.getPrimaryDisplay().workArea;
      win?.setPosition(sx + sw - 380, sy + 60);
    } },
    { type: 'separator' },
    { label: '摸鱼（待机）', click: () => post('/idle') },
    { label: '睡觉', click: () => post('/sleep') },
    { label: '叫醒', click: () => post('/wake') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
}

function post(p) {
  fetch(`http://${HOST}:${controlPort}${p}`, { method: 'POST' }).catch(() => {});
}

async function main() {
  const core = await import('./config.mjs');
  ({ HOST, RUNTIME_DIR, ROOT } = core);
  const srv = await import('./server.mjs');
  ({ startServer, appendLog } = srv);

  const envPort = Number(process.env.WB_PET_PORT);
  controlPort = Number.isFinite(envPort) && envPort > 0 ? envPort : 17340;

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  await startServer({ port: controlPort });
  appendLog(`electron main started, port=${controlPort}`);

  await app.whenReady();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on('window-all-closed', () => {
  // Keep the tray alive on Windows/Linux.
});

main().catch((err) => {
  appendLog(`fatal: ${err.stack || err}`);
  console.error(err);
  app.quit();
});
