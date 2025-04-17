const { app, BrowserWindow, Menu, dialog, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
let serverProcess;
const PORT = process.env.PORT || 3000;

// Create preload script path
const preloadScriptPath = path.join(app.getPath('temp'), 'btc-tracker-preload.js');

// Write preload script content
const preloadScript = `
// Preload script to help with cookie handling
window.addEventListener('DOMContentLoaded', () => {
  // Fix all links to exchanges.html to ensure they load with cookies
  document.querySelectorAll('a[href*="exchanges.html"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // Signal to main process to load exchanges with proper session
      window.postMessage({ type: 'load-exchanges' }, '*');
    });
  });
});
`;

fs.writeFileSync(preloadScriptPath, preloadScript);

// Check if user data directory exists and create it if not
function setupDataDirectory() {
  const userDataPath = app.getPath('userData');
  const dataPath = path.join(userDataPath, 'btctracker-data');
  
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  
  // Set environment variable for server to know where to store data
  process.env.BTC_TRACKER_DATA_DIR = dataPath;
  
  return dataPath;
}

function createWindow() {
  // Configure session for persistent cookies
  const ses = session.defaultSession;
  
  // Set up proper cookie handling
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // Force include cookies on all requests
    details.requestHeaders['Cookie'] = details.requestHeaders['Cookie'] || '';
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Set up a flag to identify as Electron environment
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // Add a special header to identify as Electron app
    details.requestHeaders['X-Electron-App'] = '1';
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadScriptPath
    },
    icon: path.join(__dirname, 'public', 'img', 'logo.png')
  });

  // Set up cookie persistence for authentication
  ses.cookies.get({})
    .then((cookies) => {
      console.log('Current cookies:', cookies);
    })
    .catch(err => {
      console.error('Error getting cookies:', err);
    });

  // Start the Express server
  startServer();

  // Load the login page directly instead of auto-login
  setTimeout(() => {
    console.log('Loading login page...');
    mainWindow.loadURL(`http://localhost:${PORT}/login`);
  }, 1500);

  // Handle IPC messages from the renderer process (via postMessage)
  mainWindow.webContents.on('ipc-message', (event, channel, data) => {
    console.log(`Received IPC message: ${channel}`, data);
  });

  // Listen for page messages from the preload script
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('message', event => {
        if (event.data && event.data.type === 'load-exchanges') {
          window.location.href = 'http://localhost:${PORT}/exchanges.html?t=' + new Date().getTime();
        }
      });
    `).catch(err => console.error('Error setting up message listener:', err));
  });

  // Handle page navigation events
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log(`Navigated to: ${url}`);
    
    // If URL contains exchanges.html, ensure it's properly loaded
    if (url.includes('exchanges.html')) {
      console.log('Navigation to exchanges.html detected');
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log(`Will navigate to: ${url}`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load: ${validatedURL}, error: ${errorDescription} (${errorCode})`);
    
    // Handle failed loads more robustly
    if (validatedURL.includes('/exchanges.html')) {
      console.log('Exchanges page failed to load, attempting direct load');
      setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${PORT}/exchanges.html`);
      }, 500);
    }
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exchanges',
          click: () => {
            console.log('Menu: Loading exchanges.html directly');
            mainWindow.loadURL(`http://localhost:${PORT}/exchanges.html`);
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About BTC Tracker',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About BTC Tracker',
              message: 'BTC Tracker',
              detail: 'A simple, powerful application to track your Bitcoin investments and monitor their performance over time.\n\nVersion: ' + app.getVersion()
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startServer() {
  const dataDir = setupDataDirectory();
  console.log(`Using data directory: ${dataDir}`);
  
  // Start the server as a child process
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: PORT.toString(),
      BTC_TRACKER_DATA_DIR: dataDir
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

// When Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Kill the server process when the app is quitting
app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
}); 