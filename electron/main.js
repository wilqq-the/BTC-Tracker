const { app, BrowserWindow, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const net = require('net');

let mainWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;
let logStream = null;

const PORT = 3456;
const SERVER_URL = `http://localhost:${PORT}`;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'BTC Tracker',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
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
    tray = new Tray(iconPath);
  } catch {
    return;
  }

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
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('BTC Tracker');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  initLogging();
  log(`BTC Tracker starting (v${app.getVersion()})`);
  log(`Platform: ${process.platform} ${process.arch}`);
  log(`Packaged: ${app.isPackaged}`);
  log(`User data: ${app.getPath('userData')}`);

  try {
    await startServer();
  } catch (err) {
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
