const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');
const ExchangeAdapter = require('./exchange-adapter');
const credentialManager = require('../services/credential-manager');
const currencyConverter = require('../services/currency-converter');
const Transaction = require('../models/Transaction');

/**
 * KrakenAdapter - Implementation of ExchangeAdapter for Kraken exchange
 */
class KrakenAdapter extends ExchangeAdapter {
  /**
   * Constructor for Kraken adapter
   * @param {Object} config - Configuration for Kraken
   */
  constructor(config = {}) {
    super(config);
    this.name = 'Kraken';
    this.baseUrl = 'https://api.kraken.com';
    this.apiVersion = '0';
    this.credentials = null;
  }

  /**
   * Get required API credential fields for Kraken
   * @returns {Array} Array of required credential fields
   */
  getRequiredCredentials() {
    return [
      { key: 'apiKey', label: 'API Key', type: 'text' },
      { key: 'privateKey', label: 'API Secret (Private Key)', type: 'password', help: 'The API Secret from your Kraken account' }
    ];
  }

  /**
   * Connect to Kraken using stored credentials
   * @returns {Promise<boolean>} True if connection successful
   */
  async connect() {
    try {
      // Get credentials
      this.credentials = credentialManager.getCredentials('kraken');
      
      if (!this.credentials) {
        console.error('No Kraken credentials found');
        this.isConnected = false;
        return false;
      }
      
      // Test credentials by fetching account balance
      const result = await this.testConnection(this.credentials);
      this.isConnected = result;
      
      return result;
    } catch (error) {
      console.error('Error connecting to Kraken:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Test connection with provided credentials
   * @param {Object} credentials - API credentials to test
   * @returns {Promise<boolean>} True if credentials are valid
   */
  async testConnection(credentials) {
    try {
      // For testing purposes - accept any credentials in dev mode
      if (process.env.NODE_ENV === 'development' && credentials.apiKey === 'test' && credentials.privateKey === 'test') {
        console.log('Using TEST MODE for Kraken');
        return true;
      }
      
      // Check the minimum required fields
      if (!credentials.apiKey || !credentials.privateKey) {
        console.error('Missing API Key or Private Key for Kraken connection test');
        return false;
      }
      
      console.log(`Testing Kraken connection with API Key: ${credentials.apiKey.substring(0, 5)}...`);
      
      // Make a simple request to test credentials
      const response = await this._privateRequest('/0/private/Balance', {}, credentials);
      
      // Check if the response contains an error
      if (response && response.error && response.error.length > 0) {
        console.error('Kraken API returned an error:', response.error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error testing Kraken connection:', error.message);
      return false;
    }
  }

  /**
   * Fetch transactions from Kraken
   * @param {Object} options - Options for fetching transactions
   * @param {Date} options.startDate - Start date for transactions (optional)
   * @param {Date} options.endDate - End date for transactions (optional)
   * @returns {Promise<Array>} Array of standardized transaction objects
   */
  async getTransactions(options = {}) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      if (!this.isConnected) {
        throw new Error('Not connected to Kraken');
      }
      
      // Prepare parameters
      const params = {};
      
      if (options.startDate) {
        // Safely convert to Unix timestamp (seconds)
        // Handle different date formats (string or Date object)
        try {
          const startDate = typeof options.startDate === 'string' 
            ? new Date(options.startDate) 
            : options.startDate;
            
          if (startDate instanceof Date && !isNaN(startDate.getTime())) {
            params.start = Math.floor(startDate.getTime() / 1000);
          } else {
            console.warn('Invalid startDate format, ignoring:', options.startDate);
          }
        } catch (err) {
          console.error('Failed to parse startDate:', err);
        }
      }
      
      if (options.endDate) {
        // Safely convert to Unix timestamp (seconds)
        // Handle different date formats (string or Date object)
        try {
          const endDate = typeof options.endDate === 'string' 
            ? new Date(options.endDate) 
            : options.endDate;
            
          if (endDate instanceof Date && !isNaN(endDate.getTime())) {
            params.end = Math.floor(endDate.getTime() / 1000);
          } else {
            console.warn('Invalid endDate format, ignoring:', options.endDate);
          }
        } catch (err) {
          console.error('Failed to parse endDate:', err);
        }
      }
      
      // Fetch trades
      const tradesResponse = await this._privateRequest('/0/private/TradesHistory', params);
      
      if (tradesResponse.error && tradesResponse.error.length > 0) {
        throw new Error(`Kraken API error: ${tradesResponse.error.join(', ')}`);
      }
      
      // Transform trades to standardized format
      const transactions = [];
      let skippedCount = 0;
      let nonBtcCount = 0;
      let btcCount = 0;
      
      if (tradesResponse.result && tradesResponse.result.trades) {
        const totalTrades = Object.keys(tradesResponse.result.trades).length;
        console.log(`Got ${totalTrades} trades from Kraken`);
        console.log(`Checking each trade to determine if it's a BTC transaction...`);
        
        for (const [id, trade] of Object.entries(tradesResponse.result.trades)) {
          // Log the trade pair for debugging
          // console.log(`Processing trade with ID ${id}, pair: ${trade.pair}, type: ${trade.type}, amount: ${trade.vol}`);
          
          // Print the full trade object to inspect its structure
          // console.log('Raw Kraken Trade Object:', JSON.stringify(trade, null, 2));
          
          // Enhanced BTC detection: check for XBT, XXBTZ, BTC, or XXBT
          // Some Kraken pairs use different formats like XBTEUR, BTCUSD, etc.
          const isBtcPair = trade.pair && (
            trade.pair.includes('XBT') || 
            trade.pair.includes('XXBTZ') ||
            trade.pair.includes('BTC') ||
            trade.pair.includes('XXBT')
          );
          
          if (isBtcPair) {
            btcCount++;
            // console.log(`✓ Identified as BTC trade: ${trade.pair}`);
            const transformedTx = await this.transformTransaction(trade);
            
            // Double-check that transformation worked and resulted in a BTC transaction
            if (transformedTx && transformedTx.baseCurrency === 'BTC') {
              transactions.push(transformedTx);
              // console.log(`✓ Successfully transformed and added transaction`);
            } else {
              skippedCount++;
              console.log(`✗ Failed to transform transaction with pair: ${trade.pair} - ${transformedTx ? 'Not BTC after transform' : 'Transform failed'}`);
            }
          } else {
            nonBtcCount++;
            // console.log(`✗ Skipping non-BTC trade: ${trade.pair}`);
          }
        }
        
        console.log(`
Kraken Transactions Summary:
- Total trades received: ${totalTrades}
- Identified as BTC trades: ${btcCount}
- Non-BTC trades filtered: ${nonBtcCount}
- Failed transformations: ${skippedCount}
- Final BTC transactions: ${transactions.length}
`);
      }
      
      return transactions;
    } catch (error) {
      console.error('Error fetching Kraken transactions:', error);
      return [];
    }
  }

  /**
   * Fetch balances from Kraken
   * @returns {Promise<Object>} Standardized balances object
   */
  async getBalances() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      if (!this.isConnected) {
        throw new Error('Not connected to Kraken');
      }
      
      const response = await this._privateRequest('/0/private/Balance', {});
      
      if (response.error && response.error.length > 0) {
        throw new Error(`Kraken API error: ${response.error.join(', ')}`);
      }
      
      // Transform balances to standardized format
      const balances = {};
      
      if (response.result) {
        for (const [currency, amount] of Object.entries(response.result)) {
          // Convert Kraken's asset codes to standard symbols
          let symbol = currency;
          
          // Handle Kraken's special asset codes
          if (currency === 'XXBT') symbol = 'BTC';
          if (currency === 'XETH') symbol = 'ETH';
          // Add more mappings as needed
          
          balances[symbol] = {
            total: parseFloat(amount),
            available: parseFloat(amount), // Kraken doesn't provide available vs. total in this endpoint
            currency: symbol
          };
        }
      }
      
      return balances;
    } catch (error) {
      console.error('Error fetching Kraken balances:', error);
      return {};
    }
  }
  
  /**
   * Transform Kraken transaction to app standard format
   * @param {Object} trade - Kraken specific trade
   * @returns {Object} Standardized transaction object
   */
  async transformTransaction(trade) {
    try {
      // Ensure we have current exchange rates
      await currencyConverter.ensureRates();

      // Determine transaction type
      const type = trade.type === 'buy' ? 'buy' : 'sell';
      
      // Parse the pair to get base currency and quote currency
      let baseCurrency = null;
      let quoteCurrency = 'USD'; // Default
      
      console.log(`Transforming trade with pair: ${trade.pair}`);
      
      // Extract proper currency symbols from Kraken's pair
      if (trade.pair) {
        // More comprehensive approach to identify Bitcoin pairs
        // Kraken uses different formats like XXBTZUSD, XBTEUR, XXBT/ZUSD
        const lowerPair = trade.pair.toLowerCase();
        
        // Detect BTC as base currency with different patterns
        if (lowerPair.includes('xbt') || lowerPair.includes('btc') || lowerPair.includes('xxbt')) {
          baseCurrency = 'BTC';
          console.log(`✓ Detected BTC as base currency in pair: ${trade.pair}`);
          
          // Extract quote currency - priority order for detection
          if (lowerPair.includes('usd') || lowerPair.includes('zusd')) {
            quoteCurrency = 'USD';
          } else if (lowerPair.includes('eur') || lowerPair.includes('zeur')) {
            quoteCurrency = 'EUR';
          } else if (lowerPair.includes('gbp')) {
            quoteCurrency = 'GBP';
          } else if (lowerPair.includes('jpy')) {
            quoteCurrency = 'JPY';
          } else if (lowerPair.includes('chf')) {
            quoteCurrency = 'CHF';
          } else if (lowerPair.includes('pln')) {
            quoteCurrency = 'PLN';
          } else if (lowerPair.includes('aud')) {
            quoteCurrency = 'AUD';
          } else if (lowerPair.includes('cad')) {
            quoteCurrency = 'CAD';
          }
          
          console.log(`✓ Detected quote currency: ${quoteCurrency}`);
        } 
        // Check if Bitcoin is the quote currency (may happen in some pairs)
        else if (lowerPair.includes('xxbt') || lowerPair.includes('xbt') || lowerPair.includes('btc')) {
          // In this case, we have something/BTC where BTC is the quote currency
          // This is the opposite of what we usually want, so we need to swap them
          baseCurrency = 'BTC';
          
          // Try to extract base currency (this will be approximate)
          if (lowerPair.includes('eth')) quoteCurrency = 'ETH';
          else if (lowerPair.includes('ltc')) quoteCurrency = 'LTC';
          else if (lowerPair.includes('xmr')) quoteCurrency = 'XMR';
          else quoteCurrency = 'OTHER'; // Fallback
          
          console.log(`⚠️ Found BTC as quote currency, remapping: ${trade.pair} → BTC/${quoteCurrency}`);
        }
      }
      
      // Skip if not a BTC transaction
      if (baseCurrency !== 'BTC') {
        console.log(`✗ Not a BTC transaction: ${trade.pair}`);
        return null;
      }

      // Convert Kraken timestamp to Date
      const timestamp = trade.time ? new Date(trade.time * 1000) : new Date();

      // Create transaction with original values
      const transactionData = {
        // Use the Kraken trade ID (trade_id) as the unique identifier
        id: `kraken-${trade.trade_id || trade.id}`,
        exchange: 'kraken',
        type,
        amount: parseFloat(trade.vol),
        date: timestamp.toISOString(),
        txType: 'spot',
        status: 'Completed',
        pair: `${baseCurrency}/${quoteCurrency}`,
        baseCurrency,
        quoteCurrency,
        
        // Store the original Kraken trade IDs for reference
        krakenData: {
          ordertxid: trade.ordertxid,
          trade_id: trade.trade_id, // Use the correct field name
          txid: trade.txid || trade.id, // Keep the old txid for reference if needed
          pair: trade.pair
        },
        
        // Original values in the quote currency
        original: {
          currency: quoteCurrency,
          price: parseFloat(trade.price),
          cost: parseFloat(trade.cost),
          fee: parseFloat(trade.fee || 0)
        }
      };

      // Convert to base currencies (EUR and USD)
      if (quoteCurrency !== 'EUR') {
        const eurValues = currencyConverter.convertValues({
          price: transactionData.original.price,
          cost: transactionData.original.cost,
          fee: transactionData.original.fee
        }, quoteCurrency, 'EUR');
        
        transactionData.base = {
          eur: {
            price: eurValues.price,
            cost: eurValues.cost,
            fee: eurValues.fee,
            rate: eurValues.rate
          }
        };
      } else {
        transactionData.base = {
          eur: {
            price: transactionData.original.price,
            cost: transactionData.original.cost,
            fee: transactionData.original.fee,
            rate: 1
          }
        };
      }

      if (quoteCurrency !== 'USD') {
        const usdValues = currencyConverter.convertValues({
          price: transactionData.original.price,
          cost: transactionData.original.cost,
          fee: transactionData.original.fee
        }, quoteCurrency, 'USD');
        
        transactionData.base.usd = {
          price: usdValues.price,
          cost: usdValues.cost,
          fee: usdValues.fee,
          rate: usdValues.rate
        };
      } else {
        transactionData.base.usd = {
          price: transactionData.original.price,
          cost: transactionData.original.cost,
          fee: transactionData.original.fee,
          rate: 1
        };
      }

      // Create Transaction instance
      const transaction = new Transaction(transactionData);

      // Validate the transaction
      if (!transaction.isValid()) {
        console.error('Invalid transaction data:', transactionData);
        return null;
      }

      return transaction.toJSON();
    } catch (error) {
      console.error('Error transforming Kraken transaction:', error);
      return null;
    }
  }

  /**
   * Make a private API request to Kraken
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @param {Object} [creds] - Optional credentials (uses stored if not provided)
   * @returns {Promise<Object>} API response
   * @private
   */
  async _privateRequest(endpoint, params = {}, creds = null) {
    const credentials = creds || this.credentials;
    
    if (!credentials) {
      throw new Error('No credentials for Kraken API');
    }
    
    const { apiKey, privateKey } = credentials;
    
    if (!apiKey || !privateKey) {
      throw new Error('Missing API Key or Private Key for Kraken API');
    }
    
    // Add nonce parameter for API security
    const nonce = Date.now().toString();
    const requestParams = {
      nonce,
      ...params
    };
    
    try {
      // Create signature
      const path = endpoint;
      const postData = qs.stringify(requestParams);
      const message = nonce + postData;
      
      // Decode the base64 private key to binary
      // Kraken provides the private key as base64, we need to decode it correctly
      const secret = Buffer.from(privateKey, 'base64');
      
      // Create the HMAC
      const hash = crypto.createHash('sha256')
        .update(message, 'utf8')
        .digest('binary');
        
      const hmac = crypto.createHmac('sha512', secret)
        .update(path + hash, 'binary')
        .digest('base64');
      
      // Make API request
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'API-Key': apiKey,
          'API-Sign': hmac,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: postData
      });
      
      return response.data;
    } catch (error) {
      console.error('Kraken API request error:', error.message);
      
      if (error.response && error.response.data) {
        console.error('Kraken API error response:', error.response.data);
        return error.response.data;
      }
      
      throw error;
    }
  }
}

module.exports = KrakenAdapter; 