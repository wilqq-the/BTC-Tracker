const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const priceCache = require('./server/priceCache');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const userModel = require('./server/userModel');

// Middleware to check if setup is needed
function isSetupNeeded(req, res, next) {
    // If users exist, continue to login page
    if (userModel.hasUsers()) {
        return next();
    }
    // Otherwise redirect to setup page
    res.redirect('/setup');
}

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage
let transactions = [];
let currentBTCPrice = 0;
let historicalBTCData = [];
let secondaryCurrency = 'PLN'; // Default secondary currency
let secondaryRate = null; // Store exchange rate globally

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const HISTORICAL_BTC_FILE = path.join(DATA_DIR, 'historical_btc.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'app-settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
  secret: 'btc-tracker-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // For flash messages (login errors, etc.)

// Configure Passport
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            // Find user
            const user = userModel.findUserByUsername(username);
            
            // User not found
            if (!user) {
                return done(null, false, { message: 'Incorrect username' });
            }
            
            // Check password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password' });
            }
            
            // Success
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

// Session serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    const user = userModel.findUserById(id);
    done(null, user);
});

// Load data from files
function loadData() {
    try {
        if (fs.existsSync(TRANSACTIONS_FILE)) {
            const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
            let loadedTransactions = JSON.parse(data);
            
            // Ensure all transactions have a currency field
            transactions = loadedTransactions.map(tx => ({
                ...tx,
                currency: tx.currency || 'EUR' // Default to EUR if not specified
            }));
            
            console.log(`Loaded ${transactions.length} transactions with currency information`);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }

    try {
        if (fs.existsSync(HISTORICAL_BTC_FILE)) {
            const data = fs.readFileSync(HISTORICAL_BTC_FILE, 'utf8');
            historicalBTCData = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading historical BTC data:', error);
    }
}

// Save data to files
function saveData() {
    try {
        // Ensure all transactions have a currency field before saving
        const transactionsWithCurrency = transactions.map(tx => ({
            ...tx,
            currency: tx.currency || 'EUR' // Default to EUR if not specified
        }));
        
        fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactionsWithCurrency, null, 2));
        console.log('Transactions saved successfully with currency information');
    } catch (error) {
        console.error('Error saving transactions:', error);
    }
}

function saveHistoricalBTCData() {
    try {
        fs.writeFileSync(HISTORICAL_BTC_FILE, JSON.stringify(historicalBTCData, null, 2));
    } catch (error) {
        console.error('Error saving historical BTC data:', error);
    }
}

// Fetch current BTC price
async function fetchCurrentBTCPrice() {
    try {
        console.log('Fetching current BTC price...');
        
        // Setup API URL
        const settings = loadSettings();
        
        // Use standard API endpoint for all keys
        const baseUrl = 'https://api.coingecko.com/api/v3';
        
        // Use API key as query parameter for demo keys
        let apiUrl = `${baseUrl}/simple/price?ids=bitcoin&vs_currencies=eur,usd`;
        if (settings.coingeckoApiKey) {
            apiUrl += `&x_cg_demo_api_key=${settings.coingeckoApiKey}`;
            console.log('Using CoinGecko API key as query parameter');
        }
        
        // Make request without additional headers
        const response = await axios.get(apiUrl);
        const priceEUR = response.data.bitcoin.eur;
        const priceUSD = response.data.bitcoin.usd;
        
        // Update global variable for backward compatibility
        currentBTCPrice = priceEUR;
        
        // Update the price cache with both EUR and USD prices
        await priceCache.updatePrice(priceEUR, priceUSD);
        
        console.log(`Current BTC price updated: ${priceEUR} EUR / ${priceUSD} USD (${new Date().toISOString()})`);
    } catch (error) {
        console.error('Error fetching BTC price:', error);
        // Fallback to last transaction price if available
        if (transactions.length > 0) {
            currentBTCPrice = transactions[transactions.length - 1].price;
            console.log('Fallback to last transaction price:', currentBTCPrice);
        }
    }
}

// Fetch exchange rates
async function fetchExchangeRates() {
    try {
        console.log('Fetching exchange rates...');
        
        // Get EUR-based rates
        const eurResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
        const eurRates = eurResponse.data.rates;
        
        // Get USD-based rates
        const usdResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        const usdRates = usdResponse.data.rates;
        
        // Format EUR rates
        const eurRatesObj = {
            USD: eurRates.USD,
            PLN: eurRates.PLN,
            GBP: eurRates.GBP,
            JPY: eurRates.JPY,
            CHF: eurRates.CHF
        };
        
        // Format USD rates
        const usdRatesObj = {
            EUR: usdRates.EUR,
            PLN: usdRates.PLN,
            GBP: usdRates.GBP,
            JPY: usdRates.JPY,
            CHF: usdRates.CHF
        };
        
        // Update the price cache with exchange rates
        await priceCache.updateExchangeRates(eurRatesObj, usdRatesObj);
        
        console.log(`Exchange rates updated: 1 EUR = ${eurRatesObj.USD} USD, 1 EUR = ${eurRatesObj.PLN} PLN (${new Date().toISOString()})`);
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
    }
}

// Fetch historical BTC data
async function fetchHistoricalBTCData() {
    try {
        // Get data for the last 365 days
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (365 * 24 * 60 * 60); // 365 days ago
        
        // Setup API URLs
        const settings = loadSettings();
        
        // Use standard API endpoint
        const baseUrl = 'https://api.coingecko.com/api/v3';
        
        // Add API key as query parameter if available
        let apiKeyParam = '';
        if (settings.coingeckoApiKey) {
            apiKeyParam = `&x_cg_demo_api_key=${settings.coingeckoApiKey}`;
            console.log('Using CoinGecko API key for historical data fetch');
        }
            
        let eurApiUrl = `${baseUrl}/coins/bitcoin/market_chart/range?vs_currency=eur&from=${startDate}&to=${endDate}${apiKeyParam}`;
        let usdApiUrl = `${baseUrl}/coins/bitcoin/market_chart/range?vs_currency=usd&from=${startDate}&to=${endDate}${apiKeyParam}`;
        
        // Fetch EUR historical data without headers
        const eurResponse = await axios.get(eurApiUrl);
        
        // Fetch USD historical data without headers
        const usdResponse = await axios.get(usdApiUrl);
        
        // Process the EUR data to get daily prices
        const eurPrices = eurResponse.data.prices;
        const dailyData = {};
        
        eurPrices.forEach(([timestamp, price]) => {
            const date = new Date(timestamp).toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = {
                    date,
                    priceEUR: price,
                    timestamp
                };
            }
        });
        
        // Add USD prices to the daily data
        const usdPrices = usdResponse.data.prices;
        usdPrices.forEach(([timestamp, price]) => {
            const date = new Date(timestamp).toISOString().split('T')[0];
            if (dailyData[date]) {
                dailyData[date].priceUSD = price;
            }
        });
        
        // Convert to array and sort by timestamp
        historicalBTCData = Object.values(dailyData).sort((a, b) => a.timestamp - b.timestamp);
        
        // Add backward compatibility - set price field to priceEUR 
        historicalBTCData = historicalBTCData.map(day => ({
            ...day,
            price: day.priceEUR,  // For backward compatibility
        }));
        
        saveHistoricalBTCData();
        console.log('Historical BTC data updated with', historicalBTCData.length, 'days of data in both EUR and USD');
    } catch (error) {
        console.error('Error fetching historical BTC data:', error);
    }
}

// Initialize data
loadData();

// Fetch initial data
fetchCurrentBTCPrice();
fetchExchangeRates();
fetchHistoricalBTCData();

// Update data periodically
setInterval(fetchCurrentBTCPrice, 5 * 60 * 1000); // Every 5 minutes
setInterval(fetchExchangeRates, 60 * 60 * 1000); // Every hour
setInterval(fetchHistoricalBTCData, 24 * 60 * 60 * 1000); // Every 24 hours

// Import CSV data
function importCSVData(csvFilePath) {
    return new Promise((resolve, reject) => {
        const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
        
        parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        }, (err, records) => {
            if (err) {
                console.error('Error parsing CSV:', err);
                reject(err);
                return;
            }
            
            const newTransactions = records.map(record => {
                // Check which header format is being used (English or Polish)
                const isEnglishFormat = record.hasOwnProperty('Date') || record.hasOwnProperty('Type');
                
                // Map fields based on the detected format
                const date = isEnglishFormat ? record['Date'] : record['Data transakcji'];
                const type = isEnglishFormat ? record['Type'] : record['Typ transakcji'];
                const price = parseFloat(isEnglishFormat ? record['Price'] : record['Cena']);
                const cost = parseFloat(isEnglishFormat ? record['Cost'] : record['Koszt']);
                const fee = parseFloat(isEnglishFormat ? record['Fee'] : record['Opłata']);
                const amount = parseFloat(isEnglishFormat ? 
                    (record['Amount (BTC)'] || record['Amount']) : 
                    record['Wolumen zakupiony (BTC)']);
                
                // Include currency field with default to EUR
                const currency = (isEnglishFormat ? 
                    record['Currency'] : 
                    record['Waluta']) || 'EUR';
                
                return {
                    date,
                    type,
                    price,
                    cost,
                    fee,
                    amount,
                    currency
                };
            });

            // Sort transactions by date
            newTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Calculate P&L for each transaction
            let totalBTC = 0;
            let totalCost = 0;
            newTransactions.forEach(t => {
                totalBTC += t.amount;
                totalCost += t.cost;
                t.cumulativeBTC = totalBTC;
                t.cumulativeCost = totalCost;
                t.averagePrice = totalCost / totalBTC;
            });

            transactions = newTransactions;
            saveData();
            console.log(`Imported ${transactions.length} transactions with currency information`);
            
            // Fetch historical data after transactions are loaded
            fetchHistoricalBTCData().then(resolve).catch(reject);
        });
    });
}

// Routes for API
app.get('/api/transactions', isAuthenticated, (req, res) => {
    res.json(transactions);
});

app.get('/api/transactions/summary', isAuthenticated, (req, res) => {
    // Get rates from price cache instead
    const cachedPrices = priceCache.getCachedPrices();

    const totalBTC = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCost = transactions.reduce((sum, t) => sum + t.cost, 0);
    const totalFees = transactions.reduce((sum, t) => sum + t.fee, 0);
    const currentValue = totalBTC * currentBTCPrice;
    const pnl = currentValue - totalCost;
    const pnlPercentage = (pnl / totalCost) * 100;
    
    // Calculate PLN values using cachedPrices
    const totalCostPLN = totalCost * cachedPrices.eurPln;
    const currentValuePLN = currentValue * cachedPrices.eurPln;
    const pnlPLN = currentValuePLN - totalCostPLN;
    const pnlPercentagePLN = (pnlPLN / totalCostPLN) * 100;
    
    res.json({
        totalBTC,
        totalCost,
        totalFees,
        averagePrice: totalCost / totalBTC,
        currentPrice: currentBTCPrice,
        currentValue,
        pnl,
        pnlPercentage,
        // PLN values with currentEURPLN replaced
        eurPln: cachedPrices.eurPln,
        totalCostPLN,
        currentValuePLN,
        pnlPLN,
        pnlPercentagePLN
    });
});

app.get('/api/transactions/historical', isAuthenticated, (req, res) => {
    res.json(historicalBTCData);
});

// Update the /api/summary endpoint
app.get('/api/summary', isAuthenticated, async (req, res) => {
    try {
        const cachedPrices = priceCache.getCachedPrices();
        const settings = loadSettings();
        
        // Get main currency from settings (default to EUR if not set)
        const mainCurrency = settings.mainCurrency || 'EUR';
        
        // Get secondary currency from settings
        secondaryCurrency = settings.secondaryCurrency || 'PLN';
        secondaryRate = settings.secondaryRate || 1;
        
        // Get the appropriate exchange rate for the secondary currency
        if (secondaryCurrency === 'USD') {
            secondaryRate = mainCurrency === 'EUR' ? 
                cachedPrices.eurUsd || 1.1 : 
                1 / (cachedPrices.exchangeRates?.USD?.EUR || 0.9);
        } else if (secondaryCurrency === 'EUR') {
            secondaryRate = mainCurrency === 'USD' ? 
                cachedPrices.exchangeRates?.USD?.EUR || 0.9 : 
                1;
        } else if (secondaryCurrency === 'PLN') {
            secondaryRate = mainCurrency === 'EUR' ? 
                cachedPrices.eurPln || 4.5 : 
                cachedPrices.exchangeRates?.USD?.PLN || 4.0;
        } else if (secondaryCurrency === 'GBP') {
            secondaryRate = mainCurrency === 'EUR' ? 
                cachedPrices.eurGbp || 0.85 : 
                cachedPrices.exchangeRates?.USD?.GBP || 0.75;
        } else if (secondaryCurrency === 'JPY') {
            secondaryRate = mainCurrency === 'EUR' ? 
                cachedPrices.eurJpy || 160 : 
                cachedPrices.exchangeRates?.USD?.JPY || 145;
        } else if (secondaryCurrency === 'CHF') {
            secondaryRate = mainCurrency === 'EUR' ? 
                cachedPrices.eurChf || 0.95 : 
                cachedPrices.exchangeRates?.USD?.CHF || 0.85;
        }
        
        // Current BTC price in the main currency
        const currentBTCPrice = mainCurrency === 'EUR' ? 
            cachedPrices.priceEUR || cachedPrices.price || 0 : 
            cachedPrices.priceUSD || 0;
            
        // Convert transaction costs to main currency if needed
        const processedTransactions = transactions.map(tx => {
            // If transaction currency is different from main currency, convert it
            if (tx.currency !== mainCurrency) {
                const rate = priceCache.getExchangeRate(tx.currency, mainCurrency);
                return {
                    ...tx,
                    convertedPrice: tx.price * rate,
                    convertedCost: tx.cost * rate,
                    convertedFee: (tx.fee || 0) * rate,
                    originalCurrency: tx.currency
                };
            }
            return tx;
        });
        
        // Calculate totals from transactions in main currency
        const totalBTC = transactions.length > 0 ? transactions.reduce((sum, t) => sum + t.amount, 0) : 0;
        
        // Calculate costs taking currency conversions into account
        const totalCost = processedTransactions.length > 0 ?
            processedTransactions.reduce((sum, t) => {
                const cost = t.convertedCost !== undefined ? t.convertedCost : t.cost;
                return sum + cost;
            }, 0) : 0;
        
        const totalFees = processedTransactions.length > 0 ?
            processedTransactions.reduce((sum, t) => {
                const fee = t.convertedFee !== undefined ? t.convertedFee : (t.fee || 0);
                return sum + fee;
            }, 0) : 0;
            
        const currentValue = totalBTC * currentBTCPrice;
        const pnl = currentValue - totalCost;
        const pnlPercentage = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
        
        // Calculate secondary currency values
        const secondaryValue = {
            totalCost: totalCost * secondaryRate,
            currentValue: currentValue * secondaryRate,
            pnl: pnl * secondaryRate,
            // Percentage remains the same regardless of currency
            pnlPercentage: pnlPercentage
        };
        
        // Check if we need to include historical data
        const priceOnly = req.query.priceOnly === 'true';
        
        // Add P&L data to each transaction
        const transactionsWithPnL = processedTransactions.map((tx, index) => {
            const txCost = tx.convertedCost !== undefined ? tx.convertedCost : tx.cost;
            const txAmount = tx.amount;
            const txValue = txAmount * currentBTCPrice;
            const txPnL = txValue - txCost;
            const txPnLPercentage = txCost > 0 ? (txPnL / txCost) * 100 : 0;
            
            // Secondary currency P&L
            const txSecondaryPnL = txPnL * secondaryRate;
            
            return {
                ...tx,
                id: tx.id || index.toString(), // Ensure ID exists
                pnl: txPnL,
                pnlPercentage: txPnLPercentage,
                secondaryPnl: txSecondaryPnL,
                // Percentage is the same regardless of currency
                secondaryPnlPercentage: txPnLPercentage
            };
        });
        
        const summary = {
            // Transaction data
            transactions: transactionsWithPnL,
            hasTransactions: transactions.length > 0,
            
            // Price data
            price: currentBTCPrice,
            priceEUR: cachedPrices.priceEUR || cachedPrices.price,
            priceUSD: cachedPrices.priceUSD || (cachedPrices.priceEUR * (cachedPrices.eurUsd || 1.1)),
            timestamp: cachedPrices.timestamp,
            
            // Exchange rates
            exchangeRates: cachedPrices.exchangeRates || {},
            eurUsd: cachedPrices.eurUsd,
            eurPln: cachedPrices.eurPln,
            
            // Main currency info
            mainCurrency,
            
            // Main currency (EUR or USD) portfolio stats
            totalBTC,
            totalCost,
            totalFees,
            averagePrice: totalBTC > 0 ? totalCost / totalBTC : 0,
            currentValue,
            pnl,
            pnlPercentage,
            
            // Secondary currency info
            secondaryCurrency,
            secondaryRate,
            secondaryValue,
            
            // Settings
            settings
        };
        
        // Include historical data unless priceOnly=true
        if (!priceOnly) {
            summary.historicalBTCData = historicalBTCData;
        }

        res.json(summary);
    } catch (error) {
        console.error('Error getting summary:', error);
        res.status(500).json({ error: 'Failed to get summary' });
    }
});

// Function to get exchange rates
async function getExchangeRates() {
    try {
        // Try to get rates from cache first
        const cachedPrices = priceCache.getCachedPrices();
        if (cachedPrices.exchangeRates) {
            return cachedPrices.exchangeRates;
        }
        
        // If not in cache, fetch from API
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
        const rates = response.data.rates;
        
        // Invert rates to get X to EUR conversion
        const eurRates = {};
        for (const currency in rates) {
            eurRates[currency] = rates[currency];
        }
        
        // Save to cache
        priceCache.updateExchangeRates(eurRates);
        
        return eurRates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return { EUR: 1, USD: 1.1, PLN: 4.5 }; // Default fallback
    }
}

// Add new endpoint for current price
app.get('/api/current-price', isAuthenticated, async (req, res) => {
    try {
        console.log('Processing /api/current-price request...');
        
        // Get cached prices from price cache
        const cachedPrices = priceCache.getCachedPrices();
        
        // Check if we need to fetch fresh prices
        const forceFresh = req.query.fresh === 'true';
        if (forceFresh || !cachedPrices.priceEUR || !cachedPrices.timestamp) {
            // Setup API URL
            const settings = loadSettings();
            
            // Use standard API endpoint
            const baseUrl = 'https://api.coingecko.com/api/v3';
                
            // Add API key as query parameter if available
            let btcApiUrl = `${baseUrl}/simple/price?ids=bitcoin&vs_currencies=eur,usd`;
            if (settings.coingeckoApiKey) {
                btcApiUrl += `&x_cg_demo_api_key=${settings.coingeckoApiKey}`;
                console.log('Using CoinGecko API key for fresh price fetch');
            }
            
            // Fetch current BTC price using axios (without headers)
            const btcResponse = await axios.get(btcApiUrl);
            const btcData = btcResponse.data;
            
            // Fetch current exchange rates using axios
            const exchangeResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
            const exchangeData = exchangeResponse.data;

            const responseData = {
                priceEUR: btcData.bitcoin.eur,
                priceUSD: btcData.bitcoin.usd,
                timestamp: new Date(),
                eurUsd: exchangeData.rates.USD,
                eurPln: exchangeData.rates.PLN
            };

            console.log('Current price data fetched fresh:', {
                btcPriceEUR: responseData.priceEUR + ' EUR',
                btcPriceUSD: responseData.priceUSD + ' USD',
                eurUsd: responseData.eurUsd,
                eurPln: responseData.eurPln,
                timestamp: responseData.timestamp
            });
            
            // Update the cache with new data
            await priceCache.updatePrice(responseData.priceEUR, responseData.priceUSD);
            
            res.json(responseData);
        } else {
            // Use cached data
            console.log('Using cached price data:', {
                btcPriceEUR: cachedPrices.priceEUR + ' EUR',
                btcPriceUSD: cachedPrices.priceUSD + ' USD',
                eurUsd: cachedPrices.eurUsd,
                eurPln: cachedPrices.eurPln,
                timestamp: cachedPrices.timestamp,
                age: cachedPrices.age + ' seconds'
            });
            
            res.json({
                priceEUR: cachedPrices.priceEUR,
                priceUSD: cachedPrices.priceUSD,
                timestamp: cachedPrices.timestamp,
                eurUsd: cachedPrices.eurUsd,
                eurPln: cachedPrices.eurPln,
                age: cachedPrices.age
            });
        }
    } catch (error) {
        console.error('Error fetching current price:', error);
        res.status(500).json({ error: 'Failed to fetch current price' });
    }
});

// Admin routes
app.post('/api/admin/import', isAuthenticated, async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.files.file;
        const tempPath = path.join(DATA_DIR, 'temp.csv');
        await file.mv(tempPath);
        
        await importCSVData(tempPath);
        fs.unlinkSync(tempPath);
        
        res.json({ message: 'Data imported successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new transaction endpoint
app.post('/api/admin/transactions', isAuthenticated, (req, res) => {
    try {
        const newTransaction = req.body;
        
        // Basic validation
        if (!newTransaction.date || !newTransaction.type || !newTransaction.amount || !newTransaction.price) {
            return res.status(400).json({ error: 'Missing required transaction fields' });
        }
        
        // Add default values for optional fields
        const transaction = {
            ...newTransaction,
            id: Date.now().toString(), // Generate a unique ID based on timestamp
            fee: newTransaction.fee || 0,
            currency: newTransaction.currency || 'EUR',
            // Ensure cost is calculated correctly
            cost: newTransaction.amount * newTransaction.price
        };
        
        // Add to transactions array
        transactions.push(transaction);
        
        // Sort transactions by date
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Save to file
        saveData();
        
        res.status(201).json({ 
            message: 'Transaction added successfully',
            transaction 
        });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message 
        });
    }
});

app.put('/api/admin/transactions/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const updatedTransaction = req.body;
    
    // First try to find by exact id match
    let index = transactions.findIndex(tx => tx.id === id);
    
    // If not found and id is numeric, try to find by index
    if (index === -1 && !isNaN(parseInt(id))) {
        const numericId = parseInt(id);
        if (numericId >= 0 && numericId < transactions.length) {
            index = numericId;
        }
    }
    
    if (index !== -1) {
        transactions[index] = { 
            ...transactions[index], 
            ...updatedTransaction,
            id: transactions[index].id || index.toString() // Ensure ID exists
        };
        saveData();
        res.json({ message: 'Transaction updated successfully' });
    } else {
        res.status(404).json({ error: 'Transaction not found' });
    }
});

app.delete('/api/admin/transactions/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    
    // First try to find by exact id match
    let index = transactions.findIndex(tx => tx.id === id);
    
    // If not found and id is numeric, try to find by index
    if (index === -1 && !isNaN(parseInt(id))) {
        const numericId = parseInt(id);
        if (numericId >= 0 && numericId < transactions.length) {
            index = numericId;
        }
    }
    
    if (index !== -1) {
        transactions.splice(index, 1);
        saveData();
        res.json({ message: 'Transaction deleted successfully' });
    } else {
        res.status(404).json({ error: 'Transaction not found' });
    }
});

// Update transaction
app.put('/api/transactions/:id', isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;
        const updatedTx = req.body;
        
        // Find and update the transaction
        const index = transactions.findIndex(tx => tx.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update the transaction, ensuring currency is included
        transactions[index] = {
            ...transactions[index],
            ...updatedTx,
            cost: updatedTx.amount * updatedTx.price,
            currency: updatedTx.currency || transactions[index].currency || 'EUR'
        };

        // Save updated transactions
        saveData();

        res.json(transactions[index]);
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// CSV export endpoint with English headers
app.get('/api/transactions/export-csv', isAuthenticated, (req, res) => {
    try {
        // Create CSV header in English
        let csv = 'Date,Type,Price,Cost,Fee,Amount (BTC),Currency\n';
        
        // Add transaction data
        transactions.forEach(tx => {
            // Format the date (YYYY-MM-DD)
            const date = new Date(tx.date).toISOString().split('T')[0];
            
            // Format the row with all necessary fields
            const row = [
                date,
                tx.type,
                tx.price.toFixed(2),
                tx.cost.toFixed(2),
                (tx.fee || 0).toFixed(2),
                tx.amount.toFixed(8),
                tx.currency || 'EUR'  // Include currency
            ].join(',');
            
            csv += row + '\n';
        });
        
        // Set the response headers for a CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="btc-transactions-${new Date().toISOString().split('T')[0]}.csv"`);
        
        // Send the CSV content
        res.send(csv);
    } catch (error) {
        console.error('Error generating CSV:', error);
        res.status(500).json({ error: 'Failed to generate CSV' });
    }
});

app.get('/api/transactions/template-csv', isAuthenticated, (req, res) => {
    // Create a template CSV with English headers and example data
    const template = 
        'Date,Type,Price,Cost,Fee,Amount (BTC),Currency\n' +
        '2023-01-01,buy,25000,2500,5,0.1,EUR\n' +
        '2023-01-02,buy,27000,1350,3,0.05,USD\n' +
        '2023-01-03,sell,26000,-1300,-2,0.05,EUR\n';
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="btc-transactions-template.csv"');
    res.send(template);
});

// Endpoint to delete all transactions
app.delete('/api/transactions/delete-all', isAuthenticated, (req, res) => {
    try {
        // Clear all transactions
        transactions = [];
        
        // Save the empty array to file
        saveData();
        
        console.log('All transactions deleted successfully');
        res.json({ message: 'All transactions deleted successfully' });
    } catch (error) {
        console.error('Error deleting all transactions:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// Load settings
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            // Default settings
            const defaultSettings = {
                secondaryCurrency: "PLN",
                mainCurrency: "EUR"  // Default main currency
            };
            
            // Save default settings
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        return { secondaryCurrency: "PLN", mainCurrency: "EUR" };
    }
}

// Save settings
function saveSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Get settings endpoint
app.get('/api/settings', isAuthenticated, (req, res) => {
    const settings = loadSettings();
    res.json(settings);
});

// Update settings endpoint
app.put('/api/settings', isAuthenticated, (req, res) => {
    try {
        const newSettings = req.body;
        
        // Basic validation
        if (!newSettings.secondaryCurrency) {
            return res.status(400).json({ error: 'Missing secondaryCurrency' });
        }
        
        // Save settings
        if (saveSettings(newSettings)) {
            res.json({ message: 'Settings saved', settings: newSettings });
        } else {
            res.status(500).json({ error: 'Failed to save settings' });
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test CoinGecko API key
app.post('/api/settings/test-coingecko-key', isAuthenticated, async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }
        
        // Test the API key with CoinGecko
        try {
            // Use demo API key as query parameter
            const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&x_cg_demo_api_key=${apiKey}`;
            const response = await axios.get(apiUrl);
            
            // If we get here, the request was successful
            if (response.data && response.data.bitcoin && response.data.bitcoin.usd) {
                res.json({ 
                    success: true, 
                    message: 'API key is valid!',
                    currentPrice: response.data.bitcoin.usd
                });
            } else {
                res.json({ 
                    success: false, 
                    message: 'Received unexpected response format from CoinGecko'
                });
            }
        } catch (apiError) {
            console.error('CoinGecko API error:', apiError.response?.data || apiError.message);
            
            // Handle specific error cases
            if (apiError.response) {
                if (apiError.response.status === 401 || apiError.response.status === 403) {
                    return res.json({ 
                        success: false, 
                        message: 'Invalid API key or unauthorized'
                    });
                } else if (apiError.response.status === 429) {
                    return res.json({ 
                        success: false, 
                        message: 'Rate limit exceeded. The API key may still be valid.'
                    });
                }
            }
            
            res.json({ 
                success: false, 
                message: 'Error testing API key: ' + (apiError.response?.data?.error || apiError.message)
            });
        }
    } catch (error) {
        console.error('Server error testing API key:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error when testing API key'
        });
    }
});

// Login page
app.get('/login', isSetupNeeded, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login form submission
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

// Setup page (first run)
app.get('/setup', (req, res) => {
    // If users already exist, redirect to login
    if (userModel.hasUsers()) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Setup form submission
app.post('/setup', async (req, res) => {
    try {
        console.log('Setup form submission received:', req.body);
        
        // If users already exist, redirect to login
        if (userModel.hasUsers()) {
            return res.redirect('/login');
        }
        
        const { username, password, confirmPassword } = req.body;
        
        // Validate username and password are provided
        if (!username || !password) {
            console.error('Setup error: Username and password are required');
            return res.redirect('/setup?error=' + encodeURIComponent('Username and password are required'));
        }
        
        // Validate passwords match
        if (password !== confirmPassword) {
            console.error('Setup error: Passwords do not match');
            return res.redirect('/setup?error=' + encodeURIComponent('Passwords do not match'));
        }
        
        // Create user
        console.log('Creating new user:', username);
        await userModel.createUser(username, password);
        console.log('User created successfully');
        
        // Redirect to login
        res.redirect('/login');
    } catch (error) {
        console.error('Setup error:', error);
        res.redirect('/setup?error=' + encodeURIComponent(error.message));
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/login');
    });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    // Check if this is a login-related path that should not be protected
    const publicPaths = ['/login', '/setup', '/logout'];
    const isPublicPath = publicPaths.includes(req.path) || req.path.startsWith('/public/');
    
    // If not a public path and not authenticated, redirect to login
    if (!isPublicPath && !req.isAuthenticated()) {
        return res.redirect('/login');
    }
    
    // If it's a public path, or user is authenticated, serve the requested file
    if (req.path === '/login' || req.path === '/setup') {
        res.sendFile(path.join(__dirname, 'public', req.path + '.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Change password endpoint
app.post('/api/user/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validate request
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
        
        // Get current user
        const userId = req.user.id;
        const user = userModel.findUserById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        await userModel.updateUser(userId, { password: newPassword });
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ 
            error: 'Failed to change password', 
            message: error.message 
        });
    }
});

async function startServer() {
    // Initialize price cache before starting the server
    await priceCache.initialize();
    
    // Start server
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer();