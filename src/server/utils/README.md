# Path Manager Documentation

## Overview

The `path-manager.js` module is a critical utility in BTC Tracker that manages all data file paths. It provides a centralized, consistent approach to handling file storage locations across different environments (development, testing, production, Docker, and Electron).

## How Path Manager Works

### Core Functionality

The `PathManager` class:
1. Determines the appropriate data directory based on environment
2. Creates necessary directories if they don't exist
3. Manages paths to all data files used by the application
4. Provides getter methods for accessing file paths
5. Initializes empty JSON files when needed

### Data Directory Resolution Priority

The path manager uses the following priority order to determine where to store data:

1. **Environment Variable** (`BTC_TRACKER_DATA_DIR`)
   - Highest priority
   - Allows complete customization of data location
   - Used by test environment to isolate test data

2. **Windows AppData Path** (when `USE_WINDOWS_PATH=true`)
   - Uses system-appropriate user data paths:
     - Windows: `%APPDATA%\btctracker-data`
     - macOS: `~/Library/Application Support/btctracker-data`
     - Linux: `~/.config/btctracker-data`

3. **Electron Resources Path** (when `ELECTRON_RESOURCES_PATH` is set)
   - Used when running as an Electron desktop application
   - Stores data in the Electron resources directory

4. **Docker Path** (when `DOCKER=true`)
   - Uses `/app/src/data` when running in a Docker container

5. **Default Development Path**
   - Fallback option
   - Uses `src/data` relative to the source directory

### Managed File Paths

The path manager handles these critical data files:

| File | Purpose |
|------|---------|
| `price-cache.json` | Cached cryptocurrency price data |
| `historical_btc.json` | Historical Bitcoin price records |
| `users.json` | User accounts and authentication data |
| `app-settings.json` | Application configuration settings |
| `transactions.json` | User's Bitcoin transaction records |
| `exchange-credentials.json` | API credentials for exchanges |

## Usage

The path manager is exported as a singleton instance, so it can be easily imported and used throughout the application:

```javascript
// Import the path manager
const pathManager = require('./utils/path-manager');

// Get paths to specific files
const usersFilePath = pathManager.getUsersPath();
const transactionsFilePath = pathManager.getTransactionsPath();

// Get the base data directory
const dataDir = pathManager.getDataDirectory();
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `BTC_TRACKER_DATA_DIR` | Custom data directory location |
| `USE_WINDOWS_PATH` | When 'true', uses system AppData location |
| `ELECTRON_RESOURCES_PATH` | Path to Electron resources directory |
| `DOCKER` | When 'true', uses Docker container paths |

## Testing Configuration

For testing, the application uses `BTC_TRACKER_DATA_DIR` to point to `./tests/test-data`, ensuring:

1. Tests have an isolated data environment
2. Test data doesn't interfere with development or production data
3. Each test run starts with a clean data state 