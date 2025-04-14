/**
 * ExchangeAdapter - Base class for all exchange integrations
 * 
 * This abstract class defines the interface that all exchange adapters must implement.
 * Each exchange (Kraken, Binance, etc.) will have its own implementation.
 */
class ExchangeAdapter {
  /**
   * Constructor for exchange adapter
   * @param {Object} config - Configuration for this exchange
   */
  constructor(config = {}) {
    this.name = 'Unknown Exchange';
    this.config = config;
    this.isConnected = false;
    this.lastSyncTime = null;
  }

  /**
   * Get the name of the exchange
   * @returns {string} Exchange name
   */
  getName() {
    return this.name;
  }

  /**
   * Get the status of the connection
   * @returns {boolean} Whether the adapter is connected
   */
  getStatus() {
    return this.isConnected;
  }

  /**
   * Connect to the exchange API using stored credentials
   * @returns {Promise<boolean>} True if connection successful
   */
  async connect() {
    throw new Error(`${this.name} adapter must implement connect() method`);
  }

  /**
   * Test connection with provided credentials
   * @param {Object} credentials - API credentials to test
   * @returns {Promise<boolean>} True if credentials are valid
   */
  async testConnection(credentials) {
    throw new Error(`${this.name} adapter must implement testConnection() method`);
  }

  /**
   * Fetch transactions from the exchange
   * @param {Object} options - Options for fetching transactions
   * @param {Date} options.startDate - Start date for transactions
   * @param {Date} options.endDate - End date for transactions
   * @returns {Promise<Array>} Array of standardized transaction objects
   */
  async getTransactions(options = {}) {
    throw new Error(`${this.name} adapter must implement getTransactions() method`);
  }

  /**
   * Fetch balances from the exchange
   * @returns {Promise<Object>} Standardized balances object
   */
  async getBalances() {
    throw new Error(`${this.name} adapter must implement getBalances() method`);
  }
  
  /**
   * Transform exchange-specific transaction to app standard format
   * @param {Object} transaction - Exchange-specific transaction
   * @returns {Object} Standardized transaction object
   */
  transformTransaction(transaction) {
    throw new Error(`${this.name} adapter must implement transformTransaction() method`);
  }
  
  /**
   * Get exchange-specific requirements for API credentials
   * @returns {Array} Array of required credential fields
   */
  getRequiredCredentials() {
    throw new Error(`${this.name} adapter must implement getRequiredCredentials() method`);
  }
}

module.exports = ExchangeAdapter; 