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
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const userModel = require('./server/userModel');
const exchangeRoutes = require('./routes/exchange-routes');
const Transaction = require('./server/models/Transaction');
const currencyConverter = require('./server/services/currency-converter');
const summaryCache = require('./server/summaryCache');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pathManager = require('./server/utils/path-manager');
const Logger = require('./server/utils/logger');

// Initialize logger
const logger = Logger.create('SERVER');

// Handle Electron environment
if (process.env.IS_ELECTRON === 'true') {
    logger.info('Running in Electron environment');
    
    // Set Electron-specific environment variables for PathManager
    if (process.env.ELECTRON_USER_DATA_PATH) {
        logger.info(`Using Electron user data path: ${process.env.ELECTRON_USER_DATA_PATH}`);
        process.env.BTC_TRACKER_DATA_DIR = path.join(process.env.ELECTRON_USER_DATA_PATH, 'data');
    }
    
    if (process.env.ELECTRON_IS_PACKAGED === 'true') {
        logger.info('Running in packaged Electron app');
    } else {
        logger.info('Running in development Electron mode');
    }
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  logger.info('NODE_ENV not set, defaulting to development');
}

function isSetupNeeded(req, res, next) {
    if (userModel.hasUsers()) {
        return next();
    }
    res.redirect('/setup');
}

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.locals.updateTransactions = (newTransactions) => {
  if (Array.isArray(newTransactions)) {
    logger.info(`Updating application transactions array with ${newTransactions.length} transactions`);
    transactions = newTransactions;
  } else {
    logger.error('Invalid transactions provided to updateTransactions function');
  }
};

app.locals.getTransactions = () => {
  return transactions;
};

let transactions = [];
let currentBTCPrice = 0;
let historicalBTCData = [];
let secondaryCurrency = 'PLN';
let secondaryRate = null;

const DATA_DIR = pathManager.getDataDirectory();
const TRANSACTIONS_FILE = pathManager.getTransactionsPath();
const HISTORICAL_BTC_FILE = pathManager.getHistoricalBtcPath();
const SETTINGS_FILE = pathManager.getAppSettingsPath();
const USERS_FILE = pathManager.getUsersPath();

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration - more flexible for different environments
const sessionConfig = {
  secret: 'btc-tracker-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Only require HTTPS for secure cookies when explicitly enabled
    secure: process.env.HTTPS === 'true',
    // Use environment-specific cookie duration
    maxAge: process.env.COOKIE_MAX_AGE ? parseInt(process.env.COOKIE_MAX_AGE) : 
            (process.env.NODE_ENV === 'production' ? 24 * 60 * 60 * 1000 : 
             process.env.NODE_ENV === 'test' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000)
  }
};

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/exchanges.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exchanges.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const user = userModel.findUserByUsername(username);
            
            if (!user) {
                return done(null, false, { message: 'Incorrect username' });
            }
            
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password' });
            }
            
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    const user = userModel.findUserById(id);
    done(null, user);
});

// Load data from files
async function loadData() {
    try {
        if (fs.existsSync(TRANSACTIONS_FILE)) {
            const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
            let loadedTransactions = JSON.parse(data);
            
            logger.info(`Loading ${loadedTransactions.length} transactions from file`);
            
            const cachedPrices = priceCache.getCachedPrices();
            const currentBTCPrice = cachedPrices.priceEUR;
            
            transactions = loadedTransactions.map(tx => {
                const transaction = new Transaction(tx);
                const txJson = transaction.toJSON();
                
                if (txJson.type === 'buy') {
                    const currentValueEUR = txJson.amount * currentBTCPrice;
                    
                    const costEUR = txJson.base.eur.cost;
                    const pnlEUR = currentValueEUR - costEUR;
                    const pnlPercentageEUR = (pnlEUR / costEUR) * 100;
                    
                    const currentValueUSD = currentValueEUR * txJson.base.usd.rate;
                    const costUSD = txJson.base.usd.cost;
                    const pnlUSD = currentValueUSD - costUSD;
                    const pnlPercentageUSD = (pnlUSD / costUSD) * 100;
                    
                    return {
                        ...txJson,
                        pnl: pnlEUR,
                        pnlPercentage: pnlPercentageEUR,
                        currentValueInMainCurrency: currentValueEUR,
                        pnlSecondary: pnlUSD,
                        pnlPercentageSecondary: pnlPercentageUSD,
                        currentValueInSecondaryCurrency: currentValueUSD
                    };
                }
                
                return txJson;
            });
            
            logger.info(`Loaded and processed ${transactions.length} transactions with P&L calculations`);
        } else {
            logger.info('No transactions file found, starting with empty transactions');
            transactions = [];
        }
    } catch (error) {
        logger.error('Error loading transactions:', error);
        transactions = [];
    }
}

// Load historical BTC data from file
function loadHistoricalDataFromFile() {
    try {
        if (fs.existsSync(HISTORICAL_BTC_FILE)) {
            const data = fs.readFileSync(HISTORICAL_BTC_FILE, 'utf8');
            historicalBTCData = JSON.parse(data) || [];
            logger.info(`Loaded ${historicalBTCData.length} historical BTC data points from file`);
        } else {
            logger.info('No historical BTC data file found. Will fetch later');
            historicalBTCData = [];
        }
    } catch (error) {
        logger.error('Error loading historical BTC data from file:', error);
        historicalBTCData = [];
    }
}

// Initialize data
async function initializeData() {
    try {
        loadHistoricalDataFromFile();
        
        await Promise.all([
            currencyConverter.ensureRates(),
            priceCache.updatePrices()
        ]);
        
        await loadData(); 
        
        if (!historicalBTCData || historicalBTCData.length === 0) {
            logger.info("Historical data empty after loading from file, triggering initial fetch");
            fetchHistoricalBTCData().catch(err => logger.error("Initial historical data fetch failed:", err));
        }

        // Initialize the summary cache with the calculation function
        const calculateInitialSummary = async () => {
            const settings = loadSettings();
            const mainCurrency = settings.mainCurrency || 'EUR';
            const secondaryCurrency = settings.secondaryCurrency || 'USD';
            
            logger.debug(`Calculating initial summary: Main=${mainCurrency}, Secondary=${secondaryCurrency}`);

            const totalBTC = transactions.reduce((total, tx) => {
                if (tx.type === 'buy') {
                    return total + (Number(tx.amount) || 0);
                } else if (tx.type === 'sell') {
                    return total - (Number(tx.amount) || 0);
                }
                return total;
            }, 0);

            const cachedPrices = priceCache.getCachedPrices();
            const currentBTCPriceEUR = cachedPrices.priceEUR || 0;
            
            let secondaryRate = 1.0;
            if (mainCurrency !== secondaryCurrency) {
                secondaryRate = priceCache.getExchangeRate(mainCurrency, secondaryCurrency) || 1.0;
            }
            secondaryRate = Number(secondaryRate) || 1.0; 

            const currentBTCPriceMain = priceCache.getBTCPrice(mainCurrency) || 0;
            const currentValueMain = totalBTC * currentBTCPriceMain;
            const currentValueSecondary = currentValueMain * secondaryRate;

            const buyTotals = transactions.reduce((totals, tx) => {
                if (tx.type === 'buy') {
                    const amount = Number(tx.amount) || 0;
                    const costMain = Number(tx.base?.[mainCurrency.toLowerCase()]?.cost || 0);
                    const costEUR = Number(tx.base?.eur?.cost || tx.cost || 0);
                    const finalCostMain = costMain || (costEUR * priceCache.getExchangeRate('EUR', mainCurrency));
                    const costSecondary = finalCostMain * secondaryRate;
                    
                    return {
                        totalSpentMain: totals.totalSpentMain + finalCostMain,
                        totalSpentSecondary: totals.totalSpentSecondary + costSecondary,
                        totalAmountBought: totals.totalAmountBought + amount 
                    };
                }
                return totals;
            }, { totalSpentMain: 0, totalSpentSecondary: 0, totalAmountBought: 0 });

            const averagePriceMain = buyTotals.totalAmountBought > 0 ? buyTotals.totalSpentMain / buyTotals.totalAmountBought : 0;
            const averagePriceSecondary = buyTotals.totalAmountBought > 0 ? buyTotals.totalSpentSecondary / buyTotals.totalAmountBought : 0;
            const totalPnLMain = currentValueMain - buyTotals.totalSpentMain;
            const totalPnLSecondary = currentValueSecondary - buyTotals.totalSpentSecondary;
            const pnlPercentageMain = buyTotals.totalSpentMain > 0 ? (totalPnLMain / buyTotals.totalSpentMain) * 100 : 0;
            const pnlPercentageSecondary = buyTotals.totalSpentSecondary > 0 ? (totalPnLSecondary / buyTotals.totalSpentSecondary) * 100 : 0;
            
            return {
                // Only include essential data, no transactions or historical data
                hasTransactions: transactions.length > 0,
                totalBTC,
                
                mainCurrency: mainCurrency,
                secondaryCurrency: secondaryCurrency,
                secondaryRate: secondaryRate,
                eurUsd: cachedPrices.eurUsd || 1.13,

                currentPrice: {
                    [mainCurrency.toLowerCase()]: currentBTCPriceMain || 0,
                    [secondaryCurrency.toLowerCase()]: (currentBTCPriceMain * secondaryRate) || 0 
                },
                totalCost: {
                    [mainCurrency.toLowerCase()]: buyTotals.totalSpentMain || 0,
                    [secondaryCurrency.toLowerCase()]: buyTotals.totalSpentSecondary || 0
                },
                currentValue: {
                    [mainCurrency.toLowerCase()]: currentValueMain || 0,
                    [secondaryCurrency.toLowerCase()]: currentValueSecondary || 0
                },
                pnl: {
                    [mainCurrency.toLowerCase()]: totalPnLMain || 0,
                    [secondaryCurrency.toLowerCase()]: totalPnLSecondary || 0
                },
                averagePrice: {
                    [mainCurrency.toLowerCase()]: averagePriceMain || 0,
                    [secondaryCurrency.toLowerCase()]: averagePriceSecondary || 0
                },
                pnlPercentage: pnlPercentageMain || 0,
                
                btcPrice: currentBTCPriceMain,
                price: currentBTCPriceMain,
                priceEUR: currentBTCPriceEUR || 0,
                priceUSD: cachedPrices.priceUSD || 0,
                timestamp: cachedPrices.timestamp,
                cacheInfo: {
                    priceLastUpdated: priceCache.getPriceLastUpdated(),
                    ratesLastUpdated: priceCache.getRatesLastUpdated(),
                    summaryCacheDate: new Date().toISOString()
                },
                
                totalCost: buyTotals.totalSpentMain || 0, 
                currentValue: currentValueMain || 0,
                pnl: totalPnLMain || 0,
                averagePrice: averagePriceMain || 0, 
                
                secondaryValue: {
                    totalCost: buyTotals.totalSpentSecondary || 0,
                    currentValue: currentValueSecondary || 0,
                    pnl: totalPnLSecondary || 0,
                    pnlPercentage: pnlPercentageSecondary || 0, 
                    averagePrice: averagePriceSecondary || 0 
                }
            };
        };
        
        // Function to get current transaction info for cache validation
        const getTransactionInfo = () => {
            return {
                count: transactions.length,
                timestamp: transactions.length > 0 
                    ? transactions[transactions.length - 1].date 
                    : new Date().toISOString()
            };
        };
        
        // Schedule periodic summary cache updates with transaction tracking
        summaryCache.scheduleUpdates(calculateInitialSummary, getTransactionInfo);

    } catch (error) {
        logger.error('Error initializing data:', error);
    }
}

// Initialize data
initializeData();

// Save data to files
function saveData() {
    try {
        fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
        logger.info(`Saved ${transactions.length} transactions successfully`);
        
        // Invalidate summary cache when transactions are saved
        summaryCache.invalidateCache();
    } catch (error) {
        logger.error('Error saving transactions:', error);
    }
}

function saveHistoricalBTCData() {
    try {
        fs.writeFileSync(HISTORICAL_BTC_FILE, JSON.stringify(historicalBTCData, null, 2));
    } catch (error) {
        logger.error('Error saving historical BTC data:', error);
    }
}

// Fetch current BTC price using Yahoo Finance
async function fetchCurrentBTCPrice() {
    try {
        logger.debug('Fetching current BTC price from Yahoo Finance');
        
        // Calculate current date timestamps (today only)
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (24 * 60 * 60); // 1 day ago
        
        // Fetch current prices in both EUR and USD
        const btcEurData = await fetchYahooFinanceData('BTC-EUR', startDate, endDate);
        const btcUsdData = await fetchYahooFinanceData('BTC-USD', startDate, endDate);
        
        // Get the latest data points
        const eurDates = Object.keys(btcEurData).sort();
        const usdDates = Object.keys(btcUsdData).sort();
        
        if (eurDates.length === 0 || usdDates.length === 0) {
            throw new Error('No current price data available from Yahoo Finance');
        }
        
        // Get the most recent prices
        const latestEurDate = eurDates[eurDates.length - 1];
        const latestUsdDate = usdDates[usdDates.length - 1];
        
        const priceEUR = btcEurData[latestEurDate].close;
        const priceUSD = btcUsdData[latestUsdDate].close;
        
        // Update current price cache
        currentBTCPrice = priceEUR;
        await priceCache.updatePrice(priceEUR, priceUSD);
        
        logger.info(`Current BTC price updated: ${priceEUR} EUR / ${priceUSD} USD`);
        
        // Return the price data
        return {
            priceEUR,
            priceUSD,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error fetching BTC price from Yahoo Finance:', error);
        
        // Try to use cached data if available
        const cachedPrices = priceCache.getCachedPrices();
        if (cachedPrices && cachedPrices.priceEUR) {
            logger.warn('Using cached price data as fallback');
            return cachedPrices;
        }
        
        // If all else fails, try to get the last transaction price
        if (transactions.length > 0) {
            currentBTCPrice = transactions[transactions.length - 1].price;
            logger.warn('Fallback to last transaction price:', currentBTCPrice);
            return {
                priceEUR: currentBTCPrice,
                priceUSD: currentBTCPrice * 1.1, // Rough estimate if no better data
                timestamp: new Date().toISOString()
            };
        }
        
        // Return default values if all fallbacks fail
        return {
            priceEUR: 0,
            priceUSD: 0,
            timestamp: new Date().toISOString()
        };
    }
}

// Fetch exchange rates using Yahoo Finance
async function fetchExchangeRates() {
    try {
        logger.debug('Fetching exchange rates using Yahoo Finance');
        
        // Get EUR to USD rate
        const eurUsdData = await fetchYahooFinanceData('EURUSD=X', Math.floor(Date.now() / 1000) - 24 * 60 * 60, Math.floor(Date.now() / 1000));
        
        // Get EUR to PLN rate
        const eurPlnData = await fetchYahooFinanceData('EURPLN=X', Math.floor(Date.now() / 1000) - 24 * 60 * 60, Math.floor(Date.now() / 1000));
        
        // Get EUR to GBP rate
        const eurGbpData = await fetchYahooFinanceData('EURGBP=X', Math.floor(Date.now() / 1000) - 24 * 60 * 60, Math.floor(Date.now() / 1000));
        
        // Get latest rates
        const eurUsdDates = Object.keys(eurUsdData).sort();
        const eurPlnDates = Object.keys(eurPlnData).sort();
        const eurGbpDates = Object.keys(eurGbpData).sort();
        
        const eurUsd = eurUsdDates.length > 0 ? eurUsdData[eurUsdDates[eurUsdDates.length - 1]].close : 1.1;
        const eurPln = eurPlnDates.length > 0 ? eurPlnData[eurPlnDates[eurPlnDates.length - 1]].close : 4.5;
        const eurGbp = eurGbpDates.length > 0 ? eurGbpData[eurGbpDates[eurGbpDates.length - 1]].close : 0.85;
        
        // Calculate USD rates for common currencies
        const usdEur = 1 / eurUsd;
        const usdPln = eurPln / eurUsd;
        const usdGbp = eurGbp / eurUsd;
        
        // Create rates objects
        const eurRates = {
            USD: eurUsd,
            PLN: eurPln,
            GBP: eurGbp,
            CHF: 0.95, // Default value, can be fetched similarly with EURCHF=X
            JPY: 160,  // Default value, can be fetched similarly with EURJPY=X
        };
        
        const usdRates = {
            EUR: usdEur,
            PLN: usdPln,
            GBP: usdGbp,
            CHF: 0.85, // Default value
            JPY: 145,  // Default value
        };
        
        await priceCache.updateExchangeRates(eurRates, usdRates);
        
        logger.info(`Exchange rates updated: 1 EUR = ${eurUsd} USD, 1 EUR = ${eurPln} PLN`);
    } catch (error) {
        logger.error('Error fetching exchange rates from Yahoo Finance:', error);
    }
}

// Fetch historical BTC data using Yahoo Finance
async function fetchHistoricalBTCData() {
    try {
        const settings = loadSettings();
        const yearsToFetch = parseInt(settings.historicalDataYears || '1');
        
        logger.info(`Fetching ${yearsToFetch} years of historical BTC data`);
        
        // Calculate start and end dates
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (yearsToFetch * 365 * 24 * 60 * 60); // X years ago in seconds
        
        // Get historical data for BTC-USD
        const btcUsdData = await fetchYahooFinanceData('BTC-USD', startDate, endDate);
        
        // Get historical data for BTC-EUR
        const btcEurData = await fetchYahooFinanceData('BTC-EUR', startDate, endDate);
        
        // Find common dates (intersection)
        const usdDates = new Set(Object.keys(btcUsdData));
        const eurDates = new Set(Object.keys(btcEurData));
        const commonDates = [...usdDates].filter(date => eurDates.has(date)).sort();
        
        logger.debug(`Yahoo Finance returned ${Object.keys(btcUsdData).length} USD entries, ${Object.keys(btcEurData).length} EUR entries, ${commonDates.length} common dates`);
        
        if (commonDates.length === 0) {
            logger.warn('No common dates found between USD and EUR data from Yahoo Finance');
            return;
        }
        
        // Create the formatted data structure
        const newHistoricalData = commonDates.map(date => ({
            date,
            priceEUR: btcEurData[date].close,
            timestamp: new Date(date).getTime(),
            priceUSD: btcUsdData[date].close,
            price: btcEurData[date].close // Use EUR as the default price
        }));
        
        // Use new historical data
        historicalBTCData = newHistoricalData;
        
        // Save to file
        saveHistoricalBTCData();
        
        logger.info(`Historical BTC data updated with ${historicalBTCData.length} days of data`);
        
        // Get today's price to ensure we have the latest data point
        await fetchCurrentBTCPrice();
        
        return historicalBTCData;
    } catch (error) {
        logger.error('Error fetching historical BTC data:', error);
    }
}

// Helper function to fetch data from Yahoo Finance API
async function fetchYahooFinanceData(symbol, startDate, endDate) {
    logger.debug(`Fetching Yahoo Finance data for ${symbol} from ${new Date(startDate * 1000).toISOString().split('T')[0]} to ${new Date(endDate * 1000).toISOString().split('T')[0]}`);
    
    try {
        // Yahoo Finance API v8 endpoint with region and lang parameters
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
        
        const params = {
            period1: startDate,
            period2: endDate,
            interval: '1d',
            events: 'history',
            includeAdjustedClose: true,
            region: 'US',
            lang: 'en-US',
            corsDomain: 'finance.yahoo.com'
        };
        
        // Add necessary headers to avoid being blocked
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://finance.yahoo.com',
            'Referer': 'https://finance.yahoo.com',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        };
        
        const response = await axios.get(url, { 
            params,
            headers,
            timeout: 10000
        });
        
        if (!response.data) {
            throw new Error('No data received from Yahoo Finance');
        }
        
        if (response.data.error) {
            throw new Error(`Yahoo Finance API error: ${response.data.error.description || 'Unknown error'}`);
        }
        
        if (!response.data.chart || !response.data.chart.result || !response.data.chart.result[0]) {
            throw new Error('Invalid data format received from Yahoo Finance');
        }
        
        const result = response.data.chart.result[0];
        if (!result.timestamp || !result.indicators || !result.indicators.quote || !result.indicators.quote[0]) {
            throw new Error('Missing required data fields in Yahoo Finance response');
        }
        
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];
        
        // Process data and create a map with date as key
        const data = {};
        timestamps.forEach((timestamp, i) => {
            if (quotes.close && quotes.close[i] !== null) {
                const date = new Date(timestamp * 1000).toISOString().split('T')[0];
                data[date] = {
                    date,
                    timestamp: timestamp * 1000,
                    close: quotes.close[i]
                };
            }
        });
        
        const dataPoints = Object.keys(data).length;
        if (dataPoints === 0) {
            throw new Error('No valid data points found in Yahoo Finance response');
        }
        
        logger.debug(`Yahoo Finance API returned ${dataPoints} data points for ${symbol}`);
        return data;
        
    } catch (error) {
        logger.error(`Error fetching Yahoo Finance data for ${symbol}:`, error.message);
        
        if (error.response) {
            const status = error.response.status;
            if (status === 404) {
                throw new Error(`Symbol ${symbol} not found on Yahoo Finance`);
            } else if (status === 429) {
                throw new Error('Rate limit exceeded for Yahoo Finance API');
            } else if (status >= 500) {
                throw new Error('Yahoo Finance service is currently unavailable');
            }
        } else if (error.request) {
            throw new Error('No response received from Yahoo Finance');
        }
        
        throw error;
    }
}

// Update data periodically (reduced frequency to avoid Yahoo Finance rate limits)
setInterval(fetchCurrentBTCPrice, 10 * 60 * 1000); // Every 10 minutes (was 5 minutes)
setInterval(fetchExchangeRates, 2 * 60 * 60 * 1000); // Every 2 hours (was 1 hour)

// Update historical data refresh to use settings
function setupHistoricalDataRefresh() {
    try {
        const settings = loadSettings();
        const refreshHours = parseInt(settings.historicalDataRefreshHours || '24');
        
        logger.info(`Setting up historical data refresh interval: ${refreshHours} hours`);
        
        // Convert hours to milliseconds
        const refreshInterval = refreshHours * 60 * 60 * 1000;
        
        // Clear any existing interval
        if (global.historicalDataRefreshInterval) {
            clearInterval(global.historicalDataRefreshInterval);
        }
        
        // Set up new interval
        global.historicalDataRefreshInterval = setInterval(fetchHistoricalBTCData, refreshInterval);
        
        // Run initial fetch if needed
        if (!historicalBTCData || historicalBTCData.length === 0) {
            logger.info('No historical data found, running initial fetch');
            fetchHistoricalBTCData().catch(err => 
                logger.error('Initial historical data fetch failed:', err)
            );
        }
    } catch (error) {
        logger.error('Error setting up historical data refresh:', error);
        
        // Fallback to default 24 hours
        global.historicalDataRefreshInterval = setInterval(fetchHistoricalBTCData, 24 * 60 * 60 * 1000);
    }
}

// Call setup function to initialize the interval
setupHistoricalDataRefresh();

// Import CSV data with Transaction model support
function importCSVData(csvFilePath) {
    return new Promise(async (resolve, reject) => {
        try {
            logger.info(`Reading CSV file from path: ${csvFilePath}`);
            
            if (!fs.existsSync(csvFilePath)) {
                return reject(new Error(`CSV file not found at path: ${csvFilePath}`));
            }
            
            const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
            logger.debug(`CSV file read, content length: ${fileContent.length} bytes`);
            
            if (fileContent.length === 0) {
                return reject(new Error('CSV file is empty'));
            }
            
            parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            }, async (err, records) => {
                if (err) {
                    logger.error('Error parsing CSV:', err);
                    reject(new Error(`Failed to parse CSV: ${err.message}`));
                    return;
                }
            
                if (!records || records.length === 0) {
                    logger.warn('No valid records found in CSV file');
                    reject(new Error('No valid records found in CSV file'));
                    return;
                }
                
                logger.info(`CSV parsed successfully. Found ${records.length} records`);
                
                await currencyConverter.ensureRates();
                
                const newTransactions = [];
                let skippedCount = 0;
                
                for (const record of records) {
                    try {
                        const date = record['Date'] || record['Data transakcji'] || new Date().toISOString();
                        const type = (record['Type'] || record['Typ transakcji'] || 'buy').toLowerCase();
                        const amount = parseFloat(record['Amount (BTC)'] || record['Amount'] || record['Wolumen zakupiony (BTC)'] || 0);
                        const exchange = record['Exchange'] || 'manual';
                        const paymentMethod = '';
                        
                        const origCurrency = record['Original Currency'] || record['Waluta oryginalna'] || 'EUR';
                        const origPrice = parseFloat(record['Original Price'] || record['Cena oryginalna'] || 0);
                        const origCost = parseFloat(record['Original Cost'] || record['Koszt oryginalny'] || 0);
                        const origFee = parseFloat(record['Original Fee'] || record['Opłata oryginalna'] || 0);
                        
                        if (!amount || !type || !origCurrency || !origPrice) {
                            logger.warn('Skipping invalid record:', record);
                            skippedCount++;
                            continue;
                        }
                        
                        const transactionData = {
                            id: uuidv4(),
                            exchange,
                            type,
                            amount,
                            date,
                            txType: 'spot',
                            status: 'Completed',
                            paymentMethod,
                            
                            original: {
                                currency: origCurrency,
                                price: origPrice,
                                cost: origCost,
                                fee: origFee
                            },
                            
                            pair: `BTC/${origCurrency}`,
                            baseCurrency: 'BTC',
                            quoteCurrency: origCurrency
                        };
                        
                        if (origCurrency.toUpperCase() !== 'EUR') {
                            try {
                                const eurValues = currencyConverter.convertValues({
                                    price: origPrice,
                                    cost: origCost,
                                    fee: origFee
                                }, origCurrency, 'EUR');
                                
                                transactionData.base = {
                                    eur: {
                                        price: eurValues.price,
                                        cost: eurValues.cost,
                                        fee: eurValues.fee,
                                        rate: eurValues.rate
                                    }
                                };
                            } catch (error) {
                                logger.error(`Error converting ${origCurrency} to EUR:`, error.message);
                                transactionData.base = {
                                    eur: {
                                        price: origPrice,
                                        cost: origCost,
                                        fee: origFee,
                                        rate: 1.0
                                    }
                                };
                            }
                        } else {
                            transactionData.base = {
                                eur: {
                                    price: origPrice,
                                    cost: origCost,
                                    fee: origFee,
                                    rate: 1.0
                                }
                            };
                        }
                        
                        if (origCurrency.toUpperCase() !== 'USD') {
                            try {
                                const usdValues = currencyConverter.convertValues({
                                    price: origPrice,
                                    cost: origCost,
                                    fee: origFee
                                }, origCurrency, 'USD');
                                
                                transactionData.base.usd = {
                                    price: usdValues.price,
                                    cost: usdValues.cost,
                                    fee: usdValues.fee,
                                    rate: usdValues.rate
                                };
                            } catch (error) {
                                logger.error(`Error converting ${origCurrency} to USD:`, error.message);
                                transactionData.base.usd = {
                                    price: origPrice,
                                    cost: origCost,
                                    fee: origFee,
                                    rate: 1.0
                                };
                            }
                        } else {
                            transactionData.base.usd = {
                                price: origPrice,
                                cost: origCost,
                                fee: origFee,
                                rate: 1.0
                            };
                        }
                        
                        const transaction = new Transaction(transactionData);
                        
                        if (transaction.isValid()) {
                            newTransactions.push(transaction.toJSON());
                        } else {
                            logger.warn('Skipping invalid transaction:', transactionData);
                        }
                    } catch (recordError) {
                        logger.error('Error processing record:', recordError, record);
                    }
                }

                newTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

                logger.info(`CSV Import Summary: ${records.length} records, ${newTransactions.length} valid transactions, ${skippedCount} skipped`);

                // Append new transactions instead of replacing all transactions
                const existingTransactionIds = new Set(transactions.map(tx => tx.id));
                const uniqueNewTransactions = newTransactions.filter(tx => !existingTransactionIds.has(tx.id));
                
                logger.info(`Found ${uniqueNewTransactions.length} unique new transactions to add`);
                
                // Combine existing and new transactions
                transactions = [...transactions, ...uniqueNewTransactions];
                
                // Sort all transactions by date
                transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                await saveData();
                logger.info(`Added ${uniqueNewTransactions.length} new transactions. Total transaction count: ${transactions.length}`);
            
                resolve();
            });
        } catch (error) {
            logger.error('Error importing CSV data:', error);
            reject(error);
        }
    });
}

// Routes for API
app.get('/api/transactions', isAuthenticated, (req, res) => {
    try {
        const transactionsToSend = Array.isArray(transactions) ? transactions : [];
        
        const settings = loadSettings();
        const mainCurrency = settings.mainCurrency || 'EUR';
        const secondaryCurrency = settings.secondaryCurrency || 'USD';
        
        const cachedPrices = priceCache.getCachedPrices();
        const currentBTCPriceMain = priceCache.getBTCPrice(mainCurrency) || 0;
        const mainToSecondaryRate = priceCache.getExchangeRate(mainCurrency, secondaryCurrency) || 1.0;

        const processedTransactions = transactionsToSend.map(tx => {
            if (tx.type !== 'buy') return tx;
            
            const amount = Number(tx.amount) || 0;
            
            const currentValueMain = amount * currentBTCPriceMain;
            const currentValueSecondary = currentValueMain * mainToSecondaryRate;
            
            const costMain = tx.base?.[mainCurrency.toLowerCase()]?.cost || 0;
            const costSecondary = tx.base?.[secondaryCurrency.toLowerCase()]?.cost || (costMain * mainToSecondaryRate);

            const pnlMain = currentValueMain - costMain;
            const pnlSecondaryCalculated = currentValueSecondary - costSecondary;
            
            const pnlPercentageMain = costMain > 0 ? (pnlMain / costMain) * 100 : 0;
            const pnlPercentageSecondary = costSecondary > 0 ? (pnlSecondaryCalculated / costSecondary) * 100 : 0;
            
            return {
                ...tx,
                currentValue: {
                    [mainCurrency.toLowerCase()]: currentValueMain,
                    [secondaryCurrency.toLowerCase()]: currentValueSecondary
                },
                pnl: {
                    [mainCurrency.toLowerCase()]: pnlMain,
                    [secondaryCurrency.toLowerCase()]: pnlSecondaryCalculated
                },
                pnl: pnlMain, 
                pnlPercentage: pnlPercentageMain,
                pnlSecondary: pnlSecondaryCalculated,
                pnlPercentageSecondary: pnlPercentageSecondary
            };
        });

        logger.debug(`Sending ${processedTransactions.length} transactions to client with updated P&L values using ${mainCurrency}/${secondaryCurrency}`);
        res.json(processedTransactions);
    } catch (error) {
        logger.error('Error fetching transactions:', error);
        res.json([]);
    }
});

app.get('/api/transactions/summary', isAuthenticated, (req, res) => {
    const cachedPrices = priceCache.getCachedPrices();

    const totalBTC = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCost = transactions.reduce((sum, t) => sum + t.cost, 0);
    const totalFees = transactions.reduce((sum, t) => sum + t.fee, 0);
    const currentValue = totalBTC * currentBTCPrice;
    const pnl = currentValue - totalCost;
    const pnlPercentage = (pnl / totalCost) * 100;
    
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

app.get('/api/summary', isAuthenticated, async (req, res) => {
    try {
        const forceFresh = req.query.fresh === 'true';
        const priceOnly = req.query.priceOnly === 'true';
        
        // Get current transaction stats for cache validation
        const transactionStats = {
            count: transactions.length,
            // Use the last transaction's date as a timestamp, or current time if no transactions
            timestamp: transactions.length > 0 
                ? transactions[transactions.length - 1].date 
                : new Date().toISOString()
        };
        
        // Function to calculate summary data
        const calculateSummary = async () => {
            const settings = loadSettings();
            const mainCurrency = settings.mainCurrency || 'EUR';
            const secondaryCurrency = settings.secondaryCurrency || 'USD';
            
            logger.debug(`Using currencies: Main=${mainCurrency}, Secondary=${secondaryCurrency}`);
    
            const totalBTC = transactions.reduce((total, tx) => {
                if (tx.type === 'buy') {
                    return total + (Number(tx.amount) || 0);
                } else if (tx.type === 'sell') {
                    return total - (Number(tx.amount) || 0);
                }
                return total;
            }, 0);
    
            const cachedPrices = priceCache.getCachedPrices();
            logger.debug(`[server.js] Cached prices retrieved for summary:`, {
                priceEUR: cachedPrices.priceEUR,
                priceUSD: cachedPrices.priceUSD,
                eurUsd: cachedPrices.eurUsd,
                eurPln: cachedPrices.eurPln,
                eurBrl: cachedPrices.eurBrl,
                eurGbp: cachedPrices.eurGbp,
                eurJpy: cachedPrices.eurJpy,
                eurChf: cachedPrices.eurChf,
                timestamp: cachedPrices.timestamp
            });
            
            const currentBTCPriceEUR = cachedPrices.priceEUR || 0;
            
            let secondaryRate = 1.0;
            if (mainCurrency !== secondaryCurrency) {
                 secondaryRate = priceCache.getExchangeRate(mainCurrency, secondaryCurrency) || 1.0;
                 logger.debug(`[server.js] Exchange rate ${mainCurrency}/${secondaryCurrency}: ${secondaryRate}`);
            }
            secondaryRate = Number(secondaryRate) || 1.0; 
    
            const currentBTCPriceMain = priceCache.getBTCPrice(mainCurrency) || 0;
            const currentValueMain = totalBTC * currentBTCPriceMain;
            const currentValueSecondary = currentValueMain * secondaryRate;
    
            const buyTotals = transactions.reduce((totals, tx) => {
                if (tx.type === 'buy') {
                    const amount = Number(tx.amount) || 0;
                    const costMain = Number(tx.base?.[mainCurrency.toLowerCase()]?.cost || 0);
                    const costEUR = Number(tx.base?.eur?.cost || tx.cost || 0);
                    const finalCostMain = costMain || (costEUR * priceCache.getExchangeRate('EUR', mainCurrency));
                    const costSecondary = finalCostMain * secondaryRate;
                    
                    return {
                        totalSpentMain: totals.totalSpentMain + finalCostMain,
                        totalSpentSecondary: totals.totalSpentSecondary + costSecondary,
                        totalAmountBought: totals.totalAmountBought + amount 
                    };
                }
                return totals;
            }, { totalSpentMain: 0, totalSpentSecondary: 0, totalAmountBought: 0 });
    
            const averagePriceMain = buyTotals.totalAmountBought > 0 ? buyTotals.totalSpentMain / buyTotals.totalAmountBought : 0;
            const averagePriceSecondary = buyTotals.totalAmountBought > 0 ? buyTotals.totalSpentSecondary / buyTotals.totalAmountBought : 0;
            const totalPnLMain = currentValueMain - buyTotals.totalSpentMain;
            const totalPnLSecondary = currentValueSecondary - buyTotals.totalSpentSecondary;
            const pnlPercentageMain = buyTotals.totalSpentMain > 0 ? (totalPnLMain / buyTotals.totalSpentMain) * 100 : 0;
            const pnlPercentageSecondary = buyTotals.totalSpentSecondary > 0 ? (totalPnLSecondary / buyTotals.totalSpentSecondary) * 100 : 0;
            
            const summary = {
                // Never include transactions in cached data
                hasTransactions: transactions.length > 0,
                totalBTC,
                
                mainCurrency: mainCurrency,
                secondaryCurrency: secondaryCurrency,
                secondaryRate: secondaryRate,
                eurUsd: cachedPrices.eurUsd || 1.13,
                eurPln: cachedPrices.eurPln || 4.28,
                eurGbp: cachedPrices.eurGbp || 0.85,
                eurJpy: cachedPrices.eurJpy || 160,
                eurChf: cachedPrices.eurChf || 0.95,
                eurBrl: cachedPrices.eurBrl || 6.0,
    
                currentPrice: {
                    [mainCurrency.toLowerCase()]: currentBTCPriceMain || 0,
                    [secondaryCurrency.toLowerCase()]: (currentBTCPriceMain * secondaryRate) || 0 
                },
                totalCost: {
                    [mainCurrency.toLowerCase()]: buyTotals.totalSpentMain || 0,
                    [secondaryCurrency.toLowerCase()]: buyTotals.totalSpentSecondary || 0
                },
                currentValue: {
                    [mainCurrency.toLowerCase()]: currentValueMain || 0,
                    [secondaryCurrency.toLowerCase()]: currentValueSecondary || 0
                },
                pnl: {
                    [mainCurrency.toLowerCase()]: totalPnLMain || 0,
                    [secondaryCurrency.toLowerCase()]: totalPnLSecondary || 0
                },
                averagePrice: {
                    [mainCurrency.toLowerCase()]: averagePriceMain || 0,
                    [secondaryCurrency.toLowerCase()]: averagePriceSecondary || 0
                },
                pnlPercentage: pnlPercentageMain || 0,
                
                btcPrice: currentBTCPriceMain,
                price: currentBTCPriceMain,
                priceEUR: currentBTCPriceEUR || 0,
                priceUSD: cachedPrices.priceUSD || 0,
                timestamp: cachedPrices.timestamp,
                exchangeRates: cachedPrices.exchangeRates || {},
                cacheInfo: {
                    priceLastUpdated: priceCache.getPriceLastUpdated(),
                    ratesLastUpdated: priceCache.getRatesLastUpdated(),
                    summaryCacheDate: new Date().toISOString()
                },
                
                totalCost: buyTotals.totalSpentMain || 0, 
                currentValue: currentValueMain || 0,
                pnl: totalPnLMain || 0,
                averagePrice: averagePriceMain || 0, 
                
                secondaryValue: {
                    totalCost: buyTotals.totalSpentSecondary || 0,
                    currentValue: currentValueSecondary || 0,
                    pnl: totalPnLSecondary || 0,
                    pnlPercentage: pnlPercentageSecondary || 0, 
                    averagePrice: averagePriceSecondary || 0 
                },
                // Don't include historical data in cache
            };
    
            return summary;
        };

        // Use summaryCache to get data (from cache or fresh calculation)
        const summary = await summaryCache.getSummary(
            calculateSummary, 
            forceFresh,
            transactionStats.count,
            transactionStats.timestamp
        );

        // Add transactions and historical data only when sending to client (not in cache)
        if (!priceOnly) {
            summary.transactions = transactions;
            summary.historicalBTCData = historicalBTCData;
        }

        if (priceOnly) {
            logger.info('[server.js] Sending price-only summary to client with ALL exchange rates:');
            logger.info(`[server.js] EUR rates - USD: ${summary.eurUsd}, PLN: ${summary.eurPln}, GBP: ${summary.eurGbp}, JPY: ${summary.eurJpy}, CHF: ${summary.eurChf}, BRL: ${summary.eurBrl}`);
            logger.info(`[server.js] BTC prices - EUR: ${summary.priceEUR}, USD: ${summary.priceUSD}`);
            logger.info(`[server.js] Timestamp: ${summary.timestamp}`);
            if (summary.exchangeRates && summary.exchangeRates.USD) {
                logger.info(`[server.js] USD rates - EUR: ${summary.exchangeRates.USD.EUR}, PLN: ${summary.exchangeRates.USD.PLN}, GBP: ${summary.exchangeRates.USD.GBP}, JPY: ${summary.exchangeRates.USD.JPY}, CHF: ${summary.exchangeRates.USD.CHF}, BRL: ${summary.exchangeRates.USD.BRL}`);
            }
        } else {
            logger.debug('Sending full summary to client');
        }
        res.json(summary);
    } catch (error) {
        logger.error('Error getting summary:', error);
        res.status(500).json({ 
            error: 'Failed to get summary', 
            details: error.message,
            totalBTC: 0, 
            totalCost: { eur: 0 },
            currentValue: { eur: 0 },
            pnl: { eur: 0 },
            averagePrice: { eur: 0 },
            currentPrice: { eur: 0 },
            pnlPercentage: 0,
            transactions: [],
            hasTransactions: false
        });
    }
});

// Function to get exchange rates
async function getExchangeRates() {
    try {
        const cachedPrices = priceCache.getCachedPrices();
        if (cachedPrices.exchangeRates) {
            return cachedPrices.exchangeRates;
        }
        
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
        const rates = response.data.rates;
        
        const eurRates = {};
        for (const currency in rates) {
            eurRates[currency] = rates[currency];
        }
        
        priceCache.updateExchangeRates(eurRates);
        
        return eurRates;
    } catch (error) {
        logger.error('Error fetching exchange rates:', error);
        return { EUR: 1, USD: 1.1, PLN: 4.5 };
    }
}

// Add new endpoint for current price
app.get('/api/current-price', isAuthenticated, async (req, res) => {
    try {
        logger.debug('Processing /api/current-price request');
        
        const cachedPrices = priceCache.getCachedPrices();
        const settings = loadSettings();
        
        // Get historical price data for weekly calculations
        loadHistoricalDataFromFile();
        
        // Find price from 7 days ago
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        logger.debug(`Looking for price data from ${sevenDaysAgoStr}`);
        
        // Find the closest date to 7 days ago in our historical data
        let weeklyPrice = null;
        let closestDate = null;
        let smallestDiff = Infinity;
        
        if (Array.isArray(historicalBTCData) && historicalBTCData.length > 0) {
            // Sort by date (newest first) to find the closest date efficiently
            const sortedData = [...historicalBTCData].sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            );
            
            // Target timestamp for 7 days ago
            const targetTimestamp = sevenDaysAgo.getTime();
            
            // Find closest date
            for (const dataPoint of sortedData) {
                if (!dataPoint.date) continue;
                
                const dataDate = new Date(dataPoint.date);
                const diff = Math.abs(dataDate.getTime() - targetTimestamp);
                
                if (diff < smallestDiff) {
                    smallestDiff = diff;
                    closestDate = dataPoint.date;
                    weeklyPrice = dataPoint.priceEUR || dataPoint.price || 0;
                    
                    // If we find an exact match or very close, break early
                    if (diff < 24 * 60 * 60 * 1000) { // Within 1 day
                        break;
                    }
                }
            }
            
            logger.debug(`Found historical price from ${closestDate}: ${weeklyPrice} EUR`);
        } else {
            logger.debug('No historical data available for weekly price calculation');
            weeklyPrice = cachedPrices.previousWeekPrice || cachedPrices.previousDayPrice || cachedPrices.priceEUR;
        }
        
        const forceFresh = req.query.fresh === 'true';
        if (forceFresh || !cachedPrices.priceEUR || !cachedPrices.timestamp) {
            logger.debug('Fetching fresh BTC price from Yahoo Finance');
            
            // Get fresh data from Yahoo
            const priceData = await fetchCurrentBTCPrice();
            
            if (!priceData || !priceData.priceEUR) {
                throw new Error('Failed to fetch current BTC price from Yahoo Finance');
            }
            
            // For exchange rates, use cached rates if available
            const responseData = {
                priceEUR: priceData.priceEUR,
                priceUSD: priceData.priceUSD,
                timestamp: new Date(),
                eurUsd: cachedPrices.eurUsd || priceData.priceUSD / priceData.priceEUR,
                eurPln: cachedPrices.eurPln || 4.5,
                eurGbp: cachedPrices.eurGbp || 0.85,
                eurJpy: cachedPrices.eurJpy || 160,
                eurChf: cachedPrices.eurChf || 0.95,
                eurBrl: cachedPrices.eurBrl || 6.34,
                previousDayPrice: cachedPrices.previousDayPrice, // Always in EUR
                previousWeekPrice: weeklyPrice, // Always in EUR
                mainCurrency: settings.mainCurrency || 'EUR',
                weeklyPriceDate: closestDate,
                source: 'Yahoo Finance'
            };

            logger.debug('Current price data fetched fresh from Yahoo Finance');
            
            res.json(responseData);
        } else {
            logger.debug('Using cached price data');
            
            res.json({
                priceEUR: cachedPrices.priceEUR,
                priceUSD: cachedPrices.priceUSD,
                timestamp: cachedPrices.timestamp,
                eurUsd: cachedPrices.eurUsd,
                eurPln: cachedPrices.eurPln,
                eurGbp: cachedPrices.eurGbp,
                eurJpy: cachedPrices.eurJpy,
                eurChf: cachedPrices.eurChf,
                eurBrl: cachedPrices.eurBrl,
                age: cachedPrices.age,
                previousDayPrice: cachedPrices.previousDayPrice, // Always in EUR
                previousWeekPrice: weeklyPrice, // Always in EUR
                mainCurrency: settings.mainCurrency || 'EUR',
                weeklyPriceDate: closestDate,
                source: 'Yahoo Finance (cached)'
            });
        }
    } catch (error) {
        logger.error('Error fetching current price:', error);
        res.status(500).json({ error: 'Failed to fetch current price' });
    }
});

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, DATA_DIR);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
    fileFilter: function (req, file, cb) {
        // Accept only CSV files
        if (!file.originalname.match(/\.(csv)$/)) {
            return cb(new Error('Only CSV files are allowed'));
        }
        cb(null, true);
    }
});

// Admin import endpoint
app.post('/api/admin/import', isAuthenticated, (req, res) => {
    upload.single('file')(req, res, async function (err) {
        if (err) {
            logger.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ error: err.message });
        }

        // Check if the file exists
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            // Set path to the uploaded file
            const csvFilePath = req.file.path;
            logger.debug(`Processing CSV file: ${csvFilePath}`);

            // Import the CSV data
            await importCSVData(csvFilePath);

            // Delete the temporary file
            fs.unlink(csvFilePath, (err) => {
                if (err) {
                    logger.error('Error deleting temporary file:', err);
                }
            });

            res.json({ message: 'Transactions imported successfully' });
        } catch (error) {
            logger.error('Error importing CSV:', error);
            res.status(500).json({ error: 'Failed to import CSV data: ' + error.message });
        }
    });
});

// Add new transaction endpoint
app.post('/api/admin/transactions', isAuthenticated, async (req, res) => {
    try {
        const newTransactionData = req.body;
        
        if (!newTransactionData.date || !newTransactionData.type || !newTransactionData.amount || !newTransactionData.price) {
            return res.status(400).json({ error: 'Missing required transaction fields' });
        }
        
        await currencyConverter.ensureRates();
        
        const transactionData = {
            id: uuidv4(), // Use UUID instead of timestamp
            date: newTransactionData.date,
            type: newTransactionData.type,
            amount: Number(newTransactionData.amount),
            exchange: 'manual',
            txType: 'spot',
            status: 'Completed',
            paymentMethod: '',
            pair: `BTC/${newTransactionData.currency || 'EUR'}`,
            baseCurrency: 'BTC',
            quoteCurrency: newTransactionData.currency || 'EUR',
            original: {
                currency: newTransactionData.currency || 'EUR',
                price: Number(newTransactionData.price),
                cost: Number(newTransactionData.amount) * Number(newTransactionData.price),
                fee: Number(newTransactionData.fee) || 0
            }
        };

        // Add base currency conversions
        const origCurrency = newTransactionData.currency || 'EUR';
        const origPrice = Number(newTransactionData.price);
        const origCost = Number(newTransactionData.amount) * origPrice;
        const origFee = Number(newTransactionData.fee) || 0;

        // Always include EUR base values
        transactionData.base = {
            eur: {
                price: origCurrency === 'EUR' ? origPrice : currencyConverter.convert(origPrice, origCurrency, 'EUR'),
                cost: origCurrency === 'EUR' ? origCost : currencyConverter.convert(origCost, origCurrency, 'EUR'),
                fee: origCurrency === 'EUR' ? origFee : currencyConverter.convert(origFee, origCurrency, 'EUR'),
                rate: origCurrency === 'EUR' ? 1.0 : currencyConverter.getRate(origCurrency, 'EUR')
            }
        };

        // Always include USD base values
        transactionData.base.usd = {
            price: origCurrency === 'USD' ? origPrice : currencyConverter.convert(origPrice, origCurrency, 'USD'),
            cost: origCurrency === 'USD' ? origCost : currencyConverter.convert(origCost, origCurrency, 'USD'),
            fee: origCurrency === 'USD' ? origFee : currencyConverter.convert(origFee, origCurrency, 'USD'),
            rate: origCurrency === 'USD' ? 1.0 : currencyConverter.getRate(origCurrency, 'USD')
        };
        
        const transaction = new Transaction(transactionData);
        
        if (!transaction.isValid()) {
            logger.error('Invalid transaction data:', transactionData);
            return res.status(400).json({ 
                error: 'Invalid transaction data',
                details: 'Transaction validation failed'
            });
        }
        
        const txJson = transaction.toJSON();
        transactions.push(txJson);
        
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        saveData();
        
        res.status(201).json({ 
            message: 'Transaction added successfully',
            transaction: txJson
        });
    } catch (error) {
        logger.error('Error adding transaction:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message 
        });
    }
});

// Get all transactions for admin management (simplified)
app.get('/api/admin/transactions', isAuthenticated, (req, res) => {
    res.json(transactions);
});

// Update a specific transaction (Admin)
app.put('/api/admin/transactions/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;
    logger.debug(`Received PUT request for transaction ID: ${id}`);

    try {
        const transactionIndex = transactions.findIndex(tx => tx.id === id);
        if (transactionIndex === -1) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        const existingTx = transactions[transactionIndex];

        const updatedTxInstance = new Transaction({
            ...existingTx,
            date: updatedData.date,
            type: updatedData.type,
            amount: updatedData.amount,
        });

        updatedTxInstance.original = {
            currency: updatedData.originalCurrency,
            price: updatedData.originalPrice,
            cost: updatedData.amount * updatedData.originalPrice, 
            fee: updatedData.originalFee
        };

        await currencyConverter.ensureRates(); 
        const rates = currencyConverter.getAllRates();

        const originalCurrencyUpper = updatedData.originalCurrency.toUpperCase();
        const rateToEUR = rates[originalCurrencyUpper]?.EUR || 1.0;
        const rateToUSD = rates[originalCurrencyUpper]?.USD || (rateToEUR * rates.EUR?.USD || rateToEUR * 1.1);

        updatedTxInstance.setBaseValues('eur', {
            price: updatedTxInstance.original.price * rateToEUR,
            cost: updatedTxInstance.original.cost * rateToEUR,
            fee: updatedTxInstance.original.fee * rateToEUR,
            rate: rateToEUR
        });

        updatedTxInstance.setBaseValues('usd', {
            price: updatedTxInstance.original.price * rateToUSD,
            cost: updatedTxInstance.original.cost * rateToUSD,
            fee: updatedTxInstance.original.fee * rateToUSD,
            rate: rateToUSD
        });

        const updatedTxJSON = updatedTxInstance.toJSON();
        
        transactions[transactionIndex] = updatedTxJSON;
        
        await saveData(); 

        logger.debug(`Transaction ID: ${id} updated successfully`);
        res.json({ message: 'Transaction updated successfully', transaction: updatedTxJSON });

    } catch (error) {
        logger.error(`Error updating transaction ID: ${id}`, error);
        res.status(500).json({ error: 'Internal server error while updating transaction' });
    }
});

// Delete a specific transaction (Admin)
app.delete('/api/admin/transactions/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    logger.debug(`Received DELETE request for transaction ID: ${id}`);

    try {
        const initialLength = transactions.length;
        transactions = transactions.filter(tx => tx.id !== id);

        if (transactions.length === initialLength) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        await saveData();
        logger.debug(`Transaction ID: ${id} deleted successfully`);
        res.json({ message: 'Transaction deleted successfully' });

    } catch (error) {
        logger.error(`Error deleting transaction ID: ${id}`, error);
        res.status(500).json({ error: 'Internal server error while deleting transaction' });
    }
});

// Update transaction
app.put('/api/transactions/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTxData = req.body;
        
        const index = transactions.findIndex(tx => tx.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        await currencyConverter.ensureRates();
        
        const transaction = new Transaction({
            ...transactions[index],
            ...updatedTxData,
            id: transactions[index].id
        });
        
        if (!transaction.isValid()) {
            return res.status(400).json({ error: 'Invalid transaction data' });
        }
        
        const txJson = transaction.toJSON();
        transactions[index] = txJson;

        saveData();

        res.json(txJson);
    } catch (error) {
        logger.error('Error updating transaction:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// CSV export endpoint with English headers
app.get('/api/transactions/export-csv', isAuthenticated, (req, res) => {
    try {
        let csv = 'Date,Type,Amount (BTC),Exchange,Original Currency,Original Price,Original Cost,Original Fee,EUR Rate,EUR Price,EUR Cost,EUR Fee,USD Rate,USD Price,USD Cost,USD Fee\n';
        
        transactions.forEach(tx => {
            const date = new Date(tx.date).toISOString().split('T')[0];
            
            const original = tx.original || {};
            const origCurrency = original.currency || 'EUR';
            const origPrice = parseFloat(original.price) || 0;
            const origCost = parseFloat(original.cost) || 0;
            const origFee = parseFloat(original.fee) || 0;
            
            const eurBase = tx.base?.eur || {};
            const eurRate = parseFloat(eurBase.rate) || 1.0;
            const eurPrice = parseFloat(eurBase.price) || 0;
            const eurCost = parseFloat(eurBase.cost) || 0;
            const eurFee = parseFloat(eurBase.fee) || 0;
            
            const usdBase = tx.base?.usd || {};
            const usdRate = parseFloat(usdBase.rate) || 1.0;
            const usdPrice = parseFloat(usdBase.price) || 0;
            const usdCost = parseFloat(usdBase.cost) || 0;
            const usdFee = parseFloat(usdBase.fee) || 0;
            
            const row = [
                date,
                tx.type,
                tx.amount.toFixed(8),
                tx.exchange || 'manual',
                origCurrency,
                origPrice.toFixed(2),
                origCost.toFixed(2),
                origFee.toFixed(2),
                eurRate.toFixed(6),
                eurPrice.toFixed(2),
                eurCost.toFixed(2),
                eurFee.toFixed(2),
                usdRate.toFixed(6),
                usdPrice.toFixed(2),
                usdCost.toFixed(2),
                usdFee.toFixed(2)
            ].join(',');
            
            csv += row + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="btc-transactions-${new Date().toISOString().split('T')[0]}.csv"`);
        
        res.send(csv);
    } catch (error) {
        logger.error('Error generating CSV:', error);
        res.status(500).json({ error: 'Failed to generate CSV' });
    }
});

app.get('/api/transactions/template-csv', isAuthenticated, (req, res) => {
    const settings = loadSettings();
    const mainCurrency = settings.mainCurrency || 'EUR';
    
    const template = 
        'Date,Type,Amount (BTC),Exchange,Original Currency,Original Price,Original Cost,Original Fee\n' +
        `2023-01-01,buy,0.1,manual,EUR,25000,2500,5\n` +
        `2023-01-02,buy,0.05,manual,USD,27000,1350,3\n` +
        `2023-01-03,buy,0.025,manual,PLN,130000,3250,15\n`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="btc-transactions-template.csv"');
    res.send(template);
});

// Endpoint to delete all transactions
app.delete('/api/transactions/delete-all', isAuthenticated, (req, res) => {
    try {
        transactions = [];
        
        saveData();
        
        logger.debug('All transactions deleted successfully');
        res.json({ message: 'All transactions deleted successfully' });
    } catch (error) {
        logger.error('Error deleting all transactions:', error);
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
            const defaultSettings = {
                secondaryCurrency: "PLN",
                mainCurrency: "EUR"
            };
            
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
    } catch (error) {
        logger.error('Error loading settings:', error);
        return { secondaryCurrency: "PLN", mainCurrency: "EUR" };
    }
}

// Save settings
function saveSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        logger.error('Error saving settings:', error);
        return false;
    }
}

// Get settings endpoint
app.get('/api/settings', isAuthenticated, (req, res) => {
    const settings = loadSettings();
    res.json(settings);
});

// Update settings endpoint
app.put('/api/settings', isAuthenticated, async (req, res) => {
    try {
        const newSettings = req.body;
        
        if (!newSettings.secondaryCurrency) {
            return res.status(400).json({ error: 'Missing secondaryCurrency' });
        }
        
        // Get current settings to check for changes
        const currentSettings = loadSettings();
        
        // Save the new settings
        if (saveSettings(newSettings)) {
            // Check if currency settings changed
            const mainCurrencyChanged = 
                currentSettings.mainCurrency !== newSettings.mainCurrency;
            const secondaryCurrencyChanged = 
                currentSettings.secondaryCurrency !== newSettings.secondaryCurrency;
            
            // If currency settings changed, invalidate cache to force immediate recalculation
            if (mainCurrencyChanged || secondaryCurrencyChanged) {
                logger.debug('[server.js] Currency settings changed, invalidating summary cache');
                logger.debug(`[server.js] Main currency: ${currentSettings.mainCurrency} → ${newSettings.mainCurrency}`);
                logger.debug(`[server.js] Secondary currency: ${currentSettings.secondaryCurrency} → ${newSettings.secondaryCurrency}`);
                
                // Force immediate cache invalidation
                summaryCache.invalidateCache();
                
                // Also clear price cache to ensure fresh exchange rates
                await priceCache.clearCache();
                
                // Force fresh rate fetch
                setTimeout(async () => {
                    try {
                        logger.debug('[server.js] Fetching fresh exchange rates after currency change');
                        await currencyConverter.ensureRates();
                        await priceCache.updatePrices();
                        logger.debug('[server.js] Fresh exchange rates fetched successfully');
                    } catch (error) {
                        logger.error('[server.js] Error fetching fresh rates after currency change:', error);
                    }
                }, 100);
            }
            
            // Check if historical data settings changed
            const refreshHoursChanged = 
                currentSettings.historicalDataRefreshHours !== newSettings.historicalDataRefreshHours;
            const yearsChanged = 
                currentSettings.historicalDataYears !== newSettings.historicalDataYears;
            
            // If refresh hours changed, update the interval
            if (refreshHoursChanged) {
                logger.debug('[server.js] Historical data refresh interval setting changed, updating interval');
                setupHistoricalDataRefresh();
            }
            
            // If years changed, might need to fetch more data
            if (yearsChanged) {
                const oldYears = parseInt(currentSettings.historicalDataYears || '1');
                const newYears = parseInt(newSettings.historicalDataYears || '1');
                
                if (newYears > oldYears) {
                    logger.debug(`[server.js] Historical data years setting increased from ${oldYears} to ${newYears}, scheduling data fetch`);
                    // Schedule fetch after response is sent to avoid timeout
                    setTimeout(() => {
                        fetchHistoricalBTCData().catch(err => 
                            logger.error('[server.js] Historical data fetch after settings change failed:', err)
                        );
                    }, 100);
                }
            }
            
            // Add response indicating currency changes for client-side handling
            const responseData = { 
                message: 'Settings saved', 
                settings: newSettings 
            };
            
            if (mainCurrencyChanged || secondaryCurrencyChanged) {
                responseData.settingsChanged = {
                    mainCurrency: mainCurrencyChanged,
                    secondaryCurrency: secondaryCurrencyChanged
                };
                responseData.message = 'Settings saved - currency settings changed, cache invalidated';
            }
            
            res.json(responseData);
        } else {
            res.status(500).json({ error: 'Failed to save settings' });
        }
    } catch (error) {
        logger.error('[server.js] Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test Yahoo Finance API connectivity (replacing CoinGecko test)
app.post('/api/settings/test-coingecko-key', isAuthenticated, async (req, res) => {
    try {
        // Note: This function is kept for backwards compatibility with the frontend
        // but no longer tests CoinGecko API key since we now use Yahoo Finance

        logger.debug('[server.js] Testing Yahoo Finance API connectivity');
        
        // Calculate current date timestamps (today only)
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (24 * 60 * 60); // 1 day ago
        
        // Test Yahoo Finance connection for BTC price
        const btcUsdData = await fetchYahooFinanceData('BTC-USD', startDate, endDate);
        
        if (!btcUsdData || Object.keys(btcUsdData).length === 0) {
            return res.json({ 
                success: false, 
                message: 'Could not connect to Yahoo Finance API'
            });
        }
        
        // Get the most recent price
        const dates = Object.keys(btcUsdData).sort();
        if (dates.length === 0) {
            return res.json({
                success: false,
                message: 'No data returned from Yahoo Finance'
            });
        }
        
        const latestDate = dates[dates.length - 1];
        const currentPrice = btcUsdData[latestDate].close;
        
        res.json({ 
            success: true, 
            message: 'Connection to Yahoo Finance API successful!',
            currentPrice: currentPrice,
            source: 'Yahoo Finance'
        });
    } catch (error) {
        logger.error('[server.js] Yahoo Finance API error:', error);
            
        res.json({ 
            success: false, 
            message: 'Error connecting to Yahoo Finance API: ' + error.message
        });
    }
});

// Login page
app.get('/login', isSetupNeeded, (req, res) => {
    let errorParam = '';
    if (req.query.error) {
        errorParam = `?error=${encodeURIComponent(req.query.error)}`;
    } else if (req.session && req.session.messages && req.session.messages.length > 0) {
        errorParam = `?error=${encodeURIComponent(req.session.messages[0])}`;
        req.session.messages = [];
    }
    
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
    
    if (errorParam) {
        logger.warn('Login failed:', decodeURIComponent(errorParam.substring(7)));
    }
});

// Login form submission - Update the failure redirect to include the error
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            logger.error('[server.js] Login error:', err);
            return res.redirect('/login?error=' + encodeURIComponent('An error occurred during login'));
        }
        
        if (!user) {
            const errorMessage = info && info.message ? info.message : 'Invalid username or password';
            logger.debug('[server.js] Login failed:', errorMessage);
            return res.redirect('/login?error=' + encodeURIComponent(errorMessage));
        }
        
        req.logIn(user, (err) => {
            if (err) {
                logger.error('[server.js] Session error:', err);
                return res.redirect('/login?error=' + encodeURIComponent('Failed to establish session'));
            }
            
            if (req.body.rememberMe) {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            }
            
            return res.redirect('/');
        });
    })(req, res, next);
});

// Setup page (first run)
app.get('/setup', (req, res) => {
    if (userModel.hasUsers()) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Setup form submission
app.post('/setup', async (req, res) => {
    try {
        logger.debug('Setup form submission received');
        
        if (userModel.hasUsers()) {
            return res.redirect('/login');
        }
        
        const { username, password, confirmPassword, enablePin, pin } = req.body;
        
        if (!username || !password) {
            logger.error('Setup error: Username and password are required');
            return res.redirect('/setup?error=' + encodeURIComponent('Username and password are required'));
        }
        
        if (password !== confirmPassword) {
            logger.error('Setup error: Passwords do not match');
            return res.redirect('/setup?error=' + encodeURIComponent('Passwords do not match'));
        }
        
        // Handle PIN if enabled
        let userPin = null;
        if (enablePin && pin) {
            if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
                logger.error('Setup error: PIN must be exactly 4 digits');
                return res.redirect('/setup?error=' + encodeURIComponent('PIN must be exactly 4 digits'));
            }
            userPin = pin;
        }
        
        await userModel.createUser(username, password, userPin);
        
        logger.debug('User created successfully');
        
        // Set flash message for success
        req.flash('success', 'Account created successfully. Please log in.');
        
        res.redirect('/login');
    } catch (error) {
        logger.error('Setup error:', error);
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

// Change password endpoint - Add this right before the wildcard route handler
app.post('/api/user/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }
        
        const userId = req.user.id;
        const user = userModel.findUserById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        await userModel.updateUser(userId, { password: newPassword });
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        logger.error('Error changing password:', error);
        res.status(500).json({ 
            error: 'Failed to change password', 
            message: error.message 
        });
    }
});

// Use exchange routes
app.use('/api', exchangeRoutes);

// Endpoint to fetch comparison ticker data
app.get('/api/comparison-data', isAuthenticated, async (req, res) => {
    try {
        const { symbol, timeRange } = req.query;
        logger.debug(`[comparison-data] Request received for symbol=${symbol}, timeRange=${timeRange}`);
        
        if (!symbol) {
            logger.error('[comparison-data] Symbol parameter is missing');
            return res.status(400).json({ error: 'Symbol parameter is required' });
        }
        
        // Calculate date range based on the requested time range
        const endDate = Math.floor(Date.now() / 1000); // Current time in seconds
        let startDate;
        
        // Parse time range parameter (in days)
        const days = parseInt(timeRange || '365', 10);
        if (isNaN(days)) {
            startDate = Math.floor(endDate - (365 * 24 * 60 * 60)); // Default to 1 year
            logger.debug(`[comparison-data] Invalid timeRange parameter, defaulting to 365 days`);
        } else {
            startDate = Math.floor(endDate - (days * 24 * 60 * 60));
            logger.debug(`[comparison-data] Using timeRange of ${days} days`);
        }
        
        logger.debug(`[comparison-data] Fetching data for ${symbol} from ${new Date(startDate * 1000).toISOString()} to ${new Date(endDate * 1000).toISOString()}`);
        
        // Fetch data from Yahoo Finance
        const yahooData = await fetchYahooFinanceData(symbol, startDate, endDate);
        
        // Check if we got data
        if (!yahooData || Object.keys(yahooData).length === 0) {
            logger.error(`[comparison-data] No data returned from Yahoo Finance for ${symbol}`);
            return res.status(404).json({ 
                error: 'No data available for the specified symbol and time range',
                symbol: symbol,
                timeRange: days
            });
        }
        
        logger.debug(`[comparison-data] Received ${Object.keys(yahooData).length} data points for ${symbol}`);
        
        // Convert to array format for chart.js
        const chartData = Object.values(yahooData).map(item => ({
            x: new Date(item.timestamp).toISOString(),
            y: item.close
        }));
        
        // Sort by date
        chartData.sort((a, b) => new Date(a.x) - new Date(b.x));
        
        // Get symbol metadata
        const symbolDetails = {
            symbol: symbol,
            name: getSymbolName(symbol),
            color: getSymbolColor(symbol)
        };
        
        logger.debug(`[comparison-data] Sending response with ${chartData.length} data points for ${symbol}`);
        
        res.json({
            symbol: symbolDetails,
            data: chartData
        });
    } catch (error) {
        logger.error('[comparison-data] Error fetching comparison data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch comparison data', 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Make sure all API routes are defined BEFORE the catch-all routes
// API endpoint to get PIN-enabled users
app.get('/api/users/pin-enabled', (req, res) => {
    try {
        const users = userModel.getUsers();
        
        // Filter for PIN-enabled users and return only safe user data
        const pinEnabledUsers = users
            .filter(user => user.pinEnabled)
            .map(user => {
                return {
                    id: user.id,
                    username: user.username
                };
            });
        
        res.json(pinEnabledUsers);
    } catch (error) {
        logger.error('[server.js] Error fetching PIN-enabled users:', error);
        res.status(500).json({ error: 'Failed to fetch PIN-enabled users' });
    }
});

// User profile endpoint
app.get('/api/user/profile', isAuthenticated, (req, res) => {
    try {
        // Get current user from session and ensure PIN fields exist
        const userWithPin = userModel.ensurePinFields(req.user);
        const { id, username, created, pinEnabled } = userWithPin;
        
        res.json({
            id,
            username,
            created,
            pinEnabled
        });
    } catch (error) {
        logger.error('[server.js] Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Update PIN settings endpoint
app.post('/api/user/update-pin', isAuthenticated, async (req, res) => {
    try {
        const { enablePin, pin } = req.body;
        logger.debug('[server.js] Updating PIN settings:', { enablePin, hasPin: !!pin });
        
        // Validate PIN if enabling
        if (enablePin && (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin))) {
            return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
        }
        
        // Update PIN settings using userModel
        const updatedUser = await userModel.updatePinSettings(req.user.id, pin, enablePin);
        
        res.json({
            success: true,
            message: enablePin ? 'PIN enabled successfully' : 'PIN disabled successfully',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                pinEnabled: updatedUser.pinEnabled
            }
        });
    } catch (error) {
        logger.error('[server.js] Error updating PIN settings:', error);
        res.status(500).json({ error: error.message || 'Failed to update PIN settings' });
    }
});

// PIN login authentication
app.post('/pin-login', async (req, res) => {
    try {
        const { userId, pin } = req.body;
        logger.debug('[server.js] PIN login attempt for user ID:', userId);
        
        if (!userId || !pin) {
            return res.redirect('/login?error=' + encodeURIComponent('User ID and PIN are required'));
        }
        
        // Find the user
        const user = userModel.findUserById(userId);
        
        if (!user) {
            return res.redirect('/login?error=' + encodeURIComponent('User not found'));
        }
        
        try {
            // Verify PIN
            const isPinValid = await userModel.verifyPin(userId, pin);
            
            if (!isPinValid) {
                return res.redirect('/login?error=' + encodeURIComponent('Invalid PIN'));
            }
            
            // Log user in
            req.login(user, (err) => {
                if (err) {
                    logger.error('[server.js] Error logging in with PIN:', err);
                    return res.redirect('/login?error=' + encodeURIComponent('Login failed'));
                }
                
                // Set session cookie expiration if remembered
                if (req.body.rememberMe) {
                    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
                }
                
                return res.redirect('/');
            });
        } catch (error) {
            logger.error('[server.js] PIN verification error:', error);
            return res.redirect('/login?error=' + encodeURIComponent(error.message));
        }
    } catch (error) {
        logger.error('[server.js] PIN login error:', error);
        res.redirect('/login?error=' + encodeURIComponent(error.message));
    }
});

// Add additional admin routes

// Endpoint to test Yahoo Finance fetching
app.get('/api/admin/test-yahoo', isAuthenticated, async (req, res) => {
    try {
        logger.debug('[server.js] Testing Yahoo Finance integration requested by user:', req.user?.username || 'unknown');
        
        // Force fresh price cache update
        await priceCache.clearCache();
        
        const cachedPrices = priceCache.getCachedPrices();
        
        res.json({ 
            success: true, 
            message: 'Yahoo Finance test completed',
            data: {
                priceEUR: cachedPrices.priceEUR,
                priceUSD: cachedPrices.priceUSD,
                eurBrl: cachedPrices.eurBrl,
                exchangeRates: cachedPrices.exchangeRates,
                timestamp: cachedPrices.timestamp
            }
        });
    } catch (error) {
        logger.error('[server.js] Error testing Yahoo Finance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to test Yahoo Finance',
            error: error.message 
        });
    }
});

// Endpoint to clear the summary cache
app.post('/api/admin/clear-cache', isAuthenticated, (req, res) => {
    try {
        // Clear the summary cache
        summaryCache.clearCache();
        
        logger.debug('[server.js] Summary cache cleared by user:', req.user?.username || 'unknown');
        
        // Return success
        res.json({ 
            success: true, 
            message: 'Summary cache cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error clearing cache:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to clear cache',
            error: error.message 
        });
    }
});

// Endpoint to get application version
app.get('/api/version', (req, res) => {
    try {
        const packageJson = require('../package.json');
        res.json({ 
            version: packageJson.version,
            name: packageJson.name
        });
    } catch (error) {
        logger.error('[server.js] Error fetching version:', error);
        res.status(500).json({ 
            error: 'Failed to fetch version information'
        });
    }
});

// Add endpoint for historical price data 
app.get('/api/history', isAuthenticated, (req, res) => {
    try {
        // Get limit parameter (default to 7 days)
        const limit = parseInt(req.query.limit) || 7;
        
        // Ensure historical data is loaded
        if (!historicalBTCData || historicalBTCData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Historical data not available'
            });
        }
        
        // Sort the data by date (newest first)
        const sortedData = [...historicalBTCData].sort((a, b) => 
            new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date)
        );
        
        // Get the most recent prices up to the limit
        const recentPrices = sortedData.slice(0, limit);
        
        // Add today's price at the beginning
        const cachedPrices = priceCache.getCachedPrices();
        const todayPrice = {
            date: new Date().toISOString().split('T')[0],
            timestamp: cachedPrices.timestamp || new Date().toISOString(),
            priceEUR: cachedPrices.priceEUR,
            priceUSD: cachedPrices.priceUSD,
            price: cachedPrices.price
        };
        
        // Return the data
        res.json({
            success: true,
            prices: [todayPrice, ...recentPrices],
            limit: limit,
            total: historicalBTCData.length
        });
    } catch (error) {
        logger.error('Error fetching historical data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch historical data',
            error: error.message
        });
    }
});

// Add endpoint to manually refresh historical data from admin panel
app.post('/api/admin/refresh-historical-data', isAuthenticated, async (req, res) => {
    try {
        logger.info('Manual refresh of historical data requested from admin panel');
        
        // Load current settings
        const settings = loadSettings();
        const yearsToFetch = parseInt(settings.historicalDataYears || '1');
        logger.info(`Manual refresh requesting ${yearsToFetch} years of data from Yahoo Finance`);
        
        // Call the function to fetch historical data
        const updatedData = await fetchHistoricalBTCData();
        
        // Return success with count of data points
        res.json({
            success: true,
            message: 'Historical data refreshed successfully',
            count: updatedData?.length || historicalBTCData.length
        });
    } catch (error) {
        logger.error('Error refreshing historical data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh historical data',
            error: error.message
        });
    }
});

// *** Catch-all routes should be AFTER all API routes ***
// Serve the main application
app.get(['/', '/admin', '/transactions', '/exchanges'], isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Profile page
app.get('/profile', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Serve HTML pages based on path
app.get('*', (req, res, next) => {
    if (req.path.includes('.') && req.path !== '/') {
        return next();
    }
    
    const publicPaths = ['/login', '/setup', '/logout'];
    const isPublicPath = publicPaths.includes(req.path) || req.path.startsWith('/public/');
    
    if (!isPublicPath && !req.isAuthenticated()) {
        return res.redirect('/login');
    }
    
    if (req.path === '/login' || req.path === '/setup') {
        res.sendFile(path.join(__dirname, 'public', req.path + '.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Server error:', err.stack);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

async function startServer() {
    await priceCache.initialize();
    
    app.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server running on port ${PORT}, accessible on your local network.`);
    });
}

startServer();

// Helper function to get symbol friendly name
function getSymbolName(symbol) {
    const symbolMap = {
        'BTC-USD': 'Bitcoin',
        'ETH-USD': 'Ethereum',
        'SPY': 'S&P 500 ETF',
        'QQQ': 'Nasdaq ETF',
        'GLD': 'Gold ETF',
        'SLV': 'Silver ETF',
        'VNQ': 'Real Estate ETF',
        'AAPL': 'Apple',
        'MSFT': 'Microsoft',
        'GOOGL': 'Google',
        'AMZN': 'Amazon',
        'TSLA': 'Tesla'
    };
    
    return symbolMap[symbol] || symbol;
}

// Helper function to get consistent color for symbols
function getSymbolColor(symbol) {
    const colorMap = {
        'BTC-USD': '#f7931a', // Bitcoin orange
        'ETH-USD': '#627eea', // Ethereum blue
        'SPY': '#21ce99',     // Green
        'QQQ': '#6236ff',     // Purple
        'GLD': '#f5d742',     // Gold
        'SLV': '#c0c0c0',     // Silver
        'VNQ': '#ff6a00',     // Orange
        'AAPL': '#a2aaad',    // Apple gray
        'MSFT': '#00a4ef',    // Microsoft blue
        'GOOGL': '#ea4335',   // Google red
        'AMZN': '#ff9900',    // Amazon orange
        'TSLA': '#cc0000'     // Tesla red
    };
    
    // If no predefined color, generate one based on the symbol string
    if (!colorMap[symbol]) {
        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const color = '#' + ('000000' + (hash & 0xFFFFFF).toString(16)).slice(-6);
        return color;
    }
    
    return colorMap[symbol];
}