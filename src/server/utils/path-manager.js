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
            exchangeCredentials: path.join(this.dataDir, 'exchange-credentials.json')
        };
        
        // Ensure all directories exist
        this.ensureDirectoryStructure();
    }

    initializeDataDirectory() {
        let baseDir;
        
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
        
        // Priority 3: Electron resources path
        if (process.env.ELECTRON_RESOURCES_PATH) {
            baseDir = path.join(this.normalizePath(process.env.ELECTRON_RESOURCES_PATH), 'data');
            console.log(`[PathManager] Using ELECTRON_RESOURCES_PATH: ${baseDir}`);
        } 
        // Priority 4: Docker path
        else if (process.env.DOCKER === 'true' && fs.existsSync('/app/src/data')) {
            baseDir = '/app/src/data';
            console.log(`[PathManager] Using Docker path: ${baseDir}`);
        } 
        // Priority 5: Default development path
        else {
            baseDir = path.join(__dirname, '..', '..', 'data');
            console.log(`[PathManager] Using default path: ${baseDir}`);
        }
        
        return this.ensureDirectoryExists(baseDir);
    }

    normalizePath(inputPath) {
        return path.normalize(inputPath.replace(/[\\/]+/g, path.sep));
    }

    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return dirPath;
    }

    ensureDirectoryStructure() {
        // Ensure data directory exists
        this.ensureDirectoryExists(this.dataDir);
        
        // Initialize empty JSON files if they don't exist
        Object.values(this.paths).forEach(filePath => {
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify([], null, 2));
                console.log(`[PathManager] Initialized empty file: ${filePath}`);
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
    
    // Get the base data directory
    getDataDirectory() { return this.dataDir; }
}

// Export a singleton instance
const pathManager = new PathManager();
module.exports = pathManager; 