# BTC Tracker - Electron Desktop Application

This document explains how to run and build the BTC Tracker desktop application using Electron.

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Running in Development Mode

1. Clone the repository and navigate to the project folder:
   ```
   git clone https://github.com/wilqq-the/BTC-tracker.git
   cd BTC-tracker
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the Electron app in development mode:
   ```
   npm run electron-dev
   ```

   This will:
   - Start the Express server
   - Wait for the server to be ready
   - Launch the Electron application window

## Building the Desktop Application

### For Windows (.exe installer)

```
npm run build-win
```

The built installer will be available in the `dist` folder.

### For all platforms

```
npm run build
```

This will create builds for your current platform. The built applications will be available in the `dist` folder.

## Features in the Desktop Version

The Electron version of BTC Tracker includes all the features of the web version, plus:

- **Native Desktop Experience**: Runs as a standalone application
- **Automatic Updates**: Can be configured to check for and install updates
- **Persistent Local Storage**: Data is stored in the user's application data folder
- **System Tray Integration**: Can be minimized to the system tray
- **Better Performance**: No browser limitations

## Data Storage Location

In the desktop version, all data is stored in the user's application data directory:

- Windows: `C:\Users\<username>\AppData\Roaming\BTC Tracker\btctracker-data`
- macOS: `/Users/<username>/Library/Application Support/BTC Tracker/btctracker-data`
- Linux: `~/.config/BTC Tracker/btctracker-data`

## Troubleshooting

### Application Won't Start

1. Check the logs in the console where you ran the `npm run electron-dev` command
2. Make sure port 3000 is not in use by another application
3. Try clearing the application data folder if the application is crashing

### Data Not Persisting

If your data isn't being saved between application restarts:

1. Check the console logs to verify the correct data directory path
2. Ensure you have write permissions to the application data folder
3. Check if there are any error messages related to file operations

## Package.json Scripts

- `npm run electron`: Runs the prebuilt Electron app (server must be started separately)
- `npm run electron-dev`: Starts both the server and Electron app for development
- `npm run build`: Builds the Electron app for your current platform
- `npm run build-win`: Builds specifically for Windows (creates NSIS installer)

## Configuration

You can modify the build configuration in the `electron-builder.yml` file.

## Customizing the App

- **Icons**: Replace the icon files in `src/public/img/` with your own
- **Menu**: Edit the menu template in `src/electron.js`
- **Window Size**: Adjust the window dimensions in `src/electron.js` 