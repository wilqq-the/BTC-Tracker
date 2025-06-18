const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');

// Initialize logging variables
let logFile;
let logStream;

// Create a basic console wrapper for early logging
function setupLogging() {
  try {
    // Set up logging to file after app is ready
    logFile = path.join(app.getPath('userData'), 'btc-tracker.log');
    logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // Redirect console to file
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = function(...args) {
      const message = `[${new Date().toISOString()}] [INFO] ${args.join(' ')}`;
      if (logStream) logStream.write(message + '\n');
      originalConsoleLog.apply(console, args);
    };

    console.error = function(...args) {
      const message = `[${new Date().toISOString()}] [ERROR] ${args.join(' ')}`;
      if (logStream) logStream.write(message + '\n');
      originalConsoleError.apply(console, args);
    };

    console.warn = function(...args) {
      const message = `[${new Date().toISOString()}] [WARN] ${args.join(' ')}`;
      if (logStream) logStream.write(message + '\n');
      originalConsoleWarn.apply(console, args);
    };

    // Log startup information
    console.log('BTC Tracker starting up');
    console.log(`App version: ${app.getVersion()}`);
    console.log(`Electron version: ${process.versions.electron}`);
    console.log(`Chrome version: ${process.versions.chrome}`);
    console.log(`Node version: ${process.versions.node}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Log file: ${logFile}`);
    
    // Log important path information for debugging
    console.log('Important path information:');
    console.log(`App Path (installation dir): ${app.getAppPath()}`);
    console.log(`User Data Path (settings/data dir): ${app.getPath('userData')}`);
    console.log(`App Data Path: ${app.getPath('appData')}`);
    console.log(`Current Working Directory: ${process.cwd()}`);
    
    // These logs help clarify the "Local" vs "Roaming" situation
    console.log(`AppData\\Local typically contains: ${path.join(app.getPath('appData'), '..', 'Local')}`);
    console.log(`AppData\\Roaming typically contains: ${app.getPath('appData')}`);
  } catch (err) {
    console.error('Failed to set up logging:', err);
  }
}

// Set environment for PathManager
process.env.USE_WINDOWS_PATH = 'true';

// Max number of times to automatically restart the server
const MAX_RESTARTS = 3;

// Check for headless mode flag
const isHeadless = process.argv.includes('--headless');

let mainWindow;
let tray;
const PORT = process.env.PORT || 3000;

function createWindow() {
  // Skip creating window in headless mode
  if (isHeadless) return;
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js')
    },
    icon: path.join(__dirname, 'public', 'images', 'icon-512x512.png')
  });

  // Load the express server URL
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'public', 'images', 'icon-192x192.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    ...(isHeadless ? [] : [{ 
      label: 'Open BTC Tracker', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    }]),
    { 
      label: 'Server Status: Running',
      enabled: false
    },
    {
      label: `Listening on: http://localhost:${PORT}`,
      click: () => {
        // Open default browser if in headless mode
        if (isHeadless) {
          require('electron').shell.openExternal(`http://localhost:${PORT}`);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'View Logs',
      click: () => {
        // Open the log file if it exists
        if (logFile && fs.existsSync(logFile)) {
          require('electron').shell.openPath(logFile);
        } else {
          const { dialog } = require('electron');
          dialog.showMessageBox({
            type: 'info',
            title: 'Logs',
            message: 'Log file not found',
            detail: 'The log file has not been created yet.',
            buttons: ['OK']
          });
        }
      }
    },
    {
      label: 'Debug Info',
      click: () => {
        // Collect debug information
        const debugInfo = {
          app: {
            version: app.getVersion(),
            name: app.getName(),
            path: app.getAppPath(),
            userDataPath: app.getPath('userData'),
            isPackaged: app.isPackaged
          },
          system: {
            platform: process.platform,
            arch: process.arch,
            versions: process.versions
          },
          server: {
            port: PORT,
            status: 'running in main process'
          },
          paths: {
            logFile: logFile,
            serverPath: path.join(__dirname, 'server.js'),
            dataDir: path.join(app.getPath('userData'), 'data'),
            modulesDir: path.join(app.getAppPath(), 'node_modules')
          }
        };

        // Display debug info
        const { dialog } = require('electron');
        dialog.showMessageBox({
          type: 'info',
          title: 'Debug Information',
          message: 'BTC Tracker Debug Info',
          detail: JSON.stringify(debugInfo, null, 2),
          buttons: ['Copy to Clipboard', 'OK'],
          defaultId: 1
        }).then(result => {
          if (result.response === 0) {
            require('electron').clipboard.writeText(JSON.stringify(debugInfo, null, 2));
          }
        });
      }
    },

    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip(isHeadless ? 'BTC Tracker Server' : 'BTC Tracker');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (!isHeadless && mainWindow) {
      mainWindow.show();
    } else if (isHeadless) {
      tray.popUpContextMenu();
    }
  });
}

// Simplified server environment setup - just ensure data directory exists
async function setupServerEnvironment() {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');

  // Create data directory for user data (settings, transactions, etc.)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory: ${dataDir}`);
  }

  return { userDataPath, dataDir };
}

async function startExpressServer() {
  try {
    console.log('Starting Express server...');
    
    let serverPath;
    
    if (app.isPackaged) {
      console.log('Running in packaged mode');
      console.log(`App path: ${app.getAppPath()}`);
      console.log(`Resources path: ${process.resourcesPath}`);
      console.log(`__dirname: ${__dirname}`);
      
      // In packaged mode, the server.js is likely in the ASAR archive
      // According to Electron docs, we should use require() for files in ASAR
      const possiblePaths = [
        path.join(__dirname, 'server.js'),
        path.join(__dirname, '..', 'server.js'),
        './server.js',
        '../server.js'
      ];
      
      console.log('Checking possible server.js locations:');
      for (const possiblePath of possiblePaths) {
        console.log(`  Checking: ${possiblePath}`);
        try {
          // Try to resolve the module path
          const resolvedPath = require.resolve(possiblePath);
          console.log(`  ✓ Found server.js at: ${resolvedPath}`);
          serverPath = resolvedPath;
          break;
            } catch (err) {
          console.log(`  ✗ Not found: ${err.message}`);
        }
      }
      
      if (!serverPath) {
        // Fallback: try to find server.js in the ASAR archive
        const asarServerPath = path.join(process.resourcesPath, 'app.asar', 'src', 'server.js');
        console.log(`Trying ASAR path: ${asarServerPath}`);
        if (fs.existsSync(asarServerPath)) {
          serverPath = asarServerPath;
          console.log(`✓ Found server.js in ASAR: ${serverPath}`);
        }
      }
      
      if (!serverPath) {
        throw new Error(`Server file not found in packaged app. Checked multiple locations.`);
      }
          } else {
      // Development mode
      serverPath = path.join(__dirname, 'server.js');
    }

    console.log(`Using server path: ${serverPath}`);
    
    // Set up environment variables for the server
    process.env.PORT = PORT.toString();
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    process.env.IS_ELECTRON = 'true';
    process.env.ELECTRON_IS_PACKAGED = app.isPackaged ? 'true' : 'false';
    process.env.ELECTRON_USER_DATA_PATH = app.getPath('userData');

    // Instead of spawning a separate process, require and run the server directly
    // This works better with ASAR archives according to Electron documentation
    console.log('Loading server module...');
    
    // Clear the require cache to ensure fresh load
    delete require.cache[require.resolve(serverPath)];
    
    // Require the server - this will start it automatically
    require(serverPath);
    
    console.log('Server module loaded and started');

    // Wait a moment for the server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`Express server should be running on http://localhost:${PORT}`);
    
  } catch (error) {
    console.error('Error starting Express server:', error);
    
    // Show error dialog to user
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start BTC Tracker: ${error.message}`
    );
    
    throw error;
  }
}

app.whenReady().then(() => {
  // Set up logging
  setupLogging();
  
  // Set up AppData directory if on Windows
  if (process.platform === 'win32') {
    process.env.USE_WINDOWS_PATH = 'true';
  }
  
  // Start the Express server
  startExpressServer();
  
  // Wait a short time for the Express server to start
  setTimeout(() => {
    // Create window only if not in headless mode
    if (!isHeadless) {
      createWindow();
    }
    createTray();
  }, 2000);
  
  app.on('activate', () => {
    if (!isHeadless && BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Set up IPC handlers
  ipcMain.on('minimize-to-tray', () => {
    if (!isHeadless && mainWindow) {
      mainWindow.hide();
    }
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  // Don't quit on all windows closed when in headless mode
  if (process.platform !== 'darwin' && !isHeadless) {
    app.quit();
  }
}); 