# BTC Tracker - Electron Desktop App

This document describes how to run and build BTC Tracker as a standalone desktop application using Electron.

## Features

- Run as a standalone application on Windows, macOS, and Linux
- Minimize to system tray for background operation
- Use OS-specific app data storage locations
- Run in headless mode (server only) without UI window
- Same functionality as the web version

## Development

### Prerequisites

- Node.js 14+ installed
- npm or yarn

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
- Show a tray icon for managing the server
- Not display any application window
- Allow access via browser at http://localhost:3000

### Building for Distribution

```bash
# Build for current platform
npm run electron:build
```

The built application will be available in the `dist` directory.

## Data Storage

The Electron version uses the following data storage locations:

- **Windows**: `%APPDATA%\btctracker-data`
- **macOS**: `~/Library/Application Support/btctracker-data`
- **Linux**: `~/.config/btctracker-data`

This is handled by the `PathManager` class, which detects when running in Electron mode.

## Configuration

You can configure the application through the Admin Panel, just like in the web version.

## Command Line Arguments

The Electron app supports the following command line arguments:

- `--headless`: Run the app in headless mode (server only, no UI window)

Example:
```bash
# Run with command line arguments
npx electron src/electron-main.js --headless
```

## Troubleshooting

If you encounter issues:

1. Check the app logs (available from the Admin Panel)
2. Verify data directory permissions
3. For Windows users, make sure your antivirus isn't blocking the application

## License

See the LICENSE file in the project root. 