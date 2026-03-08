const { app, BrowserWindow, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

// Keep references to prevent garbage collection
let mainWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;

const PORT = 3456;
const SERVER_URL = `http://localhost:${PORT}`;

// Single instance lock - prevent multiple instances
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

// ─── Paths ──────────────────────────────────────────────────────────────────

function getServerDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'nextjs-standalone');
  }
  // Dev mode: use the .next/standalone output
  return path.join(__dirname, '..', '.next', 'standalone');
}

function getDataDir() {
  return path.join(app.getPath('userData'), 'data');
}

// ─── Server Management ─────────────────────────────────────────────────────

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
    console.log(`Port ${PORT} is already in use, attempting to connect...`);
    try {
      await waitForServer(SERVER_URL, 5000);
      console.log('Existing server found, using it');
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

  // Ensure data directory exists
  const fs = require('fs');
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'btctracker.db');

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: `file:${dbPath}`,
    NEXTAUTH_URL: SERVER_URL,
    NEXTAUTH_SECRET: getOrCreateSecret(dataDir),
  };

  console.log('Starting Next.js server from:', serverDir);
  console.log('Database at:', dbPath);

  // Run migrations first
  try {
    const migrateScript = path.join(serverDir, 'scripts', 'migrate.js');
    if (fs.existsSync(migrateScript)) {
      console.log('Running database migrations...');
      const { execSync } = require('child_process');
      execSync(`node "${migrateScript}"`, {
        cwd: serverDir,
        env,
        stdio: 'pipe',
        timeout: 30000,
      });
      console.log('Migrations complete');
    }
  } catch (err) {
    console.error('Migration error (continuing anyway):', err.message);
  }

  // Start the Next.js standalone server
  const serverScript = path.join(serverDir, 'server.js');
  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: serverDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
    serverProcess = null;
    if (!isQuitting) {
      dialog.showErrorBox('BTC Tracker', 'The server has stopped unexpectedly. The application will close.');
      app.quit();
    }
  });

  // Wait for server to be ready
  await waitForServer(SERVER_URL);
  console.log('Server is ready');
}

function getOrCreateSecret(dataDir) {
  const fs = require('fs');
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
    console.log('Stopping server...');
    serverProcess.kill('SIGTERM');
    // Force kill after 5 seconds
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
      }
    }, 5000);
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
    icon: path.join(__dirname, 'icon.png'),
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

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
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
  try {
    tray = new Tray(iconPath);
  } catch {
    // Tray icon may not exist in dev; skip
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
  try {
    await startServer();
  } catch (err) {
    dialog.showErrorBox('BTC Tracker - Startup Error', err.message);
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
  // On macOS, keep running in tray
  if (process.platform !== 'darwin') {
    // Don't quit - keep running in tray
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
