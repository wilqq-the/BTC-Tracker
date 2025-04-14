const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Constants
const DATA_DIR = path.join(__dirname, '../../data');
const CREDS_FILE = path.join(DATA_DIR, 'exchange-credentials.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'btc-tracker-default-key'; // In production, use environment variable

/**
 * Credential Manager for securely storing and retrieving exchange API credentials
 */
class CredentialManager {
  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Initialize credentials file if it doesn't exist
    if (!fs.existsSync(CREDS_FILE)) {
      fs.writeFileSync(CREDS_FILE, JSON.stringify({}, null, 2));
    }
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Text to encrypt
   * @returns {string} Encrypted text
   */
  encrypt(text) {
    if (!text) return '';
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   * @param {string} text - Encrypted text
   * @returns {string} Decrypted text
   */
  decrypt(text) {
    if (!text) return '';
    
    const parts = text.split(':');
    if (parts.length !== 2) return '';
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Save credentials for an exchange
   * @param {string} exchangeId - Unique identifier for the exchange
   * @param {Object} credentials - API credentials to store
   * @returns {boolean} Success status
   */
  saveCredentials(exchangeId, credentials) {
    try {
      // Read existing credentials
      const data = fs.readFileSync(CREDS_FILE, 'utf8');
      const allCredentials = JSON.parse(data);
      
      // Encrypt each credential value
      const encryptedCreds = {};
      for (const [key, value] of Object.entries(credentials)) {
        encryptedCreds[key] = this.encrypt(value.toString());
      }
      
      // Add metadata
      encryptedCreds.lastUpdated = new Date().toISOString();
      
      // Save updated credentials
      allCredentials[exchangeId] = encryptedCreds;
      fs.writeFileSync(CREDS_FILE, JSON.stringify(allCredentials, null, 2));
      
      return true;
    } catch (error) {
      console.error('Error saving credentials:', error);
      return false;
    }
  }

  /**
   * Get credentials for an exchange
   * @param {string} exchangeId - Unique identifier for the exchange
   * @returns {Object|null} Decrypted credentials or null if not found
   */
  getCredentials(exchangeId) {
    try {
      const data = fs.readFileSync(CREDS_FILE, 'utf8');
      const allCredentials = JSON.parse(data);
      
      if (!allCredentials[exchangeId]) {
        return null;
      }
      
      // Decrypt values (except metadata)
      const credentials = {};
      for (const [key, value] of Object.entries(allCredentials[exchangeId])) {
        if (key !== 'lastUpdated') {
          credentials[key] = this.decrypt(value);
        } else {
          credentials[key] = value;
        }
      }
      
      return credentials;
    } catch (error) {
      console.error('Error getting credentials:', error);
      return null;
    }
  }

  /**
   * Delete credentials for an exchange
   * @param {string} exchangeId - Unique identifier for the exchange
   * @returns {boolean} Success status
   */
  deleteCredentials(exchangeId) {
    try {
      const data = fs.readFileSync(CREDS_FILE, 'utf8');
      const allCredentials = JSON.parse(data);
      
      if (allCredentials[exchangeId]) {
        delete allCredentials[exchangeId];
        fs.writeFileSync(CREDS_FILE, JSON.stringify(allCredentials, null, 2));
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting credentials:', error);
      return false;
    }
  }

  /**
   * List all exchanges with saved credentials
   * @returns {Array} Array of exchange IDs with saved credentials
   */
  listExchanges() {
    try {
      const data = fs.readFileSync(CREDS_FILE, 'utf8');
      const allCredentials = JSON.parse(data);
      
      return Object.keys(allCredentials);
    } catch (error) {
      console.error('Error listing exchanges:', error);
      return [];
    }
  }
}

module.exports = new CredentialManager(); 