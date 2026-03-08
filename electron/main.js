const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const net = require('net');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;
let logStream = null;
let hasShownTrayNotice = false;

const PORT = 3456;
const SERVER_URL = `http://localhost:${PORT}`;
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ─── Window State ────────────────────────────────────────────────────────────

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { width: 1400, height: 900 };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isMinimized()) return;
  const bounds = mainWindow.getBounds();
  const isMaximized = mainWindow.isMaximized();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...bounds, isMaximized }));
}

// ─── Logging ────────────────────────────────────────────────────────────────

function initLogging() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'app.log');
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  logStream.write(`\n--- ${new Date().toISOString()} ---\n`);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  if (logStream) logStream.write(line + '\n');
}

// ─── Paths ──────────────────────────────────────────────────────────────────

function getServerDir() {
  const appPath = app.getAppPath();
  return path.join(appPath, '.next', 'standalone');
}

function getDataDir() {
  return path.join(app.getPath('userData'), 'data');
}

// ─── Splash Screen ──────────────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 340,
    height: 400,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const version = app.getVersion();
  const html = `<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; align-items: center; justify-content: center;
    height: 100vh; background: transparent;
    -webkit-app-region: drag;
  }
  .card {
    background: #1a1a2e; border-radius: 20px; padding: 40px;
    text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    border: 1px solid rgba(247,147,26,0.2);
  }
  .logo {
    width: 100px; height: 100px; margin: 0 auto 24px;
    background: #F7931A; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 48px; font-weight: bold; color: white;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(247,147,26,0.4); }
    50% { box-shadow: 0 0 0 15px rgba(247,147,26,0); }
  }
  h1 { color: #F7931A; font-size: 22px; margin-bottom: 6px; }
  .version { color: #666; font-size: 13px; margin-bottom: 28px; }
  .status { color: #aaa; font-size: 14px; margin-bottom: 20px; }
  .loader {
    width: 200px; height: 3px; background: #333; border-radius: 3px;
    margin: 0 auto; overflow: hidden;
  }
  .loader-bar {
    width: 40%; height: 100%; background: #F7931A; border-radius: 3px;
    animation: loading 1.5s ease-in-out infinite;
  }
  @keyframes loading {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
</style></head>
<body><div class="card">
  <div class="logo">\u20BF</div>
  <h1>BTC Tracker</h1>
  <div class="version">v${version}</div>
  <div class="status">Starting services...</div>
  <div class="loader"><div class="loader-bar"></div></div>
</div></body>
</html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  splashWindow.center();
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ─── Server Management ─────────────────────────────────────────────────────

function getNodeEnv() {
  return {
    ELECTRON_RUN_AS_NODE: '1',
  };
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Server start timeout'));
      }
      const http = require('http');
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      });
      req.on('error', () => setTimeout(check, 500));
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, 500);
      });
    };
    check();
  });
}

async function startServer() {
  const available = await isPortAvailable(PORT);
  if (!available) {
    log(`Port ${PORT} in use, checking for existing server...`);
    try {
      await waitForServer(SERVER_URL, 5000);
      log('Existing server found');
      return;
    } catch {
      dialog.showErrorBox(
        'BTC Tracker',
        `Port ${PORT} is in use by another application. Please close it and try again.`
      );
      app.quit();
      return;
    }
  }

  const serverDir = getServerDir();
  const dataDir = getDataDir();

  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'btctracker.db');

  const env = {
    ...process.env,
    ...getNodeEnv(),
    NODE_ENV: 'production',
    NODE_PATH: path.join(serverDir, 'node_modules'),
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: `file:${dbPath}`,
    NEXTAUTH_URL: SERVER_URL,
    NEXTAUTH_SECRET: getOrCreateSecret(dataDir),
  };

  log(`Server dir: ${serverDir}`);
  log(`Data dir: ${dataDir}`);
  log(`Database: ${dbPath}`);
  log(`Electron exe: ${process.execPath}`);

  // Apply database schema
  try {
    log('Applying database schema...');
    const schemaPath = app.isPackaged
      ? path.join(process.resourcesPath, 'prisma', 'schema.prisma')
      : path.join(__dirname, '..', 'prisma', 'schema.prisma');

    const prismaModules = app.isPackaged
      ? path.join(process.resourcesPath, 'prisma-cli', 'node_modules')
      : path.join(__dirname, '..', 'node_modules');

    const prismaCli = path.join(prismaModules, 'prisma', 'build', 'index.js');

    const prismaEnv = { ...env };
    prismaEnv.NODE_PATH = prismaModules;

    log(`Schema: ${schemaPath}`);
    log(`Prisma CLI: ${prismaCli}`);
    log(`Prisma modules: ${prismaModules}`);

    execFileSync(process.execPath, [prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate', '--accept-data-loss'], {
      cwd: dataDir,
      env: prismaEnv,
      stdio: 'pipe',
      timeout: 30000,
    });
    log('Database schema applied');
  } catch (err) {
    log(`Schema push error: ${err.message}`);
    if (err.stderr) log(`Schema push stderr: ${err.stderr.toString()}`);
  }

  // Start Next.js standalone server
  const serverScript = path.join(serverDir, 'server.js');
  if (!fs.existsSync(serverScript)) {
    throw new Error(`Server script not found: ${serverScript}`);
  }

  log(`Starting server: ${serverScript}`);
  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: serverDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout.on('data', (data) => {
    log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    log(`[server:err] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code, signal) => {
    log(`Server exited: code=${code} signal=${signal}`);
    serverProcess = null;
    if (!isQuitting) {
      const logPath = path.join(app.getPath('userData'), 'logs', 'app.log');
      dialog.showErrorBox(
        'BTC Tracker',
        `The server has stopped unexpectedly (exit code: ${code}).\n\nCheck logs at:\n${logPath}`
      );
      app.quit();
    }
  });

  await waitForServer(SERVER_URL);
  log('Server is ready');
}

function getOrCreateSecret(dataDir) {
  const secretFile = path.join(dataDir, '.secret');
  try {
    return fs.readFileSync(secretFile, 'utf-8').trim();
  } catch {
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  }
}

function stopServer() {
  if (serverProcess) {
    log('Stopping server...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'], { windowsHide: true });
    } else {
      serverProcess.kill('SIGTERM');
      setTimeout(() => {
        if (serverProcess) serverProcess.kill('SIGKILL');
      }, 5000);
    }
  }
}

// ─── Window ─────────────────────────────────────────────────────────────────

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 800,
    minHeight: 600,
    title: 'BTC Tracker',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  if (state.isMaximized) mainWindow.maximize();

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    closeSplash();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    saveWindowState();
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
      if (!hasShownTrayNotice) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'BTC Tracker',
          content: 'App is still running in the system tray.',
        });
        hasShownTrayNotice = true;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Tray ───────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (!fs.existsSync(iconPath)) return;

  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
  } catch {
    return;
  }

  rebuildTrayMenu();

  tray.setToolTip('BTC Tracker');
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function rebuildTrayMenu() {
  if (!tray) return;

  const autoStartEnabled = app.getLoginItemSettings().openAtLogin;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open BTC Tracker',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Open in Browser',
      click: () => shell.openExternal(SERVER_URL),
    },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoStartEnabled,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        log(`Auto-start ${menuItem.checked ? 'enabled' : 'disabled'}`);
      },
    },
    { type: 'separator' },
    {
      label: 'Open Logs Folder',
      click: () => {
        const logDir = path.join(app.getPath('userData'), 'logs');
        shell.openPath(logDir);
      },
    },
    {
      label: 'About BTC Tracker',
      click: showAbout,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function showAbout() {
  const version = app.getVersion();
  const electronVersion = process.versions.electron;
  const nodeVersion = process.versions.node;
  const dataDir = getDataDir();

  dialog.showMessageBox(mainWindow || undefined, {
    type: 'info',
    title: 'About BTC Tracker',
    message: 'BTC Tracker',
    detail: [
      `Version: ${version}`,
      `Electron: ${electronVersion}`,
      `Node.js: ${nodeVersion}`,
      `Platform: ${process.platform} ${process.arch}`,
      '',
      `Data: ${dataDir}`,
      '',
      '100% Private, Self-Hosted Bitcoin Portfolio Tracker',
    ].join('\n'),
    buttons: ['OK'],
    icon: path.join(__dirname, 'icon.png'),
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  initLogging();
  log(`BTC Tracker starting (v${app.getVersion()})`);
  log(`Platform: ${process.platform} ${process.arch}`);
  log(`Packaged: ${app.isPackaged}`);
  log(`User data: ${app.getPath('userData')}`);

  createSplash();

  try {
    await startServer();
  } catch (err) {
    closeSplash();
    log(`Startup error: ${err.message}`);
    const logPath = path.join(app.getPath('userData'), 'logs', 'app.log');
    dialog.showErrorBox(
      'BTC Tracker - Startup Error',
      `${err.message}\n\nCheck logs at:\n${logPath}`
    );
    app.quit();
    return;
  }

  createWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (mainWindow) saveWindowState();
  stopServer();
});

app.on('window-all-closed', () => {
  if (!tray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
