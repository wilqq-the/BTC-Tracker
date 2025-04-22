const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');

// Set environment for PathManager
process.env.USE_WINDOWS_PATH = 'true';

// Check for headless mode flag
const isHeadless = process.argv.includes('--headless');

let mainWindow;
let tray;
let expressServer;
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
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        
        if (expressServer) {
          expressServer.kill();
        }
        
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

function startExpressServer() {
  try {
    // Start the Express server as a child process
    const serverPath = path.join(__dirname, 'server.js');
    
    // Get the app's user data path
    const userDataPath = app.getPath('userData');
    console.log(`Electron userDataPath: ${userDataPath}`);
    
    // Set up environment variables for the child process
    const env = Object.assign({}, process.env, { 
      USE_WINDOWS_PATH: 'true',
      ELECTRON_APP_PATH: app.getAppPath(),
      ELECTRON_USER_DATA_PATH: userDataPath,
      IS_ELECTRON: 'true',
      ELECTRON_IS_PACKAGED: app.isPackaged ? 'true' : 'false'
    });
    
    // Log electron environment for debugging
    console.log(`Starting Express server with environment:
      - App path: ${app.getAppPath()}
      - User data path: ${userDataPath}
      - Is packaged: ${app.isPackaged}
      - Platform: ${process.platform}
    `);
    
    expressServer = spawn('node', [serverPath], { 
      env,
      stdio: 'inherit' 
    });
    
    expressServer.on('error', (err) => {
      console.error('Failed to start Express server:', err);
    });
    
    expressServer.on('exit', (code) => {
      console.log(`Express server exited with code ${code}`);
      if (code !== 0 && !app.isQuitting) {
        console.log('Attempting to restart Express server...');
        setTimeout(() => {
          startExpressServer();
        }, 2000); // Wait a bit before restarting
      }
    });
    
    // Log server status
    console.log(`BTC Tracker server running on http://localhost:${PORT}`);
    if (isHeadless) {
      console.log('Running in headless mode - no UI window will be shown');
      console.log('Access the application via web browser or use the tray icon');
    }
  } catch (error) {
    console.error('Error starting Express server:', error);
  }
}

app.whenReady().then(() => {
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

process.on('exit', () => {
  if (expressServer) {
    expressServer.kill();
  }
}); 