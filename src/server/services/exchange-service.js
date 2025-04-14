const fs = require('fs');
const path = require('path');
const KrakenAdapter = require('../exchanges/kraken-adapter');
const StrikeAdapter = require('../exchanges/strike-adapter');
const BinanceAdapter = require('../exchanges/binance-adapter');
const credentialManager = require('./credential-manager');

/**
 * Exchange Service - Manages all exchange integrations
 */
class ExchangeService {
  constructor() {
    this.exchanges = {};
    this.registeredAdapters = {
      kraken: KrakenAdapter,
      strike: StrikeAdapter,
      binance: BinanceAdapter
    };
    
    // Initialize all exchanges with credentials
    this.initializeExchanges();
  }

  /**
   * Initialize all exchanges with saved credentials
   */
  initializeExchanges() {
    // Get list of exchanges with saved credentials
    const exchangeIds = credentialManager.listExchanges();
    
    // Initialize adapters for each exchange
    for (const exchangeId of exchangeIds) {
      this.initializeExchange(exchangeId);
      
      // Also connect to the exchange
      this.connectExchange(exchangeId)
        .then(connected => {
          if (connected) {
            console.log(`Successfully connected to exchange: ${exchangeId}`);
          } else {
            console.error(`Failed to connect to exchange: ${exchangeId}`);
          }
        })
        .catch(error => {
          console.error(`Error connecting to exchange ${exchangeId}:`, error);
        });
    }
  }

  /**
   * Initialize a specific exchange
   * @param {string} exchangeId - Exchange identifier
   * @returns {boolean} Success status
   */
  initializeExchange(exchangeId) {
    try {
      // Check if we have an adapter for this exchange
      const AdapterClass = this.registeredAdapters[exchangeId.toLowerCase()];
      
      if (!AdapterClass) {
        console.error(`No adapter found for exchange: ${exchangeId}`);
        return false;
      }
      
      // Create adapter instance
      const adapter = new AdapterClass();
      
      // Store in exchanges map
      this.exchanges[exchangeId] = adapter;
      
      return true;
    } catch (error) {
      console.error(`Error initializing exchange ${exchangeId}:`, error);
      return false;
    }
  }

  /**
   * Get all available exchange adapters
   * @returns {Object} Map of available exchange adapters
   */
  getAvailableExchanges() {
    const exchanges = {};
    
    for (const [id, AdapterClass] of Object.entries(this.registeredAdapters)) {
      // Create temporary instance to get info
      const tempAdapter = new AdapterClass();
      
      exchanges[id] = {
        id,
        name: tempAdapter.getName(),
        credentials: tempAdapter.getRequiredCredentials(),
        connected: this.exchanges[id] ? this.exchanges[id].getStatus() : false
      };
    }
    
    return exchanges;
  }

  /**
   * Get exchange adapter by ID
   * @param {string} exchangeId - Exchange identifier
   * @returns {Object|null} Exchange adapter or null if not found
   */
  getExchange(exchangeId) {
    return this.exchanges[exchangeId] || null;
  }

  /**
   * Connect to an exchange
   * @param {string} exchangeId - Exchange identifier
   * @returns {Promise<boolean>} Success status
   */
  async connectExchange(exchangeId) {
    try {
      // Get adapter
      let adapter = this.exchanges[exchangeId];
      
      // If not initialized yet, initialize it
      if (!adapter) {
        const success = this.initializeExchange(exchangeId);
        if (!success) {
          return false;
        }
        adapter = this.exchanges[exchangeId];
      }
      
      // Connect to exchange
      return await adapter.connect();
    } catch (error) {
      console.error(`Error connecting to exchange ${exchangeId}:`, error);
      return false;
    }
  }

  /**
   * Save credentials for an exchange
   * @param {string} exchangeId - Exchange identifier
   * @param {Object} credentials - API credentials
   * @returns {Promise<boolean>} Success status
   */
  async saveExchangeCredentials(exchangeId, credentials) {
    try {
      // Get adapter class
      const AdapterClass = this.registeredAdapters[exchangeId.toLowerCase()];
      
      if (!AdapterClass) {
        throw new Error(`No adapter found for exchange: ${exchangeId}`);
      }
      
      // Create temporary adapter to test credentials
      const tempAdapter = new AdapterClass();
      
      // Test credentials
      const valid = await tempAdapter.testConnection(credentials);
      
      if (!valid) {
        throw new Error(`Invalid credentials for exchange: ${exchangeId}`);
      }
      
      // Save credentials
      const saved = credentialManager.saveCredentials(exchangeId, credentials);
      
      if (!saved) {
        throw new Error(`Failed to save credentials for exchange: ${exchangeId}`);
      }
      
      // Initialize or reinitialize the exchange
      if (this.exchanges[exchangeId]) {
        // Disconnect existing adapter
        delete this.exchanges[exchangeId];
      }
      
      this.initializeExchange(exchangeId);
      await this.connectExchange(exchangeId);
      
      return true;
    } catch (error) {
      console.error(`Error saving exchange credentials for ${exchangeId}:`, error);
      return false;
    }
  }

  /**
   * Get transactions from an exchange
   * @param {string} exchangeId - Exchange identifier
   * @param {Object} options - Options for fetching transactions
   * @returns {Promise<Array>} Transactions array
   */
  async getExchangeTransactions(exchangeId, options = {}) {
    try {
      // Get adapter
      const adapter = this.exchanges[exchangeId];
      
      if (!adapter) {
        throw new Error(`Exchange not initialized: ${exchangeId}`);
      }
      
      // Connect if not connected
      if (!adapter.getStatus()) {
        const connected = await adapter.connect();
        if (!connected) {
          throw new Error(`Could not connect to exchange: ${exchangeId}`);
        }
      }
      
      // Get transactions
      return await adapter.getTransactions(options);
    } catch (error) {
      console.error(`Error getting transactions from exchange ${exchangeId}:`, error);
      return [];
    }
  }

  /**
   * Get balances from an exchange
   * @param {string} exchangeId - Exchange identifier
   * @returns {Promise<Object>} Balances object
   */
  async getExchangeBalances(exchangeId) {
    try {
      // Get adapter
      const adapter = this.exchanges[exchangeId];
      
      if (!adapter) {
        throw new Error(`Exchange not initialized: ${exchangeId}`);
      }
      
      // Connect if not connected
      if (!adapter.getStatus()) {
        const connected = await adapter.connect();
        if (!connected) {
          throw new Error(`Could not connect to exchange: ${exchangeId}`);
        }
      }
      
      // Get balances
      return await adapter.getBalances();
    } catch (error) {
      console.error(`Error getting balances from exchange ${exchangeId}:`, error);
      return {};
    }
  }

  /**
   * Remove exchange credentials and disconnect
   * @param {string} exchangeId - Exchange identifier
   * @returns {boolean} Success status
   */
  removeExchange(exchangeId) {
    try {
      // Remove credentials
      credentialManager.deleteCredentials(exchangeId);
      
      // Remove adapter
      if (this.exchanges[exchangeId]) {
        delete this.exchanges[exchangeId];
      }
      
      return true;
    } catch (error) {
      console.error(`Error removing exchange ${exchangeId}:`, error);
      return false;
    }
  }

  /**
   * Get exchange adapter class by ID
   * @param {string} exchangeId - Exchange identifier
   * @returns {Class|null} Exchange adapter class or null if not found
   */
  getAdapterClass(exchangeId) {
    const id = exchangeId.toLowerCase();
    return this.registeredAdapters[id] || null;
  }
}

module.exports = new ExchangeService(); 