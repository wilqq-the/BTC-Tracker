const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Add any functions you want available in the renderer process here
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
}); 