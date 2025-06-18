const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Using the zip distribution that contains all necessary files
const EXTRACT_PATH = path.join(__dirname, 'node_binaries');

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function setupNodeBinaries() {
  try {
    // Skip download if the zip already exists in node_binaries
    const zipInNodeBinaries = path.join(EXTRACT_PATH, 'node-v22.14.0-win-x64.zip');
    if (fs.existsSync(zipInNodeBinaries)) {
      console.log('Using existing Node.js zip file from node_binaries directory');
      return;
    }

    // Clean up existing directory if it exists
    if (fs.existsSync(EXTRACT_PATH)) {
      console.log('Cleaning up existing node_binaries directory...');
      fs.rmSync(EXTRACT_PATH, { recursive: true, force: true });
    }

    // Create fresh node_binaries directory
    fs.mkdirSync(EXTRACT_PATH);

    // Copy the zip file to node_binaries
    console.log('Copying Node.js zip to node_binaries directory...');
    fs.copyFileSync(zipInNodeBinaries, path.join(EXTRACT_PATH, 'node-v22.14.0-win-x64.zip'));
    console.log('Node.js zip file copied successfully');

  } catch (error) {
    console.error('Error during setup:', error);
    process.exit(1);
  }
}

// Run the setup
setupNodeBinaries().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
}); 