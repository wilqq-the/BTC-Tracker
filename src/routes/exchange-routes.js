const express = require('express');
const router = express.Router();
const exchangeService = require('../server/services/exchange-service');
const fs = require('fs');
const path = require('path');

// Constants
const DATA_DIR = path.join(__dirname, '../data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

// Middleware for authentication
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

/**
 * Load transactions from file or application memory
 * @param {Object} req - Express request object to access app
 * @returns {Array} Transactions
 */
function loadTransactions(req) {
  // First try to get transactions from the application memory if request is provided
  if (req && req.app && req.app.locals && typeof req.app.locals.getTransactions === 'function') {
    try {
      const appTransactions = req.app.locals.getTransactions();
      if (Array.isArray(appTransactions) && appTransactions.length > 0) {
        console.log(`[exchange-routes.js] Using ${appTransactions.length} transactions from application memory`);
        return appTransactions;
      }
    } catch (err) {
      console.error('[exchange-routes.js] Error accessing application transactions:', err);
    }
  }
  
  // Fall back to loading from file
  try {
    if (fs.existsSync(TRANSACTIONS_FILE)) {
      const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
      const fileTransactions = JSON.parse(data);
      
      // Ensure all transactions use normalized values
      const processedTransactions = fileTransactions.map(tx => {
        // Make sure price, cost, and fee use the normalized values
        if (tx.normalizedPrice !== undefined) {
          tx.price = tx.normalizedPrice;
        }
        
        if (tx.normalizedCost !== undefined) {
          tx.cost = tx.normalizedCost;
        }
        
        if (tx.normalizedFee !== undefined) {
          tx.fee = tx.normalizedFee;
        }
        
        return tx;
      });
      
      console.log(`[exchange-routes.js] Loaded ${processedTransactions.length} transactions from file with normalized values`);
      return processedTransactions;
    }
    console.log('[exchange-routes.js] No transactions file exists, returning empty array');
    return [];
  } catch (error) {
    console.error('[exchange-routes.js] Error loading transactions from file:', error);
    return [];
  }
}

/**
 * Save transactions to file
 * @param {Array} transactions - Transactions to save
 * @returns {boolean} Success status
 */
function saveTransactions(transactions) {
  try {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
    return true;
  } catch (error) {
    console.error('[exchange-routes.js] Error saving transactions:', error);
    return false;
  }
}

// Normalize transactions (make sure parent server.js exports this function)
function normalizeTransaction(tx, mainCurrency) {
  if (typeof global.normalizeTransaction === 'function') {
    return global.normalizeTransaction(tx, mainCurrency);
  }
  
  // Fallback implementation if global function not available
  console.warn('[exchange-routes.js] Global normalizeTransaction function not found, using fallback implementation');
  const originalCurrency = tx.currency || tx.fiatCurrency || 'EUR';
  return {
    ...tx,
    originalCurrency: originalCurrency,
    originalPrice: tx.price,
    originalCost: tx.cost,
    originalFee: tx.fee || 0,
    mainCurrency: mainCurrency,
    normalizedPrice: tx.price,
    normalizedCost: tx.cost,
    normalizedFee: tx.fee || 0,
    exchangeRate: 1
  };
}

// Get all available exchanges
router.get('/exchanges', isAuthenticated, (req, res) => {
  try {
    const exchanges = exchangeService.getAvailableExchanges();
    res.json(exchanges);
  } catch (error) {
    console.error('[exchange-routes.js] Error getting exchanges:', error);
    res.status(500).json({ error: 'Failed to get exchanges' });
  }
});

// Get a specific exchange
router.get('/exchanges/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const exchange = exchangeService.getExchange(id);
    
    if (!exchange) {
      return res.status(404).json({ error: 'Exchange not found' });
    }
    
    res.json({
      id,
      name: exchange.getName(),
      connected: exchange.getStatus()
    });
  } catch (error) {
    console.error('[exchange-routes.js] Error getting exchange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test exchange connection
router.post('/exchanges/:exchangeId/test', isAuthenticated, async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const credentials = req.body;
    
    // Log attempt (but not credentials)
    console.log(`[exchange-routes.js] Testing connection for ${exchangeId} with keys: ${Object.keys(credentials).join(', ')}`);
    
    // Get adapter class
    const exchange = exchangeService.getExchange(exchangeId);
    let adapter;
    
    if (exchange) {
      adapter = exchange;
    } else {
      const AdapterClass = exchangeService.getAdapterClass(exchangeId);
      if (!AdapterClass) {
        console.error(`[exchange-routes.js] No adapter found for exchange: ${exchangeId}`);
        return res.status(404).json({ error: 'Exchange not found' });
      }
      
      // Create temporary adapter for testing
      adapter = new AdapterClass();
      
      // Check for required credentials
      const requiredFields = adapter.getRequiredCredentials().map(field => field.key);
      const missingFields = requiredFields.filter(field => !credentials[field]);
      
      if (missingFields.length > 0) {
        console.error(`[exchange-routes.js] Missing required fields for ${exchangeId}: ${missingFields.join(', ')}`);
        return res.status(400).json({ 
          error: 'Missing required credentials',
          missingFields
        });
      }
    }
    
    // Test connection
    const valid = await adapter.testConnection(credentials);
    
    if (!valid) {
      console.log(`[exchange-routes.js] Connection test failed for ${exchangeId}`);
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'The provided API credentials were rejected by the exchange'
      });
    }
    
    console.log(`[exchange-routes.js] Connection test successful for ${exchangeId}`);
    res.json({ success: valid });
  } catch (error) {
    console.error(`[exchange-routes.js] Error testing exchange connection for ${req.params.exchangeId}:`, error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Save exchange credentials
router.post('/exchanges/:exchangeId/credentials', isAuthenticated, async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const credentials = req.body;
    
    // Validate that we have the required credentials
    if (!credentials || Object.keys(credentials).length === 0) {
      console.error(`[exchange-routes.js] Missing credentials for ${exchangeId}`);
      return res.status(400).json({ error: 'Missing credentials' });
    }
    
    // Log the keys we're receiving (but not the values for security)
    console.log(`[exchange-routes.js] Saving credentials for ${exchangeId}, keys: ${Object.keys(credentials).join(', ')}`);
    
    // Get adapter to check required fields
    const exchange = exchangeService.getExchange(exchangeId);
    if (!exchange) {
      const adapterClass = exchangeService.getAdapterClass(exchangeId);
      if (!adapterClass) {
        console.error(`[exchange-routes.js] No adapter found for exchange: ${exchangeId}`);
        return res.status(404).json({ error: 'Exchange not found' });
      }
      
      // Create temporary instance to get required credentials
      const tempAdapter = new adapterClass();
      const requiredFields = tempAdapter.getRequiredCredentials().map(field => field.key);
      
      // Validate we have all required fields
      const missingFields = requiredFields.filter(field => !credentials[field]);
      if (missingFields.length > 0) {
        console.error(`[exchange-routes.js] Missing required fields for ${exchangeId}: ${missingFields.join(', ')}`);
        return res.status(400).json({ 
          error: 'Missing required credentials',
          missingFields
        });
      }
    }
    
    // Save credentials
    const saved = await exchangeService.saveExchangeCredentials(exchangeId, credentials);
    
    if (!saved) {
      console.error(`[exchange-routes.js] Failed to save or validate credentials for ${exchangeId}`);
      return res.status(400).json({ error: 'Invalid credentials or failed to save' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error(`[exchange-routes.js] Error saving exchange credentials for ${req.params.exchangeId}:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Delete exchange credentials
router.delete('/exchanges/:exchangeId', isAuthenticated, (req, res) => {
  try {
    const { exchangeId } = req.params;
    
    // Remove exchange
    const removed = exchangeService.removeExchange(exchangeId);
    
    res.json({ success: removed });
  } catch (error) {
    console.error('[exchange-routes.js] Error deleting exchange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get exchange balances
router.get('/exchanges/:exchangeId/balances', isAuthenticated, async (req, res) => {
  try {
    const { exchangeId } = req.params;
    
    // Get balances
    const balances = await exchangeService.getExchangeBalances(exchangeId);
    
    res.json(balances);
  } catch (error) {
    console.error('[exchange-routes.js] Error getting exchange balances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync transactions from exchange
router.post('/exchanges/:exchangeId/sync', isAuthenticated, async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const options = req.body || {};
    
    // Log the received options for debugging
    console.log(`[exchange-routes.js] Received sync options for ${exchangeId}:`, options);
    
    // Sanitize date inputs if present
    if (options.startDate) {
      try {
        // If it's a string, parse it
        if (typeof options.startDate === 'string') {
          const date = new Date(options.startDate);
          if (!isNaN(date.getTime())) {
            options.startDate = date.toISOString().split('T')[0]; // Keep date part only
            console.log(`[exchange-routes.js] Parsed startDate to: ${options.startDate}`);
          } else {
            delete options.startDate;
            console.warn(`[exchange-routes.js] Invalid startDate provided: ${options.startDate}`);
          }
        }
      } catch (err) {
        delete options.startDate;
        console.error('[exchange-routes.js] Error parsing startDate:', err);
      }
    }
    
    if (options.endDate) {
      try {
        // If it's a string, parse it
        if (typeof options.endDate === 'string') {
          const date = new Date(options.endDate);
          if (!isNaN(date.getTime())) {
            options.endDate = date.toISOString().split('T')[0]; // Keep date part only
            console.log(`[exchange-routes.js] Parsed endDate to: ${options.endDate}`);
          } else {
            delete options.endDate;
            console.warn(`[exchange-routes.js] Invalid endDate provided: ${options.endDate}`);
          }
        }
      } catch (err) {
        delete options.endDate;
        console.error('[exchange-routes.js] Error parsing endDate:', err);
      }
    }
    
    // Get transactions from exchange
    const newTransactions = await exchangeService.getExchangeTransactions(exchangeId, options);
    
    if (!newTransactions || newTransactions.length === 0) {
      return res.json({ success: true, added: 0, transactions: [] });
    }
    
    // Standardize transaction format for compatibility with the UI
    const standardizedTransactions = newTransactions.map(tx => {
      // Add exchange identifier to transaction if not present
      if (!tx.exchange) {
        tx.exchange = exchangeId;
      }
      
      // Create a standardized transaction with basic fixes
      const standardTx = { ...tx };
      
      // If the transaction has 'total' but not 'cost', add 'cost' property
      if (standardTx.total !== undefined && standardTx.cost === undefined) {
        standardTx.cost = standardTx.total;
      }
      
      // Ensure all critical fields are present
      if (standardTx.currency === undefined) {
        // Use fiatCurrency from the exchange if available, otherwise default to EUR
        standardTx.currency = standardTx.fiatCurrency || 'EUR';
      }
      
      // Load settings to get main currency
      const appSettingsPath = path.join(DATA_DIR, 'app-settings.json');
      let mainCurrency = 'EUR'; // Default to EUR
      
      try {
        if (fs.existsSync(appSettingsPath)) {
          const settingsData = fs.readFileSync(appSettingsPath, 'utf8');
          const settings = JSON.parse(settingsData);
          mainCurrency = settings.mainCurrency || 'EUR';
        }
      } catch (error) {
        console.error('[exchange-routes.js] Error loading app settings:', error);
      }
      
      // For binance transactions, ensure the price is properly converted to the main currency
      // This is especially important for fiat purchases like those in the transactions.json example
      if (standardTx.exchange === 'binance' && standardTx.type === 'buy' && standardTx.currency !== mainCurrency) {
        console.log(`[exchange-routes.js] Processing Binance transaction: ID=${standardTx.id}, Currency=${standardTx.currency}, Amount=${standardTx.amount}, Price=${standardTx.price}`);
        
        // Try to use the global normalizeTransaction function from server.js
        if (typeof global.normalizeTransaction === 'function') {
          const normalizedTx = global.normalizeTransaction(standardTx, mainCurrency);
          console.log(`[exchange-routes.js] Normalized with global function: Original=${standardTx.price} ${standardTx.currency}, Normalized=${normalizedTx.normalizedPrice} ${mainCurrency}`);
          return normalizedTx;
        } else {
          // Fallback to local implementation
          console.log('[exchange-routes.js] Global normalizeTransaction not available, using local implementation');
          
          // Get priceCache for currency conversion
          const priceCache = require('../server/priceCache');
          const exchangeRate = priceCache.getExchangeRate(standardTx.currency, mainCurrency);
          
          if (exchangeRate) {
            // Calculate normalized values
            const normalizedPrice = standardTx.price * exchangeRate;
            const normalizedCost = standardTx.cost * exchangeRate;
            const normalizedFee = (standardTx.fee || 0) * exchangeRate;
            
            // Create normalized transaction
            const normalizedTx = {
              ...standardTx,
              originalCurrency: standardTx.currency,
              originalPrice: standardTx.price,
              originalCost: standardTx.cost,
              originalFee: standardTx.fee || 0,
              mainCurrency,
              normalizedPrice,
              normalizedCost,
              normalizedFee,
              exchangeRate,
              // Update regular fields for backward compatibility
              price: normalizedPrice,
              cost: normalizedCost
            };
            
            console.log(`[exchange-routes.js] Manual conversion: ${standardTx.price} ${standardTx.currency} → ${normalizedPrice} ${mainCurrency} (rate: ${exchangeRate})`);
            return normalizedTx;
          }
        }
      } else {
        // For transactions already in the main currency or from other exchanges,
        // still use the global normalize function to maintain consistency
        if (typeof global.normalizeTransaction === 'function') {
          return global.normalizeTransaction(standardTx, mainCurrency);
        }
      }
      
      // If no conversion happened, return original
      return standardTx;
    });
    
    // Log the standardized transactions for debugging
    console.log(`[exchange-routes.js] Standardized ${standardizedTransactions.length} transactions from ${exchangeId}`);
    
    // Load existing transactions
    const existingTransactions = loadTransactions(req);
    
    // Track which transactions were added
    const addedTransactions = [];
    
    // Add new transactions (check for duplicates)
    for (const newTx of standardizedTransactions) {
      // Ensure the transaction uses the normalized values for price, cost, and fee
      if (newTx.normalizedPrice !== undefined) {
        newTx.price = newTx.normalizedPrice;
      }
      
      if (newTx.normalizedCost !== undefined) {
        newTx.cost = newTx.normalizedCost;
      }
      
      if (newTx.normalizedFee !== undefined) {
        newTx.fee = newTx.normalizedFee;
      }
      
      // Skip if transaction already exists based on ID
      const isDuplicate = existingTransactions.some(tx => tx.id === newTx.id);
      
      if (!isDuplicate) {
        existingTransactions.push(newTx);
        addedTransactions.push(newTx);
        // For Kraken transactions, log with more details
        if (newTx.exchange === 'kraken' && newTx.krakenData) {
          console.log(`[exchange-routes.js] Added new Kraken transaction: ${newTx.type} ${newTx.amount} BTC at ${newTx.price} ${newTx.original?.currency || 'Unknown'} (Order ID: ${newTx.krakenData.ordertxid}, Trade ID: ${newTx.krakenData.txid})`);
        } else {
          console.log(`[exchange-routes.js] Added new transaction: ${newTx.exchange} ${newTx.type} ${newTx.amount} BTC at ${newTx.price} ${newTx.original?.currency || 'Unknown'}`);
        }
      } else {
        // Log the duplicate
        console.log(`[exchange-routes.js] Skipping duplicate transaction by ID: ${newTx.id}`);
      }
    }
    
    // Save updated transactions
    saveTransactions(existingTransactions);
    
    // Important: Update the main application's transactions array
    // This ensures the server's in-memory transactions match what's on disk
    try {
      // This will update the transactions in server.js
      // Get a reference to the main application
      const app = req.app;
      if (app.locals.updateTransactions) {
        app.locals.updateTransactions(existingTransactions);
      } else {
        console.warn('[exchange-routes.js] Unable to update application transactions array - function not available');
      }
    } catch (error) {
      console.error('[exchange-routes.js] Error updating application transactions array:', error);
    }
    
    res.json({ 
      success: true, 
      added: addedTransactions.length,
      transactions: addedTransactions
    });
  } catch (error) {
    console.error('[exchange-routes.js] Error syncing exchange transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 