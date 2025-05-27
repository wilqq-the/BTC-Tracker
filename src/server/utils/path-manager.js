const path = require('path');
const fs = require('fs');
const os = require('os');

class PathManager {
    constructor() {
        this.dataDir = this.initializeDataDirectory();
        this.paths = {
            // Price related files
            priceCache: path.join(this.dataDir, 'price-cache.json'),
            historicalBtc: path.join(this.dataDir, 'historical_btc.json'),
            
            // User related files
            users: path.join(this.dataDir, 'users.json'),
            appSettings: path.join(this.dataDir, 'app-settings.json'),
            
            // Transaction related files
            transactions: path.join(this.dataDir, 'transactions.json'),
            
            // Exchange related files
            exchangeCredentials: path.join(this.dataDir, 'exchange-credentials.json'),
            
            // Summary cache file
            summaryCache: path.join(this.dataDir, 'summary-cache.json')
        };
        
        // Ensure all directories exist
        this.ensureDirectoryStructure();
    }

    initializeDataDirectory() {
        let baseDir;
        
        // Check if running in Electron
        const isElectron = process.versions && process.versions.electron;
        
        // If running in Electron, get the correct path
        if (isElectron) {
            try {
                // Dynamic import to avoid errors when not in Electron
                const electron = require('electron');
                const app = electron.app || (electron.remote && electron.remote.app);
                
                if (app) {
                    // Use userData for packaged app
                    if (app.isPackaged) {
                        baseDir = path.join(app.getPath('userData'), 'data');
                        console.log(`[PathManager] Using Electron userData path (packaged): ${baseDir}`);
                        return this.ensureDirectoryExists(baseDir);
                    } 
                    // For development use resources path
                    else if (process.env.ELECTRON_RESOURCES_PATH) {
                        baseDir = path.join(this.normalizePath(process.env.ELECTRON_RESOURCES_PATH), 'data');
                        console.log(`[PathManager] Using ELECTRON_RESOURCES_PATH (development): ${baseDir}`);
                        return this.ensureDirectoryExists(baseDir);
                    }
                }
            } catch (error) {
                console.error('[PathManager] Error determining Electron paths:', error);
                // Fall through to other methods if Electron method fails
            }
        }
        
        // Priority 1: Environment variable
        if (process.env.BTC_TRACKER_DATA_DIR) {
            baseDir = this.normalizePath(process.env.BTC_TRACKER_DATA_DIR);
            console.log(`[PathManager] Using BTC_TRACKER_DATA_DIR: ${baseDir}`);
            return this.ensureDirectoryExists(baseDir);
        }
        
        // Priority 2: Windows AppData path when specified
        if (process.env.USE_WINDOWS_PATH === 'true') {
            const appDataPath = process.env.APPDATA || 
                (process.platform === 'darwin' ? 
                    path.join(os.homedir(), 'Library/Application Support') : 
                    path.join(os.homedir(), '.config'));
            
            baseDir = path.join(appDataPath, 'btctracker-data');
            console.log(`[PathManager] Using Windows-style AppData path: ${baseDir}`);
            return this.ensureDirectoryExists(baseDir);
        }
        
        // Priority 3: Docker path
        if (process.env.DOCKER === 'true' && fs.existsSync('/app/src/data')) {
            baseDir = '/app/src/data';
            console.log(`[PathManager] Using Docker path: ${baseDir}`);
            return this.ensureDirectoryExists(baseDir);
        }
        
        // Priority 4: Default development path
        baseDir = path.join(__dirname, '..', '..', 'data');
        console.log(`[PathManager] Using default path: ${baseDir}`);
        
        return this.ensureDirectoryExists(baseDir);
    }

    normalizePath(inputPath) {
        return path.normalize(inputPath.replace(/[\\/]+/g, path.sep));
    }

    ensureDirectoryExists(dirPath) {
        try {
            // Check if path exists first
            if (fs.existsSync(dirPath)) {
                // Check if it's a directory
                const stats = fs.statSync(dirPath);
                if (!stats.isDirectory()) {
                    // It exists but is not a directory, rename it and create directory
                    console.error(`[PathManager] Path exists but is not a directory: ${dirPath}`);
                    const backupPath = `${dirPath}.backup.${Date.now()}`;
                    console.log(`[PathManager] Renaming existing file to: ${backupPath}`);
                    fs.renameSync(dirPath, backupPath);
                    fs.mkdirSync(dirPath, { recursive: true });
                }
            } else {
                // Path doesn't exist, create it
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return dirPath;
        } catch (error) {
            console.error(`[PathManager] Error creating directory ${dirPath}:`, error);
            // Try an alternative path as a fallback
            const fallbackDir = path.join(os.homedir(), 'btctracker-data');
            console.log(`[PathManager] Attempting to use fallback directory: ${fallbackDir}`);
            
            if (!fs.existsSync(fallbackDir)) {
                fs.mkdirSync(fallbackDir, { recursive: true });
            }
            return fallbackDir;
        }
    }

    ensureDirectoryStructure() {
        // Ensure data directory exists
        this.ensureDirectoryExists(this.dataDir);
        
        // Define default content for each file type
        const defaultContent = {
            'exchange-credentials.json': {}, // Empty object for credentials
            'default': [] // Empty array for other files
        };
        
        // Initialize empty JSON files if they don't exist
        Object.entries(this.paths).forEach(([key, filePath]) => {
            try {
                if (!fs.existsSync(filePath)) {
                    // Check if parent directory exists
                    const parentDir = path.dirname(filePath);
                    if (!fs.existsSync(parentDir)) {
                        fs.mkdirSync(parentDir, { recursive: true });
                    }
                    
                    // Use appropriate default content based on file name
                    const content = defaultContent[path.basename(filePath)] || defaultContent.default;
                    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
                    console.log(`[PathManager] Initialized file: ${filePath} with default content`);
                } else {
                    // File exists, check if it's readable and writable
                    fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
                    
                    // If it's the credentials file and it contains an empty array, fix it
                    if (path.basename(filePath) === 'exchange-credentials.json') {
                        const content = fs.readFileSync(filePath, 'utf8');
                        try {
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed) && parsed.length === 0) {
                                // Convert empty array to empty object
                                fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
                                console.log(`[PathManager] Converted empty array to object in credentials file`);
                            }
                        } catch (parseError) {
                            console.error(`[PathManager] Error parsing ${filePath}:`, parseError);
                        }
                    }
                }
            } catch (error) {
                console.error(`[PathManager] Error initializing file ${filePath}:`, error);
                // Don't throw, continue with other files
            }
        });
    }

    // Getter methods for each file path
    getPriceCachePath() { return this.paths.priceCache; }
    getHistoricalBtcPath() { return this.paths.historicalBtc; }
    getUsersPath() { return this.paths.users; }
    getAppSettingsPath() { return this.paths.appSettings; }
    getTransactionsPath() { return this.paths.transactions; }
    getExchangeCredentialsPath() { return this.paths.exchangeCredentials; }
    getSummaryCachePath() { return this.paths.summaryCache; }
    
    // Get the base data directory
    getDataDirectory() { return this.dataDir; }
}

// Export a singleton instance
const pathManager = new PathManager();
module.exports = pathManager; 