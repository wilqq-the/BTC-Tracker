// Check if running in Electron
const isElectron = window.electron !== undefined;

// This function adds Electron-specific UI elements
function setupElectronIntegration() {
  if (!isElectron) return;
  
  // Create a "Minimize to Tray" button
  const navElement = document.querySelector('nav ul');
  
  if (navElement) {
    const minimizeButton = document.createElement('li');
    minimizeButton.innerHTML = '<a href="#" id="minimize-to-tray" title="Minimize to Tray"><i class="fas fa-window-minimize"></i> Minimize to Tray</a>';
    navElement.appendChild(minimizeButton);
    
    // Add click event to minimize button
    document.getElementById('minimize-to-tray').addEventListener('click', (e) => {
      e.preventDefault();
      window.electron.minimizeToTray();
    });
  }
  
  // Add app version in footer if exists
  const footer = document.querySelector('footer');
  if (footer) {
    window.electron.getAppVersion().then(version => {
      const versionElement = document.createElement('div');
      versionElement.className = 'app-version';
      versionElement.textContent = `v${version}`;
      footer.appendChild(versionElement);
    });
  }
}

// Run when DOM is fully loaded
document.addEventListener('DOMContentLoaded', setupElectronIntegration); 