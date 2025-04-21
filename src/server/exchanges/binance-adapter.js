const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');
const ExchangeAdapter = require('./exchange-adapter');
const credentialManager = require('../services/credential-manager');
const Transaction = require('../models/Transaction');
const currencyConverter = require('../services/currency-converter');

/**
 * BinanceAdapter - Implementation of ExchangeAdapter for Binance exchange
 */
class BinanceAdapter extends ExchangeAdapter {
    /**
     * Constructor for Binance adapter
     * @param {Object} config - Configuration for Binance
     */
    constructor(config = {}) {
        super(config);
        this.name = 'Binance';
        this.baseUrl = 'https://api.binance.com';
        this.apiVersion = 'v3';
        this.credentials = null;
    }

    /**
     * Get required API credential fields for Binance
     * @returns {Array} Array of required credential fields
     */
    getRequiredCredentials() {
        return [
            { key: 'apiKey', label: 'API Key', type: 'text' },
            { key: 'apiSecret', label: 'API Secret', type: 'password', help: 'The API Secret from your Binance account' }
        ];
    }

    /**
     * Connect to Binance using stored credentials
     * @returns {Promise<boolean>} True if connection successful
     */
    async connect() {
        try {
            // Get credentials - FIXED: Added await here since getCredentials is async
            this.credentials = await credentialManager.getCredentials('binance');
            
            if (!this.credentials) {
                console.error('No Binance credentials found');
                this.isConnected = false;
                return false;
            }
            
            console.log('Loaded Binance credentials, API Key starts with:', this.credentials.apiKey.substring(0, 5));
            
            // Test credentials by fetching account info
            const result = await this.testConnection(this.credentials);
            this.isConnected = result;
            
            return result;
        } catch (error) {
            console.error('Error connecting to Binance:', error);
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
            if (process.env.NODE_ENV === 'development' && credentials.apiKey === 'test' && credentials.apiSecret === 'test') {
                console.log('Using TEST MODE for Binance');
                return true;
            }
            
            // Check the minimum required fields
            if (!credentials.apiKey || !credentials.apiSecret) {
                console.error('Missing API Key or API Secret for Binance connection test');
                return false;
            }
            
            console.log(`Testing Binance connection with API Key: ${credentials.apiKey.substring(0, 5)}...`);
            
            // Make a simple request to test credentials
            const response = await this._privateRequest('/api/v3/account', {}, credentials);
            
            // Check if the response contains an error
            if (response.code && response.code < 0) {
                console.error('Binance API returned an error:', response.msg);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error testing Binance connection:', error.message);
            return false;
        }
    }

    /**
     * Fetch transactions from Binance
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
                throw new Error('Not connected to Binance');
            }
            
            console.log('Received sync options for binance:', options);
            
            // Parse dates
            let startDate = null;
            let endDate = null;
            
            if (options.startDate) {
                try {
                    startDate = typeof options.startDate === 'string' 
                        ? new Date(options.startDate) 
                        : options.startDate;
                        
                    if (startDate instanceof Date && !isNaN(startDate.getTime())) {
                        console.log('Parsed startDate to:', startDate.toISOString().split('T')[0]);
                    } else {
                        console.warn('Invalid startDate format, ignoring:', options.startDate);
                        startDate = null;
                    }
                } catch (err) {
                    console.error('Failed to parse startDate:', err);
                    startDate = null;
                }
            }
            
            if (options.endDate) {
                try {
                    endDate = typeof options.endDate === 'string' 
                        ? new Date(options.endDate) 
                        : options.endDate;
                        
                    if (endDate instanceof Date && !isNaN(endDate.getTime())) {
                        console.log('Parsed endDate to:', endDate.toISOString().split('T')[0]);
                    } else {
                        console.warn('Invalid endDate format, ignoring:', options.endDate);
                        endDate = null;
                    }
                } catch (err) {
                    console.error('Failed to parse endDate:', err);
                    endDate = null;
                }
            }
            
            // If no end date, use current date
            if (!endDate) {
                endDate = new Date();
            }
            
            // If no start date, use default date range (30 days before end date)
            if (!startDate) {
                    startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 30);
            }
            
            // Ensure endDate is after startDate
            if (endDate < startDate) {
                console.warn('End date is before start date. Swapping dates.');
                const temp = startDate;
                startDate = endDate;
                endDate = temp;
            }
            
            // Check if time range exceeds 30 days
            const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
            console.log(`Date range spans ${daysDiff} days`);
            
            // Collect all transactions
            let allTransactions = [];
            
            // 1. Get spot trades (24-hour chunks)
            if (daysDiff > 0) {
                console.log('Getting spot trades with 24-hour chunks');
                // Create 24-hour chunks for spot trades
                const spotTradeChunks = this._splitDateRange(startDate, endDate, 1); // 1 day chunks
                console.log(`Split date range into ${spotTradeChunks.length} spot trade chunks`);
                
                // Process each chunk for spot trades
                for (const chunk of spotTradeChunks) {
                    const chunkStart = chunk.start;
                    const chunkEnd = chunk.end;
                    console.log(`Processing spot trades chunk: ${chunkStart.toISOString().split('T')[0]} to ${chunkEnd.toISOString().split('T')[0]}`);
                    
                    // Collect spot trades for this chunk
                    const spotTrades = await this._getSpotTrades(chunkStart, chunkEnd);
                    allTransactions = allTransactions.concat(spotTrades);
                }
            }
            
            // 2. Get fiat orders and other transaction types (30-day chunks)
            const otherChunks = this._splitDateRange(startDate, endDate, 30); // 30-day chunks
            console.log(`Split date range into ${otherChunks.length} chunks for other transaction types`);
            
            // Process each chunk for other transaction types
            for (const chunk of otherChunks) {
                const chunkStart = chunk.start;
                const chunkEnd = chunk.end;
                console.log(`Processing other transactions chunk: ${chunkStart.toISOString().split('T')[0]} to ${chunkEnd.toISOString().split('T')[0]}`);
                
                // Get non-spot transactions
                const fiatTransactions = await this._getFiatTransactions(chunkStart, chunkEnd);
                const depositTransactions = await this._getDepositHistory(chunkStart, chunkEnd);
                const buyCryptoTransactions = await this._getBuyCryptoHistory(chunkStart, chunkEnd);
                
                // Add all transaction types to the result
                allTransactions = allTransactions.concat(
                    fiatTransactions,
                    depositTransactions,
                    buyCryptoTransactions
                );
            }
            
            // Sort by date
            allTransactions.sort((a, b) => a.date - b.date);
            
            // Filter to keep only buy transactions and skip withdrawals
            allTransactions = allTransactions.filter(tx => {
                // Keep only buy transactions
                if (tx.type !== 'buy') {
                    console.log(`Skipping non-buy transaction type: ${tx.type}`);
                    return false;
                }
                
                // Skip withdrawals
                if (tx.txType === 'withdrawal') {
                    console.log('Skipping withdrawal transaction');
                    return false;
                }
                
                return true;
            });
            
            console.log(`After filtering, ${allTransactions.length} buy transactions remain`);
            
            // Ensure we have latest exchange rates
            await currencyConverter.ensureRates();
            
            // Convert to Transaction model instances with proper structure
            return allTransactions.map(tx => {
                // Determine the original currency from the transaction
                const originalCurrency = tx.currency || tx.quoteCurrency || 'USDT';
                
                // Create transaction data object
                const transactionData = {
                    id: tx.id,
                    exchange: tx.exchange,
                    type: tx.type,
                    amount: tx.amount,
                    date: tx.date,
                    txType: tx.txType || 'spot',
                    status: tx.status || 'Completed',
                    paymentMethod: tx.paymentMethod,
                    
                    // Set original values properly
                    original: {
                        currency: originalCurrency,
                        price: tx.price || 0,
                        cost: tx.cost || 0,
                        fee: tx.fee || 0
                    },
                    
                    pair: tx.pair,
                    baseCurrency: tx.baseCurrency,
                    quoteCurrency: tx.quoteCurrency
                };
                
                // Calculate base currencies (EUR and USD)
                // Convert to EUR if not already EUR
                if (originalCurrency.toUpperCase() !== 'EUR') {
                    try {
                        const eurValues = currencyConverter.convertValues({
                            price: transactionData.original.price,
                            cost: transactionData.original.cost,
                            fee: transactionData.original.fee || 0
                        }, originalCurrency, 'EUR');
                        
                        transactionData.base = {
                            eur: {
                                price: eurValues.price,
                                cost: eurValues.cost,
                                fee: eurValues.fee,
                                rate: eurValues.rate
                            }
                        };
                    } catch (error) {
                        console.error(`Error converting ${originalCurrency} to EUR:`, error.message);
                        // Set default values
                        transactionData.base = {
                            eur: {
                                price: 0,
                                cost: 0,
                                fee: 0,
                                rate: 0
                            }
                        };
                    }
                } else {
                    // Already EUR, use original values
                    transactionData.base = {
                        eur: {
                            price: transactionData.original.price,
                            cost: transactionData.original.cost,
                            fee: transactionData.original.fee,
                            rate: 1.0
                        }
                    };
                }
                
                // Convert to USD if not already USD
                if (originalCurrency.toUpperCase() !== 'USD') {
                    try {
                        const usdValues = currencyConverter.convertValues({
                            price: transactionData.original.price,
                            cost: transactionData.original.cost,
                            fee: transactionData.original.fee || 0
                        }, originalCurrency, 'USD');
                        
                        transactionData.base.usd = {
                            price: usdValues.price,
                            cost: usdValues.cost,
                            fee: usdValues.fee,
                            rate: usdValues.rate
                        };
                    } catch (error) {
                        console.error(`Error converting ${originalCurrency} to USD:`, error.message);
                        // Set default values
                        transactionData.base.usd = {
                            price: 0,
                            cost: 0,
                            fee: 0,
                            rate: 0
                        };
                    }
                } else {
                    // Already USD, use original values
                    transactionData.base.usd = {
                        price: transactionData.original.price,
                        cost: transactionData.original.cost,
                        fee: transactionData.original.fee,
                        rate: 1.0
                    };
                }
                
                // Create Transaction instance
                return new Transaction(transactionData);
            });
        } catch (error) {
            console.error('Error fetching Binance transactions:', error);
            return [];
        }
    }

    /**
     * Split a date range into chunks of a specified number of days
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {number} chunkSizeDays - Size of each chunk in days
     * @returns {Array<Object>} Array of {start, end} date pairs
     */
    _splitDateRange(startDate, endDate, chunkSizeDays = 30) {
        const chunks = [];
        let currentStartDate = new Date(startDate);
        
        while (currentStartDate < endDate) {
            // Calculate the end date for this chunk
            const chunkEndDate = new Date(currentStartDate);
            chunkEndDate.setDate(chunkEndDate.getDate() + chunkSizeDays);
            
            // If chunk end date exceeds the overall end date, use the overall end date
            const actualEndDate = (chunkEndDate > endDate) ? new Date(endDate) : chunkEndDate;
            
            // Add this chunk to the list
            chunks.push({
                start: new Date(currentStartDate),
                end: new Date(actualEndDate)
            });
            
            // Move to the next chunk
            currentStartDate = new Date(actualEndDate);
            
            // Avoid infinite loop if dates are the same
            if (currentStartDate.getTime() === actualEndDate.getTime()) {
                currentStartDate.setDate(currentStartDate.getDate() + 1);
            }
        }
        
        return chunks;
    }

    /**
     * Get spot trades for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Array of spot trade transactions
     */
    async _getSpotTrades(startDate, endDate) {
        try {
            // Prepare parameters
            const params = {};
            
            if (startDate) {
                params.startTime = startDate.getTime();
            }
            
            if (endDate) {
                params.endTime = endDate.getTime();
            }
            
            // Validate time range - Binance spot trades have 24-hour limit
            const hoursDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60));
            if (hoursDiff > 24) {
                console.warn('Date range for spot trades exceeds 24 hours. This should not happen due to chunking.');
                // Adjust to exactly 24 hours
                params.endTime = params.startTime + (24 * 60 * 60 * 1000);
            }
            
            let spotTransactions = [];
            const commonBtcPairs = ['BTCUSDT', 'BTCBUSD', 'BTCUSDC', 'BTCEUR', 'BTCGBP'];
            
            // Get spot trades for each BTC pair
            for (const symbol of commonBtcPairs) {
                try {
                    const spotParams = {
                        ...params,
                        symbol,
                        limit: 1000
                    };
                    
                    const spotTrades = await this._privateRequest('/api/v3/myTrades', spotParams);
                    
                    if (Array.isArray(spotTrades)) {
                        console.log(`Got ${spotTrades.length} trades from Binance spot account for ${symbol}`);
                        
                        // Transform to our format
                        for (const trade of spotTrades) {
                            const tx = this.transformSpotTransaction(trade);
                            if (tx) {
                                spotTransactions.push(tx);
                            }
                        }
                    }
                } catch (error) {
                    if (error.message.includes('Invalid symbol')) {
                        console.warn(`Trading pair ${symbol} not found or no trades available`);
                    } else {
                        console.error(`Error fetching Binance spot trades for ${symbol}:`, error.message);
                    }
                }
            }
            
            return spotTransactions;
        } catch (error) {
            console.error('Error fetching spot trades:', error);
            return [];
        }
    }

    /**
     * Get fiat transactions for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Array of fiat transactions
     */
    async _getFiatTransactions(startDate, endDate) {
        try {
            // Prepare parameters
            const params = {};
            
            if (startDate) {
                params.startTime = startDate.getTime();
            }
            
            if (endDate) {
                params.endTime = endDate.getTime();
            }
            
            // Check if time range exceeds 30 days
            const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > 30) {
                console.warn('Date range for fiat transactions exceeds 30 days. Limiting to 30 days.');
                params.endTime = params.startTime + (30 * 24 * 60 * 60 * 1000);
            }
            
            let fiatTransactions = [];
            
            // 1. Get fiat purchase/sell orders
            try {
                const fiatParams = {
                    ...params,
                    transactionType: 0,  // 0: buy, 1: sell
                    asset: 'BTC',
                    limit: 100
                };
                
                // Get BTC purchase with fiat
                const fiatOrders = await this._privateRequest('/sapi/v1/fiat/orders', fiatParams);
                
                if (fiatOrders && fiatOrders.data && Array.isArray(fiatOrders.data)) {
                    console.log(`Got ${fiatOrders.data.length} fiat BTC purchases from Binance`);
                    
                    // Transform to our format
                    for (const order of fiatOrders.data) {
                        if (order.status === 'Completed') {
                            const tx = this.transformFiatTransaction(order, 'buy');
                            if (tx) {
                                fiatTransactions.push(tx);
                            }
                        }
                    }
                }
                
                // Get BTC sales for fiat
                fiatParams.transactionType = 1; // 1 for sell
                const fiatSellOrders = await this._privateRequest('/sapi/v1/fiat/orders', fiatParams);
                
                if (fiatSellOrders && fiatSellOrders.data && Array.isArray(fiatSellOrders.data)) {
                    console.log(`Got ${fiatSellOrders.data.length} fiat BTC sales from Binance`);
                    
                    // Transform to our format
                    for (const order of fiatSellOrders.data) {
                        if (order.status === 'Completed') {
                            const tx = this.transformFiatTransaction(order, 'sell');
                            if (tx) {
                                fiatTransactions.push(tx);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching Binance fiat orders:', error.message);
                }
                
            // 2. Get fiat payments
                try {
                    const paymentParams = {
                        transactionType: 0, // 0-buy, 1-sell
                        rows: 100,
                        timestamp: Date.now()
                    };
                    
                    // Convert startTime and endTime to beginTime and endTime format
                    if (params.startTime) {
                        paymentParams.beginTime = params.startTime;
                    }
                    
                    if (params.endTime) {
                        paymentParams.endTime = params.endTime;
                    }
                    
                    console.log('Fetching fiat payments with params:', paymentParams);
                    
                    // Get all fiat payment records (includes bank transfers and card purchases)
                    const fiatPayments = await this._privateRequest('/sapi/v1/fiat/payments', paymentParams);
                    
                    if (fiatPayments && fiatPayments.data && Array.isArray(fiatPayments.data)) {
                        console.log(`Got ${fiatPayments.data.length} fiat payment records from Binance`);
                        
                        // Filter for BTC purchases only
                        const btcPayments = fiatPayments.data.filter(payment => 
                            payment.cryptoCurrency === 'BTC' && payment.status === 'Completed'
                        );
                        
                        console.log(`Filtered to ${btcPayments.length} BTC fiat payment records`);
                        
                        // Transform to our format
                        for (const payment of btcPayments) {
                            const tx = this.transformFiatPayment(payment);
                            if (tx) {
                            fiatTransactions.push(tx);
                            }
                        }
                    }
                    
                    // Also get sell transactions
                    paymentParams.transactionType = 1; // 1-sell
                    const fiatSellPayments = await this._privateRequest('/sapi/v1/fiat/payments', paymentParams);
                    
                    if (fiatSellPayments && fiatSellPayments.data && Array.isArray(fiatSellPayments.data)) {
                        console.log(`Got ${fiatSellPayments.data.length} fiat sell payment records from Binance`);
                        
                        // Filter for BTC sales only
                        const btcSellPayments = fiatSellPayments.data.filter(payment => 
                            payment.cryptoCurrency === 'BTC' && payment.status === 'Completed'
                        );
                        
                        console.log(`Filtered to ${btcSellPayments.length} BTC fiat sell payment records`);
                        
                        // Transform to our format with sell type
                        for (const payment of btcSellPayments) {
                            const tx = this.transformFiatPayment(payment, 'sell');
                            if (tx) {
                            fiatTransactions.push(tx);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching Binance fiat payment records:', error.message);
                }
                
            // 3. Try the convert history endpoint
                try {
                    const convertParams = {
                        ...params,
                        limit: 100
                    };
                    
                    // Get convert trade history
                    const converts = await this._privateRequest('/sapi/v1/convert/tradeFlow', convertParams);
                    
                    if (converts && converts.list && Array.isArray(converts.list)) {
                        console.log(`Got ${converts.list.length} convert records from Binance`);
                        
                        // Filter for BTC conversions
                        const btcConverts = converts.list.filter(convert => 
                            (convert.fromAsset === 'BTC' || convert.toAsset === 'BTC') && 
                            convert.status === 'SUCCESS'
                        );
                        
                        console.log(`Filtered to ${btcConverts.length} BTC convert records`);
                        
                        // Transform to our format
                        for (const convert of btcConverts) {
                            const tx = this.transformConvertTransaction(convert);
                            if (tx) {
                            fiatTransactions.push(tx);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching Binance convert history:', error.message);
                }
            
            return fiatTransactions;
            } catch (error) {
            console.error('Error fetching fiat transactions:', error);
            return [];
        }
    }

    /**
     * Get deposit history for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Array of deposit transactions
     */
    async _getDepositHistory(startDate, endDate) {
        try {
            // Prepare parameters
            const params = {};
            
            if (startDate) {
                params.startTime = startDate.getTime();
            }
            
            if (endDate) {
                params.endTime = endDate.getTime();
            }
            
            // Check if time range exceeds 90 days (Binance deposit history limit)
            const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > 90) {
                console.warn('Date range for deposit history exceeds 90 days. Limiting to 90 days.');
                params.endTime = params.startTime + (90 * 24 * 60 * 60 * 1000);
            }
            
            let depositTransactions = [];
            
                const depositParams = { 
                    ...params,
                    coin: 'BTC'
                };
                
                const deposits = await this._privateRequest('/sapi/v1/capital/deposit/hisrec', depositParams);
                
                if (Array.isArray(deposits)) {
                    console.log(`Got ${deposits.length} BTC deposits from Binance`);
                    
                    // Transform to our format - only include completed deposits (which are buy transactions)
                    for (const deposit of deposits) {
                        if (deposit.status === 1) { // Completed deposits only
                            const tx = this.transformDepositWithdrawal(deposit, 'deposit');
                            if (tx) {
                            depositTransactions.push(tx);
                            }
                        }
                    }
                }
            
            return depositTransactions;
            } catch (error) {
            console.error('Error fetching deposit history:', error);
            return [];
        }
    }

    /**
     * Get Buy Crypto history for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Array of Buy Crypto transactions
     */
    async _getBuyCryptoHistory(startDate, endDate) {
        try {
            // Prepare parameters
                const buyCryptoParams = {
                    crypto: 'BTC',
                    timestamp: Date.now(),
                    limit: 100
                };
                
                // Set time range if available
            if (startDate) {
                buyCryptoParams.startTimestamp = startDate.getTime();
                }
                
            if (endDate) {
                buyCryptoParams.endTimestamp = endDate.getTime();
                }
                
                console.log('Fetching Buy Crypto history with params:', buyCryptoParams);
            
            let buyCryptoTransactions = [];
                
                // Get Buy Crypto history
                const buyCryptoHistory = await this._privateRequest('/sapi/v1/fiat/history', buyCryptoParams);
                
                if (buyCryptoHistory && buyCryptoHistory.data && Array.isArray(buyCryptoHistory.data)) {
                    console.log(`Got ${buyCryptoHistory.data.length} Buy Crypto records from Binance`);
                    
                    // Transform to our format
                    for (const purchase of buyCryptoHistory.data) {
                        if (purchase.status === 'Successful' || purchase.status === 'Completed') {
                            const tx = this.transformBuyCryptoTransaction(purchase);
                            if (tx) {
                            buyCryptoTransactions.push(tx);
                        }
                    }
                }
            }
            
            return buyCryptoTransactions;
                    } catch (error) {
            console.error('Error fetching Buy Crypto history:', error);
            return [];
        }
    }

    /**
     * Fetch balances from Binance
     * @returns {Promise<Object>} Standardized balances object
     */
    async getBalances() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            
            if (!this.isConnected) {
                throw new Error('Not connected to Binance');
            }
            
            // Get account information
            const account = await this._privateRequest('/api/v3/account');
            
            // Extract balances
            const balances = {};
            
            if (account && account.balances) {
                for (const balance of account.balances) {
                    // Only include non-zero balances
                    const total = parseFloat(balance.free) + parseFloat(balance.locked);
                    if (total > 0) {
                        balances[balance.asset] = total;
                    }
                }
            }
            
            // If BTC is not included, add it as 0
            if (!balances.BTC) {
                balances.BTC = 0;
            }
            
            return balances;
        } catch (error) {
            console.error('Error fetching Binance balances:', error);
            return { BTC: 0 };
        }
    }

    /**
     * Transform a spot transaction to standardized format
     * @param {Object} trade - Binance trade object
     * @returns {Object|null} Standardized transaction object or null if invalid
     */
    transformSpotTransaction(trade) {
        try {
            if (!trade.symbol || !trade.price || !trade.qty) {
                console.error('Invalid trade data from Binance:', trade);
                return null;
            }
            
            // Extract currency pair
            const symbol = trade.symbol; // e.g., BTCUSDT
            
            // Determine if this is a BTC transaction
            if (!symbol.includes('BTC')) {
                console.debug(`Skipping non-BTC trade: ${symbol}`);
                return null;
            }
            
            // Determine base and quote currencies
            let baseCurrency, quoteCurrency;
            
            if (symbol.startsWith('BTC')) {
                // Format: BTCUSDT
                baseCurrency = 'BTC';
                quoteCurrency = symbol.substring(3); // e.g., USDT
            } else if (symbol.endsWith('BTC')) {
                // Format: ETHBTC
                baseCurrency = symbol.substring(0, symbol.length - 3); // e.g., ETH
                quoteCurrency = 'BTC';
            } else {
                console.debug(`Cannot determine currencies from symbol: ${symbol}`);
                return null;
            }
            
            // We only want transactions where BTC is involved
            if (baseCurrency !== 'BTC' && quoteCurrency !== 'BTC') {
                console.debug(`Skipping trade without BTC: ${symbol}`);
                return null;
            }
            
            // Determine transaction type
            // If baseCurrency is BTC and isBuyer is true, user is buying BTC
            // If baseCurrency is BTC and isBuyer is false, user is selling BTC
            // If quoteCurrency is BTC and isBuyer is true, user is selling the base currency for BTC
            // If quoteCurrency is BTC and isBuyer is false, user is buying the base currency with BTC
            let type, amount, price, cost;
            
            if (baseCurrency === 'BTC') {
                if (trade.isBuyer) {
                    type = 'buy';
                    amount = parseFloat(trade.qty);
                    price = parseFloat(trade.price);
                    cost = amount * price;
                } else {
                    type = 'sell';
                    amount = parseFloat(trade.qty);
                    price = parseFloat(trade.price);
                    cost = amount * price;
                }
            } else { // quoteCurrency === 'BTC'
                if (trade.isBuyer) {
                    type = 'sell'; // Selling BTC to buy the base currency
                    amount = parseFloat(trade.qty) * parseFloat(trade.price); // BTC amount
                    price = 1 / parseFloat(trade.price); // Convert to BTC price
                    cost = amount * price;
                } else {
                    type = 'buy'; // Buying BTC by selling the base currency
                    amount = parseFloat(trade.qty) * parseFloat(trade.price); // BTC amount
                    price = 1 / parseFloat(trade.price); // Convert to BTC price
                    cost = amount * price;
                }
            }
            
            // Extract other fields
            const fee = parseFloat(trade.commission || 0);
            const date = new Date(trade.time);
            const tradeCurrency = baseCurrency === 'BTC' ? quoteCurrency : baseCurrency;
            
            // Create standardized transaction object
            return {
                id: trade.id.toString(),
                exchange: 'binance',
                type,
                amount,
                price,
                cost,
                fee,
                date,
                pair: `${baseCurrency}/${quoteCurrency}`,
                baseCurrency,
                quoteCurrency,
                currency: tradeCurrency,
                
                // Add fields to match with Kraken format
                originalCurrency: tradeCurrency,
                originalPrice: price,
                originalCost: cost,
                originalFee: fee
            };
        } catch (error) {
            console.error('Error transforming Binance spot transaction:', error);
            return null;
        }
    }

    /**
     * Transform a deposit or withdrawal to standardized format
     * @param {Object} operation - Binance deposit/withdrawal object
     * @param {string} type - 'deposit' or 'withdrawal'
     * @returns {Object|null} Standardized transaction object or null if invalid
     */
    transformDepositWithdrawal(operation, type) {
        try {
            if (!operation.coin || operation.coin !== 'BTC' || !operation.amount) {
                console.debug(`Skipping non-BTC ${type}:`, operation);
                return null;
            }
            
            const amount = parseFloat(operation.amount);
            const fee = parseFloat(operation.transactionFee || 0);
            
            // Use inserted time or apply time or current time
            const timestamp = operation.insertTime || operation.applyTime || Date.now();
            const date = new Date(timestamp);
            
            // For deposits, we "buy" BTC, for withdrawals we "sell" BTC
            const txType = type === 'deposit' ? 'buy' : 'sell';
            
            return {
                id: operation.txId || operation.id.toString(),
                exchange: 'binance',
                type: txType,
                amount,
                price: 0, // Price is not available for deposits/withdrawals
                cost: 0, // Cost is not available for deposits/withdrawals
                fee,
                date,
                pair: 'BTC/FIAT', // Generic pair for deposits/withdrawals
                baseCurrency: 'BTC',
                quoteCurrency: 'FIAT',
                txType: type, // Additional field to indicate this is a deposit/withdrawal
                currency: 'FIAT',
                
                // Add fields to match with Kraken format
                originalCurrency: 'FIAT',
                originalPrice: 0,
                originalCost: 0,
                originalFee: fee
            };
        } catch (error) {
            console.error(`Error transforming Binance ${type}:`, error);
            return null;
        }
    }

    /**
     * Transform a fiat transaction to standardized format
     * @param {Object} order - Binance fiat order
     * @param {string} requestType - 'buy' or 'sell'
     * @returns {Object|null} Standardized transaction object or null if invalid
     */
    transformFiatTransaction(order, requestType) {
        try {
            if (!order.cryptoCurrency || order.cryptoCurrency !== 'BTC') {
                console.debug(`Skipping non-BTC fiat order:`, order);
                return null;
            }
            
            // For BTC purchases with fiat, we need to extract:
            // - The amount of BTC purchased
            // - The fiat currency and amount
            // - The date of the transaction
            // - Any fees
            
            const btcAmount = parseFloat(order.obtainAmount);
            const fiatAmount = parseFloat(order.totalPrice);
            const fiatCurrency = order.fiatCurrency || 'FIAT';
            const date = new Date(order.updateTime);
            
            // Calculate fee if available (might be in fiat currency)
            let fee = 0;
            if (order.commission) {
                fee = parseFloat(order.commission);
            }
            
            // Transaction type is based on the request type
            // For Buy: We're buying BTC with fiat
            // For Sell: We're selling BTC for fiat
            const type = requestType === 'buy' ? 'buy' : 'sell';
            
            return {
                id: order.orderNo,
                exchange: 'binance',
                type: type,
                amount: btcAmount,
                price: fiatAmount / btcAmount, // Price per BTC in fiat
                cost: fiatAmount,
                fee: fee,
                date: date,
                pair: `BTC/${fiatCurrency}`,
                baseCurrency: 'BTC',
                quoteCurrency: fiatCurrency,
                txType: 'fiat_trade',
                status: order.status || 'Completed',
                paymentMethod: order.payMethod || 'Fiat Order',
                currency: fiatCurrency, // Set currency directly to the fiat currency
                
                // Add fields to match with Kraken format
                originalCurrency: fiatCurrency,
                originalPrice: fiatAmount / btcAmount,
                originalCost: fiatAmount,
                originalFee: fee
            };
        } catch (error) {
            console.error('Error transforming Binance fiat transaction:', error);
            return null;
        }
    }

    /**
     * Transform a fiat payment to standardized format
     * @param {Object} payment - Binance fiat payment record
     * @param {string} overrideType - Override transaction type (optional)
     * @returns {Object|null} Standardized transaction object or null if invalid
     */
    transformFiatPayment(payment, overrideType = null) {
        try {
            if (!payment.cryptoCurrency || payment.cryptoCurrency !== 'BTC') {
                return null;
            }
            
            // According to the Binance docs, sourceAmount is the fiat amount
            // and obtainAmount is the crypto amount
            const btcAmount = parseFloat(payment.obtainAmount);
            const fiatAmount = parseFloat(payment.sourceAmount || payment.amount);
            const fiatCurrency = payment.fiatCurrency || 'FIAT';
            
            // Use createTime for the transaction date
            const date = new Date(payment.createTime);
            
            // Default type is 'buy' for fiat payments, unless overridden
            const type = overrideType || 'buy';
            
            // Fee might be in totalFee field
            let fee = 0;
            if (payment.totalFee) {
                fee = parseFloat(payment.totalFee);
            }
            
            console.log(`Found BTC ${type} transaction:`, {
                date: date.toISOString(),
                amount: btcAmount,
                fiatAmount: fiatAmount,
                fiatCurrency,
                paymentMethod: payment.paymentMethod
            });
            
            return {
                id: payment.orderNo,
                exchange: 'binance',
                type: type,
                amount: btcAmount,
                price: fiatAmount / btcAmount, // Price per BTC in fiat
                cost: fiatAmount,
                fee: fee,
                date: date,
                pair: `BTC/${fiatCurrency}`,
                baseCurrency: 'BTC',
                quoteCurrency: fiatCurrency,
                txType: 'fiat_payment',
                status: payment.status || 'Completed',
                paymentMethod: payment.paymentMethod || 'Unknown',
                currency: fiatCurrency, // Set currency field directly to the fiat currency
                
                // Add fields to match with Kraken format
                originalCurrency: fiatCurrency,
                originalPrice: fiatAmount / btcAmount,
                originalCost: fiatAmount,
                originalFee: fee
            };
        } catch (error) {
            console.error('Error transforming Binance fiat payment:', error);
            return null;
        }
    }
    
    /**
     * Transform a convert transaction to standardized format
     * @param {Object} convert - Binance convert record
     * @returns {Object|null} Standardized transaction object or null if invalid
     */
    transformConvertTransaction(convert) {
        try {
            if (!convert.fromAsset || !convert.toAsset) {
                return null;
            }
            
            // We only care about transactions involving BTC
            if (convert.fromAsset !== 'BTC' && convert.toAsset !== 'BTC') {
                return null;
            }
            
            let type, amount, price, cost;
            let baseCurrency, quoteCurrency;
            
            if (convert.toAsset === 'BTC') {
                // Buying BTC with another asset
                type = 'buy';
                baseCurrency = 'BTC';
                quoteCurrency = convert.fromAsset;
                amount = parseFloat(convert.toAmount);
                cost = parseFloat(convert.fromAmount);
                price = cost / amount;
            } else {
                // Selling BTC for another asset
                type = 'sell';
                baseCurrency = 'BTC';
                quoteCurrency = convert.toAsset;
                amount = parseFloat(convert.fromAmount);
                cost = parseFloat(convert.toAmount);
                price = cost / amount;
            }
            
            const date = new Date(convert.createTime);
            
            // Fee information may not be present
            let fee = 0;
            if (convert.fee) {
                fee = parseFloat(convert.fee);
            }
            
            return {
                id: convert.orderId,
                exchange: 'binance',
                type: type,
                amount: amount,
                price: price,
                cost: cost,
                fee: fee,
                date: date,
                pair: `${baseCurrency}/${quoteCurrency}`,
                baseCurrency: baseCurrency,
                quoteCurrency: quoteCurrency,
                txType: 'convert',
                orderType: convert.orderType || 'Convert'
            };
        } catch (error) {
            console.error('Error transforming Binance convert transaction:', error);
            return null;
        }
    }

    /**
     * Transform a Buy Crypto transaction to standardized format
     * @param {Object} purchase - Binance Buy Crypto record
     * @returns {Object|null} Standardized transaction object or null if invalid
     */
    transformBuyCryptoTransaction(purchase) {
        try {
            // Validate we have the necessary fields
            if (!purchase.cryptoCurrency || !purchase.fiatCurrency || !purchase.obtainAmount) {
                console.warn('Incomplete Buy Crypto data from Binance:', purchase);
                return null;
            }
            
            // Skip non-BTC transactions
            if (purchase.cryptoCurrency !== 'BTC') {
                return null;
            }
            
            // Parse the necessary fields
            const btcAmount = parseFloat(purchase.obtainAmount);
            const fiatAmount = parseFloat(purchase.amount || purchase.fiatAmount || purchase.sourceAmount);
            const fiatCurrency = purchase.fiatCurrency;
            
            // Parse date - prefer createTime, fall back to updateTime or orderNo (if it's numeric timestamp)
            let timestamp = purchase.createTime;
            if (!timestamp && purchase.updateTime) {
                timestamp = purchase.updateTime;
            }
            if (!timestamp && purchase.orderNo && /^\d+$/.test(purchase.orderNo)) {
                timestamp = parseInt(purchase.orderNo);
            }
            if (!timestamp) {
                // If no timestamp, use current time but warn
                console.warn('No timestamp found for Buy Crypto transaction:', purchase);
                timestamp = Date.now();
            }
            
            const date = new Date(timestamp);
            
            // Get fee information
            let fee = 0;
            if (purchase.fee) {
                fee = parseFloat(purchase.fee);
            } else if (purchase.totalFee) {
                fee = parseFloat(purchase.totalFee);
            }
            
            // Convert payment method identifier to readable form
            let paymentMethod = purchase.paymentMethod || 'Unknown';
            
            // Card payment identifier
            if (paymentMethod.includes('Card') || paymentMethod.includes('CARD') || 
                paymentMethod.includes('card') || paymentMethod.includes('PAY')) {
                paymentMethod = 'Card Payment';
            }
            
            console.log(`Found BTC Buy transaction:`, {
                date: date.toISOString(),
                amount: btcAmount,
                fiatAmount: fiatAmount,
                fiatCurrency,
                paymentMethod,
                orderNo: purchase.orderNo
            });
            
            return {
                id: purchase.orderNo,
                exchange: 'binance',
                type: 'buy',
                amount: btcAmount,
                price: fiatAmount / btcAmount, // Price per BTC in fiat
                cost: fiatAmount,
                fee: fee,
                date: date,
                pair: `BTC/${fiatCurrency}`,
                baseCurrency: 'BTC',
                quoteCurrency: fiatCurrency,
                txType: 'buy_crypto',
                fiatAmount: fiatAmount,
                fiatCurrency: fiatCurrency,
                currency: fiatCurrency, // Set currency directly to match fiatCurrency
                paymentMethod: paymentMethod,
                status: purchase.status
            };
        } catch (error) {
            console.error('Error transforming Binance Buy Crypto transaction:', error);
            return null;
        }
    }

    /**
     * Make a private API request to Binance
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Request parameters
     * @param {Object} creds - API credentials (optional, uses stored credentials if not provided)
     * @returns {Promise<Object>} API response
     */
    async _privateRequest(endpoint, params = {}, creds = null) {
        const credentials = creds || this.credentials;
        
        if (!credentials || !credentials.apiKey || !credentials.apiSecret) {
            throw new Error('API key and secret are required for private Binance API requests');
        }
        
        try {
            // Add timestamp to params
            const timestamp = Date.now();
            const requestParams = {
                ...params,
                timestamp
            };
            
            // Create signature
            const queryString = qs.stringify(requestParams);
            const signature = crypto
                .createHmac('sha256', credentials.apiSecret)
                .update(queryString)
                .digest('hex');
            
            // Construct the URL
            const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
            
            // Make the request
            const response = await axios({
                method: 'GET',
                url,
                headers: {
                    'X-MBX-APIKEY': credentials.apiKey
                }
            });
            
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                console.error('Binance API error:', error.response.data);
                throw new Error(error.response.data.msg || 'Unknown Binance API error');
            }
            throw error;
        }
    }
}

module.exports = BinanceAdapter; 