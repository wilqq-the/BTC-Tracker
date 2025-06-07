const fs = require('fs').promises;
const pathManager = require('../utils/path-manager');
const crypto = require('crypto');
const Logger = require('../utils/logger');

// Initialize logger
const logger = Logger.create('CREDENTIAL-MANAGER');

// Constants
const DATA_DIR = pathManager.getDataDirectory();
const CREDS_FILE = pathManager.getExchangeCredentialsPath();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'btc-tracker-default-key'; // In production, use environment variable

/**
 * Credential Manager for securely storing and retrieving exchange API credentials
 */
class CredentialManager {
  constructor() {
    this.initializeStorage();
  }

  /**
   * Initialize storage directories and files
   */
  async initializeStorage() {
    try {
      // Ensure data directory exists
      try {
        await fs.access(DATA_DIR);
      } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
      }
      
      // Initialize credentials file if it doesn't exist
      try {
        await fs.access(CREDS_FILE);
      } catch {
        await fs.writeFile(CREDS_FILE, JSON.stringify({}, null, 2));
      }
    } catch (error) {
      logger.error('Error initializing storage:', error);
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
    
    // Check if the text is already encrypted (contains a colon)
    if (!text.includes(':')) {
      // Not encrypted, return as is
      return text;
    }
    
    const parts = text.split(':');
    if (parts.length !== 2) return '';
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
        iv
      );
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting credential:', error.message);
      // Return the original text if decryption fails
      return text;
    }
  }

  /**
   * Save credentials for an exchange
   * @param {string} exchangeId - Unique identifier for the exchange
   * @param {Object} credentials - API credentials to store
   * @returns {boolean} Success status
   */
  async saveCredentials(exchangeId, credentials) {
    try {
      // Read existing credentials
      let allCredentials = {};
      try {
        const data = await fs.readFile(CREDS_FILE, 'utf8');
        allCredentials = JSON.parse(data);
      } catch (error) {
        logger.debug('No existing credentials file or invalid JSON, creating new one');
      }
      
      // Encrypt each credential value
      const encryptedCreds = {};
      for (const [key, value] of Object.entries(credentials)) {
        encryptedCreds[key] = this.encrypt(value.toString());
      }
      
      // Add metadata
      encryptedCreds.lastUpdated = new Date().toISOString();
      
      // Save updated credentials
      allCredentials[exchangeId] = encryptedCreds;
      
      // Add more detailed logging
      logger.debug(`Writing credentials to file: ${CREDS_FILE}`);
      logger.debug(`Saving credentials for exchange: ${exchangeId}`);
      logger.debug(`Credential keys being saved: ${Object.keys(encryptedCreds).join(', ')}`);
      
      await fs.writeFile(CREDS_FILE, JSON.stringify(allCredentials, null, 2));
      
      // Verify the file was written
      try {
        const verifyData = await fs.readFile(CREDS_FILE, 'utf8');
        const verifyJson = JSON.parse(verifyData);
        if (!verifyJson[exchangeId]) {
          throw new Error('Credentials were not properly saved');
        }
        logger.debug('Successfully verified credentials were saved');
      } catch (verifyError) {
        logger.error('Failed to verify saved credentials:', verifyError);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error saving credentials:', error);
      return false;
    }
  }

  /**
   * Get credentials for an exchange
   * @param {string} exchangeId - Unique identifier for the exchange
   * @returns {Object|null} Decrypted credentials or null if not found
   */
  async getCredentials(exchangeId) {
    try {
      let allCredentials = {};
      
      try {
        const data = await fs.readFile(CREDS_FILE, 'utf8');
        allCredentials = JSON.parse(data);
      } catch (error) {
        logger.error('Error reading credentials file:', error.message);
        
        // Fall back to using require() for backward compatibility
        try {
          const path = require('path');
          const oldCredentialsPath = path.join(__dirname, '..', '..', 'data', 'exchange-credentials.json');
          allCredentials = require(oldCredentialsPath);
          logger.debug('Successfully loaded credentials from legacy path');
        } catch (fallbackError) {
          logger.error('Could not load credentials from legacy path either:', fallbackError.message);
          return null;
        }
      }
      
      if (!allCredentials[exchangeId]) {
        logger.error(`No credentials found for exchange: ${exchangeId}`);
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
      logger.error('Error getting credentials:', error);
      return null;
    }
  }

  /**
   * Delete credentials for an exchange
   * @param {string} exchangeId - Unique identifier for the exchange
   * @returns {boolean} Success status
   */
  async deleteCredentials(exchangeId) {
    try {
      let allCredentials = {};
      
      try {
        const data = await fs.readFile(CREDS_FILE, 'utf8');
        allCredentials = JSON.parse(data);
      } catch (error) {
        logger.error('Error reading credentials file:', error);
        return false;
      }
      
      if (allCredentials[exchangeId]) {
        delete allCredentials[exchangeId];
        await fs.writeFile(CREDS_FILE, JSON.stringify(allCredentials, null, 2));
      }
      
      return true;
    } catch (error) {
      logger.error('Error deleting credentials:', error);
      return false;
    }
  }

  /**
   * List all exchanges with saved credentials
   * @returns {Array} Array of exchange IDs with saved credentials
   */
  async listExchanges() {
    try {
      let allCredentials = {};
      
      try {
        const data = await fs.readFile(CREDS_FILE, 'utf8');
        allCredentials = JSON.parse(data);
      } catch (error) {
        logger.error('Error reading credentials file:', error);
        
        // Fall back to using require() for backward compatibility
        try {
          const path = require('path');
          const oldCredentialsPath = path.join(__dirname, '..', '..', 'data', 'exchange-credentials.json');
          allCredentials = require(oldCredentialsPath);
          logger.debug('Successfully loaded credentials from legacy path for listing exchanges');
        } catch (fallbackError) {
          logger.error('Could not load credentials from legacy path either:', fallbackError.message);
          return [];
        }
      }
      
      return Object.keys(allCredentials);
    } catch (error) {
      logger.error('Error listing exchanges:', error);
      return [];
    }
  }
}

// Initialize and export singleton instance
const credentialManager = new CredentialManager();
module.exports = credentialManager; 