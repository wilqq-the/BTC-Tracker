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
      label: 'Restart Server',
      click: () => {
        console.log('Manually restarting server...');
        if (expressServer) {
          // Set a flag to indicate this is a manual restart
          app.manualRestart = true;
          
          // Kill the current server process
          expressServer.kill();
          
          // Start a new server
          setTimeout(() => {
            app.manualRestart = false;
            startExpressServer();
          }, 1000);
        } else {
          startExpressServer();
        }
      }
    },
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
            status: expressServer ? 'running' : 'not running'
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
      label: 'Reset Extracted Files',
      click: () => {
        const { dialog } = require('electron');
        dialog.showMessageBox({
          type: 'warning',
          title: 'Reset Extracted Files',
          message: 'Are you sure you want to reset all extracted files?',
          detail: 'This will delete and recreate all extracted server files. It may help resolve module loading issues.',
          buttons: ['Yes', 'Cancel'],
          defaultId: 1
        }).then(result => {
          if (result.response === 0) {
            try {
              // Stop the server if it's running
              if (expressServer) {
                app.manualRestart = true;
                expressServer.kill();
                // Give it a little time to shut down
                console.log('Stopping server before resetting files...');
                setTimeout(() => {
                  resetExtractedFiles();
                }, 1000);
              } else {
                resetExtractedFiles();
              }
            } catch (err) {
              console.error('Error in reset process:', err);
              dialog.showErrorBox('Error', `Failed to initiate reset: ${err.message}`);
            }
          }
        });
      }
    },
    {
      label: 'Manual Cleanup Instructions',
      click: () => {
        const { dialog, shell } = require('electron');
        const extractDir = path.join(app.getPath('userData'), 'extracted');
        const userDataDir = app.getPath('userData');
        
        dialog.showMessageBox({
          type: 'info',
          title: 'Manual Cleanup Instructions',
          message: 'How to manually reset the application files',
          detail: 'If the automatic reset is not working, follow these steps:\n\n' +
                  '1. Close the application completely (select "Quit" from the tray menu)\n' +
                  '2. Open File Explorer and navigate to this folder:\n' +
                  userDataDir + '\n\n' +
                  '3. Delete the "extracted" folder\n' +
                  '4. Restart the application\n\n' +
                  'Click "Open Folder" to open the directory in File Explorer.',
          buttons: ['Open Folder', 'Copy Path', 'Cancel'],
          defaultId: 0
        }).then(result => {
          if (result.response === 0) {
            // Open the folder in File Explorer
            shell.openPath(userDataDir);
          } else if (result.response === 1) {
            // Copy the path to clipboard
            require('electron').clipboard.writeText(userDataDir);
            dialog.showMessageBox({
              type: 'info',
              title: 'Path Copied',
              message: 'The path has been copied to your clipboard',
              buttons: ['OK']
            });
          }
        });
      }
    },
    {
      label: 'Run NPM Install',
      click: () => {
        try {
          const extractDir = path.join(app.getPath('userData'), 'extracted');
          if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir, { recursive: true });
          }
          
          // Create package.json with the needed dependencies
          const packageJson = {
            "name": "btc-tracker-server",
            "version": app.getVersion(),
            "description": "Extracted server for BTC Tracker",
            "dependencies": {
              "express": "^4.18.2",
              "cors": "^2.8.5",
              "body-parser": "^1.20.2",
              "axios": "^1.6.7",
              "express-fileupload": "^1.5.1",
              "express-session": "^1.18.1",
              "passport": "^0.7.0",
              "passport-local": "^1.0.0",
              "bcryptjs": "^3.0.2",
              "connect-flash": "^0.1.1",
              "uuid": "^9.0.1",
              "multer": "^1.4.5-lts.2",
              "csv-parse": "^5.5.3",
              "jsonwebtoken": "^9.0.2"
            }
          };
          
          fs.writeFileSync(path.join(extractDir, 'package.json'), JSON.stringify(packageJson, null, 2));
          
          // Show dialog
          const { dialog } = require('electron');
          dialog.showMessageBox({
            type: 'info',
            title: 'Run NPM Install',
            message: 'Installing Node.js dependencies',
            detail: 'This will install all required Node.js modules in the extracted directory. This may take a minute.',
            buttons: ['OK']
          });
          
          // Create npm-install.bat 
          const npmInstallScript = `@echo off
cd /d "${extractDir.replace(/\\/g, '\\\\')}"
echo Installing dependencies in %CD%
npm install --no-fund --no-audit --loglevel=error
echo Installation complete
pause
exit`;
          
          const batchFilePath = path.join(extractDir, 'npm-install.bat');
          fs.writeFileSync(batchFilePath, npmInstallScript);
          
          // Run the install script and show output
          const { spawn } = require('child_process');
          const npmInstall = spawn('cmd.exe', ['/c', batchFilePath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
          });
          
          npmInstall.unref();
          
        } catch (err) {
          console.error('Error running npm install:', err);
          const { dialog } = require('electron');
          dialog.showErrorBox('Error', `Failed to run npm install: ${err.message}`);
        }
      }
    },
    {
      label: 'Smart Scan for Modules',
      click: () => {
        try {
          const { dialog } = require('electron');
          const userDataPath = app.getPath('userData');
          const extractDir = path.join(userDataPath, 'extracted');
          
          dialog.showMessageBox({
            type: 'info',
            title: 'Smart Scan',
            message: 'Scanning for required modules...',
            detail: 'This will scan server.js for import references and ensure all modules are extracted.',
            buttons: ['OK']
          }).then(() => {
            scanServerForRequiredModules(extractDir)
              .then(result => {
                dialog.showMessageBox({
                  type: 'info',
                  title: 'Scan Complete',
                  message: 'Module extraction completed',
                  detail: `Found and processed ${result.totalModules} module references.\n${result.missingModules} modules were missing and have been extracted.\n\nYou should restart the server for changes to take effect.`,
                  buttons: ['Restart Server', 'Later'],
                  defaultId: 0
                }).then(response => {
                  if (response.response === 0) {
                    // Restart the server
                    if (expressServer) {
                      app.manualRestart = true;
                      expressServer.kill();
                      setTimeout(() => {
                        app.manualRestart = false;
                        app.serverRestartCount = 0;
                        startExpressServer();
                      }, 1000);
                    } else {
                      startExpressServer();
                    }
                  }
                });
              })
              .catch(err => {
                dialog.showErrorBox('Error', `Failed to scan modules: ${err.message}`);
              });
          });
        } catch (err) {
          console.error('Error in Smart Scan:', err);
          const { dialog } = require('electron');
          dialog.showErrorBox('Error', `Smart Scan failed: ${err.message}`);
        }
      }
    },
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

async function setupServerEnvironment() {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  const extractDir = path.join(userDataPath, 'extracted');

  // Create data directory
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory: ${dataDir}`);
  }

  // Create extraction directory
  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir, { recursive: true });
    console.log(`Created extraction directory: ${extractDir}`);
  }

  return { userDataPath, dataDir, extractDir };
}

async function extractServerFiles(srcDir, destDir) {
  console.log(`Extracting server files from ${srcDir} to ${destDir}`);

  // Function to recursively copy directory
  function copyDir(src, dest) {
    // Create destination directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Read directory contents
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and certain directories
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        // Recursively copy directory
        copyDir(srcPath, destPath);
      } else {
        // Copy file
        try {
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied ${srcPath} to ${destPath}`);
        } catch (err) {
          console.error(`Error copying ${srcPath}:`, err);
        }
      }
    }
  }

  try {
    // First, ensure the destination directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy the entire src directory structure
    copyDir(srcDir, destDir);

    // Create any missing critical directories
    const criticalDirs = [
      'server',
      'server/exchanges',
      'server/models',
      'server/services',
      'server/utils',
      'routes',
      'public',
      'public/js',
      'public/css',
      'public/images'
    ];

    for (const dir of criticalDirs) {
      const dirPath = path.join(destDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created missing directory: ${dirPath}`);
      }
    }

    // Create stubs for critical files if they're missing
    const criticalFiles = [
      {
        path: 'server/priceCache.js',
        content: `
// Auto-generated stub for priceCache.js
class PriceCache {
  constructor() {
    this.cache = new Map();
  }

  async getCurrentPrice(currency = 'USD') {
    return { price: 0, lastUpdated: new Date().toISOString() };
  }

  async updatePrice(currency = 'USD') {
    return { price: 0, lastUpdated: new Date().toISOString() };
  }
}

module.exports = new PriceCache();`
      },
      {
        path: 'server/summaryCache.js',
        content: `
// Auto-generated stub for summaryCache.js
class SummaryCache {
  constructor() {
    this.cache = null;
    this.lastUpdate = null;
  }

  async getSummary() {
    return {
      totalBTC: 0,
      totalValue: 0,
      profitLoss: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new SummaryCache();`
      }
    ];

    // Create exchange adapters
    const exchangeAdapters = ['kraken', 'strike', 'binance', 'coinbase'];
    for (const adapter of exchangeAdapters) {
      criticalFiles.push({
        path: `server/exchanges/${adapter}-adapter.js`,
        content: `
class ${adapter.charAt(0).toUpperCase() + adapter.slice(1)}Adapter {
  constructor() {
    this.name = '${adapter.charAt(0).toUpperCase() + adapter.slice(1)}';
    this.connected = false;
  }

  getName() { return this.name; }
  getRequiredCredentials() { return ['apiKey', 'apiSecret']; }
  getStatus() { return this.connected; }
  async connect() { this.connected = true; return true; }
  async testConnection() { return true; }
  async getTransactions() { return []; }
  async getBalances() { return { BTC: 0 }; }
}

module.exports = ${adapter.charAt(0).toUpperCase() + adapter.slice(1)}Adapter;`
      });
    }

    // Create any missing critical files
    for (const file of criticalFiles) {
      const filePath = path.join(destDir, file.path);
      if (!fs.existsSync(filePath)) {
        // Ensure the directory exists
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }
        fs.writeFileSync(filePath, file.content.trim() + '\n');
        console.log(`Created stub file: ${filePath}`);
      }
    }

    // Copy package.json from the app root and modify it for the extracted server
    const mainPackageJson = require(path.join(app.getAppPath(), 'package.json'));
    const serverPackageJson = {
      name: "btc-tracker-server",
      version: mainPackageJson.version,
      description: "Extracted server for BTC Tracker",
      dependencies: mainPackageJson.dependencies
    };

    fs.writeFileSync(
      path.join(destDir, 'package.json'),
      JSON.stringify(serverPackageJson, null, 2) + '\n'
    );

    console.log('Server files extraction completed successfully');
  } catch (err) {
    console.error('Error during file extraction:', err);
    throw err;
  }
}

async function startExpressServer() {
  try {
    const { userDataPath, extractDir } = await setupServerEnvironment();
    
    if (app.isPackaged) {
      await extractServerFiles(__dirname, extractDir);
      console.log('Server files extracted successfully');

      // Check if node_modules exists and package.json has changed
      const nodeModulesPath = path.join(extractDir, 'node_modules');
      const packageJsonPath = path.join(extractDir, 'package.json');
      
      let shouldInstall = false;
      
      if (!fs.existsSync(nodeModulesPath)) {
        console.log('node_modules not found, will install dependencies');
        shouldInstall = true;
      } else if (fs.existsSync(packageJsonPath)) {
        // Check if package.json has been modified since last install
        const packageJsonStat = fs.statSync(packageJsonPath);
        const nodeModulesStat = fs.statSync(nodeModulesPath);
        if (packageJsonStat.mtime > nodeModulesStat.mtime) {
          console.log('package.json is newer than node_modules, will reinstall dependencies');
          shouldInstall = true;
        }
      }

      if (shouldInstall) {
        console.log('Installing npm dependencies...');
        try {
          // Run npm install
          const { execSync } = require('child_process');
          execSync('npm install --no-fund --no-audit --loglevel=error', {
            cwd: extractDir,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          console.log('npm install completed successfully');
        } catch (npmError) {
          console.error('Error during npm install:', npmError.message);
          throw npmError;
        }
      }
    }

    const serverDir = app.isPackaged ? extractDir : __dirname;
    const serverPath = path.join(serverDir, 'server.js');

    if (!fs.existsSync(serverPath)) {
      throw new Error(`Server file not found: ${serverPath}`);
    }

    const env = {
      ...process.env,
      USE_WINDOWS_PATH: 'true',
      ELECTRON_APP_PATH: app.getAppPath(),
      ELECTRON_USER_DATA_PATH: userDataPath,
      IS_ELECTRON: 'true',
      ELECTRON_IS_PACKAGED: String(app.isPackaged),
      HOME: serverDir,
      USERPROFILE: serverDir,
      NODE_PATH: '',
      PWD: serverDir,
      DEBUG: 'btc-tracker:*'
    };

    process.chdir(serverDir);

    expressServer = spawn('node', ['--trace-warnings', serverPath], {
      env,
      cwd: serverDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    expressServer.stdout.on('data', (data) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });

    expressServer.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    expressServer.on('error', (err) => {
      console.error('Failed to start Express server:', err);
    });

    expressServer.on('exit', (code) => {
      console.log(`Express server exited with code ${code}`);
      
      if (code !== 0 && !app.isQuitting && !app.manualRestart) {
        if (!app.serverRestartCount) app.serverRestartCount = 0;
        app.serverRestartCount++;

        if (app.serverRestartCount <= MAX_RESTARTS) {
          console.log(`Restarting server (attempt ${app.serverRestartCount}/${MAX_RESTARTS})...`);
          setTimeout(startExpressServer, 2000 * app.serverRestartCount);
        } else {
          console.error('Server crashed too many times. Not restarting automatically.');
        }
      }
    });

    console.log(`BTC Tracker server running on http://localhost:${PORT}`);
    if (isHeadless) {
      console.log('Running in headless mode - use tray icon or web browser');
    }
  } catch (error) {
    console.error('Error starting Express server:', error);
  }
}

// Smart scanning function to find all required modules in server.js and related files
async function scanServerForRequiredModules(extractDir) {
  console.log('Starting smart scan for required modules...');
  
  // Define result counters
  const result = {
    totalModules: 0,
    missingModules: 0,
    processedFiles: 0
  };
  
  // Make sure the extracted directory exists
  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir, { recursive: true });
  }
  
  // Set of files we've processed to avoid duplicates
  const processedFiles = new Set();
  
  // Queue of files to process
  const filesToProcess = [path.join(extractDir, 'server.js')];
  
  // Check if the starting point exists
  if (!fs.existsSync(filesToProcess[0])) {
    console.log(`Main server.js not found at ${filesToProcess[0]}. Extracting it first...`);
    const serverJsPath = path.join(__dirname, 'server.js');
    if (fs.existsSync(serverJsPath)) {
      const content = fs.readFileSync(serverJsPath, 'utf8');
      fs.writeFileSync(filesToProcess[0], content);
      console.log(`Extracted main server.js to ${filesToProcess[0]}`);
    } else {
      throw new Error('Could not find server.js in the application');
    }
  }
  
  // Regex patterns to detect require statements
  const requirePattern = /require\(['"]([^'"]+)['"]\)/g;
  const importPattern = /import\s+(?:\*\s+as\s+\w+|{\s*[\w\s,]+\s*}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  
  // Process all files in the queue
  while (filesToProcess.length > 0) {
    const currentFile = filesToProcess.shift();
    
    // Skip if we've already processed this file
    if (processedFiles.has(currentFile)) {
      continue;
    }
    
    // Mark as processed
    processedFiles.add(currentFile);
    result.processedFiles++;
    
    // Check if file exists
    if (!fs.existsSync(currentFile)) {
      console.log(`File not found: ${currentFile}`);
      continue;
    }
    
    console.log(`Processing file: ${currentFile}`);
    
    try {
      // Read the file contents
      const content = fs.readFileSync(currentFile, 'utf8');
      
      // Extract all require statements
      let match;
      let modulePaths = [];
      
      // Process require statements
      while ((match = requirePattern.exec(content)) !== null) {
        modulePaths.push(match[1]);
      }
      
      // Process import statements
      while ((match = importPattern.exec(content)) !== null) {
        modulePaths.push(match[1]);
      }
      
      // Process each module path
      for (const modulePath of modulePaths) {
        result.totalModules++;
        
        // Skip node built-ins and node_modules (those are handled by npm install)
        if (modulePath.startsWith('node:') || 
            (!modulePath.startsWith('./') && !modulePath.startsWith('../'))) {
          continue;
        }
        
        // Resolve the full path of the required module
        const currentDir = path.dirname(currentFile);
        let resolvedPath = path.resolve(currentDir, modulePath);
        
        // Handle directory imports (index.js)
        if (!resolvedPath.endsWith('.js') && !resolvedPath.endsWith('.json')) {
          if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
            resolvedPath = path.join(resolvedPath, 'index.js');
          } else {
            resolvedPath += '.js';
          }
        }
        
        // Check if the module exists in extracted directory
        if (!fs.existsSync(resolvedPath)) {
          console.log(`Missing module: ${modulePath} (resolved to ${resolvedPath})`);
          result.missingModules++;
          
          // Try to find the module in the app
          const relativePathFromExtract = path.relative(extractDir, resolvedPath);
          const possibleSources = [
            path.join(__dirname, relativePathFromExtract),
            path.join(app.getAppPath(), relativePathFromExtract)
          ];
          
          let sourceFound = false;
          for (const sourcePath of possibleSources) {
            if (fs.existsSync(sourcePath)) {
              console.log(`Found module at: ${sourcePath}`);
              
              // Create directory structure if needed
              const dirPath = path.dirname(resolvedPath);
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
              }
              
              // Copy the file
              const content = fs.readFileSync(sourcePath, 'utf8');
              fs.writeFileSync(resolvedPath, content);
              console.log(`Extracted module to: ${resolvedPath}`);
              
              // Add to files to process
              filesToProcess.push(resolvedPath);
              sourceFound = true;
              break;
            }
          }
          
          // If module not found, look for it in parent directories with slightly different names
          if (!sourceFound) {
            const moduleBasename = path.basename(modulePath, '.js');
            const moduleDirname = path.dirname(modulePath);
            
            // Try various conventions like module-adapter.js, moduleAdapter.js, etc.
            const variations = [
              `${moduleBasename}-adapter.js`,
              `${moduleBasename}Adapter.js`,
              `${moduleBasename}-service.js`,
              `${moduleBasename}Service.js`,
              `${moduleBasename}.js`
            ];
            
            for (const variant of variations) {
              // First check in the original location
              const originalRelative = path.join(moduleDirname, variant);
              const originalPath = path.resolve(currentDir, originalRelative);
              
              if (fs.existsSync(originalPath)) {
                console.log(`Found module variant at: ${originalPath}`);
                fs.copyFileSync(originalPath, resolvedPath);
                console.log(`Copied to: ${resolvedPath}`);
                filesToProcess.push(resolvedPath);
                sourceFound = true;
                break;
              }
              
              // Then check the app source
              const appSrcPath = path.join(__dirname, originalRelative.startsWith('./') || originalRelative.startsWith('../') 
                ? originalRelative 
                : `./${originalRelative}`);
              
              if (fs.existsSync(appSrcPath)) {
                console.log(`Found module variant in app at: ${appSrcPath}`);
                fs.copyFileSync(appSrcPath, resolvedPath);
                console.log(`Copied to: ${resolvedPath}`);
                filesToProcess.push(resolvedPath);
                sourceFound = true;
                break;
              }
            }
          }
          
          // Last resort, check the entire exchanges directory
          if (!sourceFound && modulePath.includes('exchanges')) {
            const exchangesDir = path.join(__dirname, 'exchanges');
            if (fs.existsSync(exchangesDir)) {
              const moduleBasename = path.basename(modulePath, '.js');
              const destDir = path.join(extractDir, 'exchanges');
              
              if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
              }
              
              console.log(`Scanning exchanges directory: ${exchangesDir}`);
              const exchangeFiles = fs.readdirSync(exchangesDir);
              
              // Look for matching files
              for (const file of exchangeFiles) {
                if (file.includes(moduleBasename) || moduleBasename.includes(file.replace('.js', ''))) {
                  const sourcePath = path.join(exchangesDir, file);
                  const destPath = path.join(destDir, file);
                  
                  console.log(`Found potential match: ${sourcePath}`);
                  fs.copyFileSync(sourcePath, destPath);
                  console.log(`Copied to: ${destPath}`);
                  
                  // Also create the specific file we're looking for
                  fs.copyFileSync(sourcePath, resolvedPath);
                  console.log(`Copied to target location: ${resolvedPath}`);
                  
                  filesToProcess.push(destPath);
                  sourceFound = true;
                }
              }
              
              // If nothing matched, copy all exchange files
              if (!sourceFound) {
                console.log(`No specific match found, copying all exchange files`);
                for (const file of exchangeFiles) {
                  const sourcePath = path.join(exchangesDir, file);
                  const destPath = path.join(destDir, file);
                  
                  if (fs.statSync(sourcePath).isFile()) {
                    fs.copyFileSync(sourcePath, destPath);
                    console.log(`Copied exchange file: ${destPath}`);
                    filesToProcess.push(destPath);
                  }
                }
                
                // Create a stub file for the specific module we were looking for
                const stubContent = `// Auto-generated stub for ${moduleBasename}
module.exports = {
  getExchangeInfo: async function() {
    return {
      name: '${moduleBasename.charAt(0).toUpperCase() + moduleBasename.slice(1)}',
      url: 'https://example.com',
      logoUrl: '/images/exchanges/default.png',
      status: 'online'
    };
  },
  getCurrentPrice: async function(currency = 'USD') {
    // Return a default value
    return { price: 0, lastUpdated: new Date().toISOString() };
  }
};`;
                
                fs.writeFileSync(resolvedPath, stubContent);
                console.log(`Created stub for: ${resolvedPath}`);
              }
            }
          }
        } else {
          // Module exists, add it to the processing queue
          filesToProcess.push(resolvedPath);
        }
      }
    } catch (err) {
      console.error(`Error processing file ${currentFile}:`, err);
    }
  }
  
  console.log(`Smart scan completed. Processed ${result.processedFiles} files, found ${result.totalModules} module references, extracted ${result.missingModules} missing modules.`);
  return result;
}

// New function to handle resetting extracted files
function resetExtractedFiles() {
  try {
    const { dialog } = require('electron');
    const extractDir = path.join(app.getPath('userData'), 'extracted');
    
    // Check if the directory exists
    if (!fs.existsSync(extractDir)) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No Files to Reset',
        message: 'No extracted files were found',
        detail: 'The server will extract files on the next restart.',
        buttons: ['OK']
      });
      return;
    }
    
    // First try to check if any files are locked
    try {
      // Create a test file to see if we have write access
      const testFile = path.join(extractDir, 'reset-test.txt');
      fs.writeFileSync(testFile, 'Testing if directory is locked');
      fs.unlinkSync(testFile);
    } catch (accessErr) {
      console.error('Directory appears to be locked:', accessErr);
      dialog.showMessageBox({
        type: 'error',
        title: 'Directory Locked',
        message: 'Cannot reset files - directory is in use',
        detail: 'Please follow these steps:\n\n' +
                '1. Click "OK" to close this message\n' +
                '2. Right-click the BTC Tracker tray icon and select "Quit"\n' +
                '3. Check Task Manager and end any running "node.exe" processes\n' +
                '4. Restart the application and try again\n\n' +
                'Alternatively, you can manually delete this folder when the app is not running:\n' +
                extractDir,
        buttons: ['OK']
      });
      return;
    }
    
    // If we get here, we can proceed with deletion
    // Simple function to delete directory recursively
    const deleteFolderRecursive = function(pathToDelete) {
      if (fs.existsSync(pathToDelete)) {
        fs.readdirSync(pathToDelete).forEach((file) => {
          const curPath = path.join(pathToDelete, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            // Recursive call
            deleteFolderRecursive(curPath);
          } else {
            // Delete file
            try {
              fs.unlinkSync(curPath);
            } catch (unlinkErr) {
              console.error(`Failed to delete file ${curPath}:`, unlinkErr);
              throw unlinkErr; // Re-throw to stop the process
            }
          }
        });
        fs.rmdirSync(pathToDelete);
      }
    };
    
    try {
      deleteFolderRecursive(extractDir);
      console.log(`Deleted extracted directory: ${extractDir}`);
    } catch (err) {
      console.error('Failed to delete directory:', err);
      dialog.showErrorBox('Error', 
        `Failed to reset files: ${err.message}\n\n` +
        `The directory may be in use. Please close all instances of the application ` +
        `and try again, or manually delete the folder:\n${extractDir}`
      );
      return;
    }
    
    // Show success dialog
    dialog.showMessageBox({
      type: 'info',
      title: 'Files Reset',
      message: 'Extracted files have been reset',
      detail: 'The server will extract files again on the next restart.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then(result => {
      if (result.response === 0) {
        // Restart the server
        app.serverRestartCount = 0;
        setTimeout(() => {
          app.manualRestart = false;
          startExpressServer();
        }, 1000);
      }
    });
  } catch (err) {
    const { dialog } = require('electron');
    console.error('Error resetting extracted files:', err);
    dialog.showErrorBox('Error', `Failed to reset files: ${err.message}`);
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

process.on('exit', () => {
  if (expressServer) {
    expressServer.kill();
  }
}); 