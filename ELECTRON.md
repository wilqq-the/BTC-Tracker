# BTC Tracker - Electron Desktop App

This document describes how to run and build BTC Tracker as a standalone desktop application using Electron.

## Features

- Run as a standalone application on Windows
- System tray integration with comprehensive management options
- Automatic server management and recovery
- Secure storage of exchange credentials
- Smart module extraction and management
- Detailed logging system
- Development and headless modes

## Development

### Prerequisites

- Node.js 20.x or later
- npm or yarn
- Windows operating system

### Running in Development Mode

```bash
# Install dependencies
npm install

# Run with UI
npm run electron

# Run in headless mode (server only)
npm run electron:headless
```

When running in headless mode, the application will:
- Start the API server on localhost:3000
- Show a tray icon with management options
- Not display any application window
- Allow access via browser at http://localhost:3000

### Building for Distribution

```bash
# Build without publishing
npm run electron:build

# Build and publish to GitHub
npm run electron:publish
```

The built application will be available in the `dist` directory.

## System Tray Features

The application provides a comprehensive system tray menu with the following options:
- Open BTC Tracker (when not in headless mode)
- View server status and port
- Restart server
- View logs
- Debug information
- Reset extracted files
- Run NPM Install
- Smart scan for modules
- Manual cleanup instructions

## Data Storage

The Electron version uses the following data storage locations:

- **Application Data**: `%APPDATA%\btc-tracker-data`
- **Extracted Server Files**: `%APPDATA%\btc-tracker\extracted`
- **Log File**: `%APPDATA%\btc-tracker\btc-tracker.log`

## Server Management

The application includes several features for managing the server:

1. **Automatic Recovery**
   - Server automatically restarts on crashes (up to 3 attempts)
   - Smart module extraction and dependency management
   - Automatic npm dependency installation

2. **File Management**
   - Smart extraction of server files
   - Automatic creation of missing critical files
   - Stub generation for optional modules

3. **Troubleshooting Tools**
   - Detailed logging system
   - Debug information viewer
   - Manual cleanup options
   - NPM dependency reinstallation

## Command Line Arguments

The Electron app supports the following command line arguments:

- `--headless`: Run the app in headless mode (server only, no UI window)

Example:
```bash
npx electron src/electron-main.js --headless
```

## Continuous Integration

The application uses GitHub Actions for automated builds:

- Builds on every push to main and dev branches
- Builds on pull requests to main and dev
- Creates releases for version tags (v*)
- Automated artifact upload and release creation

## Troubleshooting

If you encounter issues:

1. **Server Issues**
   - Check the logs via tray menu
   - Use "Reset Extracted Files" option
   - Run "NPM Install" from tray menu
   - Use "Smart Scan for Modules"

2. **Module Loading Issues**
   - Try the "Reset Extracted Files" option
   - Run "NPM Install" from tray menu
   - Check the debug information
   - Follow manual cleanup instructions if needed

3. **Build Issues**
   - Ensure all dependencies are installed
   - Check GitHub Actions logs
   - Verify your GitHub token is set correctly

## License

See the LICENSE file in the project root. 