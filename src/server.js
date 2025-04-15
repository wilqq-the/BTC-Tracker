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
const exchangeRoutes = require('./routes/exchange-routes');
const Transaction = require('./server/models/Transaction');
const currencyConverter = require('./server/services/currency-converter');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('[server.js] NODE_ENV not set, defaulting to development');
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
    console.log(`[server.js] Updating application transactions array with ${newTransactions.length} transactions`);
    transactions = newTransactions;
  } else {
    console.error('[server.js] Invalid transactions provided to updateTransactions function');
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

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const HISTORICAL_BTC_FILE = path.join(DATA_DIR, 'historical_btc.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'app-settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'btc-tracker-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

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
            
            console.log(`[server.js] Loading ${loadedTransactions.length} transactions from file`);
            
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
            
            console.log(`[server.js] Loaded and processed ${transactions.length} transactions with P&L calculations`);
        } else {
            console.log('[server.js] No transactions file found, starting with empty transactions');
            transactions = [];
        }
    } catch (error) {
        console.error('[server.js] Error loading transactions:', error);
        transactions = [];
    }
}

// Load historical BTC data from file
function loadHistoricalDataFromFile() {
    try {
        if (fs.existsSync(HISTORICAL_BTC_FILE)) {
            const data = fs.readFileSync(HISTORICAL_BTC_FILE, 'utf8');
            historicalBTCData = JSON.parse(data) || [];
            console.log(`[server.js] Loaded ${historicalBTCData.length} historical BTC data points from file`);
        } else {
            console.log('[server.js] No historical BTC data file found. Will fetch later');
            historicalBTCData = [];
        }
    } catch (error) {
        console.error('[server.js] Error loading historical BTC data from file:', error);
        historicalBTCData = [];
    }
}

// Initialize data and ensure rates are current
async function initializeData() {
    try {
        loadHistoricalDataFromFile();
        
        await Promise.all([
            currencyConverter.ensureRates(),
            priceCache.updatePrices()
        ]);
        
        await loadData(); 
        
        if (!historicalBTCData || historicalBTCData.length === 0) {
            console.log("[server.js] Historical data empty after loading from file, triggering initial fetch");
            fetchHistoricalBTCData().catch(err => console.error("[server.js] Initial historical data fetch failed:", err));
        }

    } catch (error) {
        console.error('[server.js] Error initializing data:', error);
    }
}

// Initialize data
initializeData();

// Save data to files
function saveData() {
    try {
        fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
        console.log(`[server.js] Saved ${transactions.length} transactions successfully`);
    } catch (error) {
        console.error('[server.js] Error saving transactions:', error);
    }
}

function saveHistoricalBTCData() {
    try {
        fs.writeFileSync(HISTORICAL_BTC_FILE, JSON.stringify(historicalBTCData, null, 2));
    } catch (error) {
        console.error('[server.js] Error saving historical BTC data:', error);
    }
}

// Fetch current BTC price
async function fetchCurrentBTCPrice() {
    try {
        console.log('[server.js] Fetching current BTC price');
        
        const settings = loadSettings();
        const baseUrl = 'https://api.coingecko.com/api/v3';
        
        let apiUrl = `${baseUrl}/simple/price?ids=bitcoin&vs_currencies=eur,usd`;
        if (settings.coingeckoApiKey) {
            apiUrl += `&x_cg_demo_api_key=${settings.coingeckoApiKey}`;
            console.log('[server.js] Using CoinGecko API key as query parameter');
        }
        
        const response = await axios.get(apiUrl);
        const priceEUR = response.data.bitcoin.eur;
        const priceUSD = response.data.bitcoin.usd;
        
        currentBTCPrice = priceEUR;
        
        await priceCache.updatePrice(priceEUR, priceUSD);
        
        console.log(`[server.js] Current BTC price updated: ${priceEUR} EUR / ${priceUSD} USD (${new Date().toISOString()})`);
    } catch (error) {
        console.error('[server.js] Error fetching BTC price:', error);
        if (transactions.length > 0) {
            currentBTCPrice = transactions[transactions.length - 1].price;
            console.log('[server.js] Fallback to last transaction price:', currentBTCPrice);
        }
    }
}

// Fetch exchange rates
async function fetchExchangeRates() {
    try {
        console.log('[server.js] Fetching exchange rates');
        
        const eurResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
        const eurRates = eurResponse.data.rates;
        
        const usdResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        const usdRates = usdResponse.data.rates;
        
        const eurRatesObj = {
            USD: eurRates.USD,
            PLN: eurRates.PLN,
            GBP: eurRates.GBP,
            JPY: eurRates.JPY,
            CHF: eurRates.CHF
        };
        
        const usdRatesObj = {
            EUR: usdRates.EUR,
            PLN: usdRates.PLN,
            GBP: usdRates.GBP,
            JPY: usdRates.JPY,
            CHF: usdRates.CHF
        };
        
        await priceCache.updateExchangeRates(eurRatesObj, usdRatesObj);
        
        console.log(`[server.js] Exchange rates updated: 1 EUR = ${eurRatesObj.USD} USD, 1 EUR = ${eurRatesObj.PLN} PLN (${new Date().toISOString()})`);
    } catch (error) {
        console.error('[server.js] Error fetching exchange rates:', error);
    }
}

// Fetch historical BTC data
async function fetchHistoricalBTCData() {
    try {
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (365 * 24 * 60 * 60);
        
        const settings = loadSettings();
        const baseUrl = 'https://api.coingecko.com/api/v3';
        
        let apiKeyParam = '';
        if (settings.coingeckoApiKey) {
            apiKeyParam = `&x_cg_demo_api_key=${settings.coingeckoApiKey}`;
            console.log('[server.js] Using CoinGecko API key for historical data fetch');
        }
            
        let eurApiUrl = `${baseUrl}/coins/bitcoin/market_chart/range?vs_currency=eur&from=${startDate}&to=${endDate}${apiKeyParam}`;
        let usdApiUrl = `${baseUrl}/coins/bitcoin/market_chart/range?vs_currency=usd&from=${startDate}&to=${endDate}${apiKeyParam}`;
        
        const eurResponse = await axios.get(eurApiUrl);
        const usdResponse = await axios.get(usdApiUrl);
        
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
        
        const usdPrices = usdResponse.data.prices;
        usdPrices.forEach(([timestamp, price]) => {
            const date = new Date(timestamp).toISOString().split('T')[0];
            if (dailyData[date]) {
                dailyData[date].priceUSD = price;
            }
        });
        
        historicalBTCData = Object.values(dailyData).sort((a, b) => a.timestamp - b.timestamp);
        
        historicalBTCData = historicalBTCData.map(day => ({
            ...day,
            price: day.priceEUR,
        }));
        
        saveHistoricalBTCData();
        console.log(`[server.js] Historical BTC data updated with ${historicalBTCData.length} days of data in both EUR and USD`);
    } catch (error) {
        console.error('[server.js] Error fetching historical BTC data:', error);
    }
}

// Update data periodically
setInterval(fetchCurrentBTCPrice, 5 * 60 * 1000);
setInterval(fetchExchangeRates, 60 * 60 * 1000);
setInterval(fetchHistoricalBTCData, 24 * 60 * 60 * 1000);

// Import CSV data with Transaction model support
function importCSVData(csvFilePath) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`[server.js] Reading CSV file from path: ${csvFilePath}`);
            
            if (!fs.existsSync(csvFilePath)) {
                return reject(new Error(`CSV file not found at path: ${csvFilePath}`));
            }
            
            const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
            console.log(`[server.js] CSV file read, content length: ${fileContent.length} bytes`);
            
            if (fileContent.length === 0) {
                return reject(new Error('CSV file is empty'));
            }
            
            parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            }, async (err, records) => {
                if (err) {
                    console.error('[server.js] Error parsing CSV:', err);
                    reject(new Error(`Failed to parse CSV: ${err.message}`));
                    return;
                }
            
                if (!records || records.length === 0) {
                    console.warn('[server.js] No valid records found in CSV file');
                    reject(new Error('No valid records found in CSV file'));
                    return;
                }
                
                console.log(`[server.js] CSV parsed successfully. Found ${records.length} records`);
                
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
                            console.warn('[server.js] Skipping invalid record:', record);
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
                                console.error(`[server.js] Error converting ${origCurrency} to EUR:`, error.message);
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
                                console.error(`[server.js] Error converting ${origCurrency} to USD:`, error.message);
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
                            console.warn('[server.js] Skipping invalid transaction:', transactionData);
                        }
                    } catch (recordError) {
                        console.error('[server.js] Error processing record:', recordError, record);
                    }
                }

                newTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

                console.log(`[server.js] CSV Import Summary:
                    - Total records: ${records.length}
                    - Valid transactions: ${newTransactions.length}
                    - Skipped records: ${skippedCount}`);

                // Append new transactions instead of replacing all transactions
                const existingTransactionIds = new Set(transactions.map(tx => tx.id));
                const uniqueNewTransactions = newTransactions.filter(tx => !existingTransactionIds.has(tx.id));
                
                console.log(`[server.js] Found ${uniqueNewTransactions.length} unique new transactions to add`);
                
                // Combine existing and new transactions
                transactions = [...transactions, ...uniqueNewTransactions];
                
                // Sort all transactions by date
                transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                await saveData();
                console.log(`[server.js] Added ${uniqueNewTransactions.length} new transactions. Total transaction count: ${transactions.length}`);
            
                resolve();
            });
        } catch (error) {
            console.error('[server.js] Error importing CSV data:', error);
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

        console.log(`[server.js] Sending ${processedTransactions.length} transactions to client with updated P&L values using ${mainCurrency}/${secondaryCurrency}`);
        res.json(processedTransactions);
    } catch (error) {
        console.error('[server.js] Error fetching transactions:', error);
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
        const settings = loadSettings();
        const mainCurrency = settings.mainCurrency || 'EUR';
        const secondaryCurrency = settings.secondaryCurrency || 'USD';
        
        console.log(`[server.js] Using currencies: Main=${mainCurrency}, Secondary=${secondaryCurrency}`);

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
        
        const summary = {
            transactions: transactions,
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
            exchangeRates: cachedPrices.exchangeRates || {},
            cacheInfo: {
                priceLastUpdated: priceCache.getPriceLastUpdated(),
                ratesLastUpdated: priceCache.getRatesLastUpdated()
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
            historicalBTCData: historicalBTCData,
        };

        console.log('[server.js] Sending summary to client');
        res.json(summary);
    } catch (error) {
        console.error('[server.js] Error getting summary:', error);
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
        console.error('[server.js] Error fetching exchange rates:', error);
        return { EUR: 1, USD: 1.1, PLN: 4.5 };
    }
}

// Add new endpoint for current price
app.get('/api/current-price', isAuthenticated, async (req, res) => {
    try {
        console.log('[server.js] Processing /api/current-price request');
        
        const cachedPrices = priceCache.getCachedPrices();
        
        const forceFresh = req.query.fresh === 'true';
        if (forceFresh || !cachedPrices.priceEUR || !cachedPrices.timestamp) {
            const settings = loadSettings();
            
            const baseUrl = 'https://api.coingecko.com/api/v3';
                
            let btcApiUrl = `${baseUrl}/simple/price?ids=bitcoin&vs_currencies=eur,usd`;
            if (settings.coingeckoApiKey) {
                btcApiUrl += `&x_cg_demo_api_key=${settings.coingeckoApiKey}`;
                console.log('[server.js] Using CoinGecko API key for fresh price fetch');
            }
            
            const btcResponse = await axios.get(btcApiUrl);
            const btcData = btcResponse.data;
            
            const exchangeResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
            const exchangeData = exchangeResponse.data;

            const responseData = {
                priceEUR: btcData.bitcoin.eur,
                priceUSD: btcData.bitcoin.usd,
                timestamp: new Date(),
                eurUsd: exchangeData.rates.USD,
                eurPln: exchangeData.rates.PLN
            };

            console.log('[server.js] Current price data fetched fresh');
            
            await priceCache.updatePrice(responseData.priceEUR, responseData.priceUSD);
            
            res.json(responseData);
        } else {
            console.log('[server.js] Using cached price data');
            
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
        console.error('[server.js] Error fetching current price:', error);
        res.status(500).json({ error: 'Failed to fetch current price' });
    }
});

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
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
            console.error('[server.js] Multer error:', err);
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
            console.log(`[server.js] Processing CSV file: ${csvFilePath}`);

            // Import the CSV data
            await importCSVData(csvFilePath);

            // Delete the temporary file
            fs.unlink(csvFilePath, (err) => {
                if (err) {
                    console.error('[server.js] Error deleting temporary file:', err);
                }
            });

            res.json({ message: 'Transactions imported successfully' });
        } catch (error) {
            console.error('[server.js] Error importing CSV:', error);
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
        
        const transaction = new Transaction({
            ...newTransactionData,
            id: Date.now().toString(),
            exchange: 'manual',
            txType: 'manual',
            status: 'Completed',
            original: {
                currency: newTransactionData.currency || 'EUR',
                price: newTransactionData.price,
                cost: newTransactionData.amount * newTransactionData.price,
                fee: newTransactionData.fee || 0
            }
        });
        
        if (!transaction.isValid()) {
            return res.status(400).json({ error: 'Invalid transaction data' });
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
        console.error('[server.js] Error adding transaction:', error);
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
    console.log(`[server.js] Received PUT request for transaction ID: ${id}`);

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

        console.log(`[server.js] Transaction ID: ${id} updated successfully`);
        res.json({ message: 'Transaction updated successfully', transaction: updatedTxJSON });

    } catch (error) {
        console.error(`[server.js] Error updating transaction ID: ${id}`, error);
        res.status(500).json({ error: 'Internal server error while updating transaction' });
    }
});

// Delete a specific transaction (Admin)
app.delete('/api/admin/transactions/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    console.log(`[server.js] Received DELETE request for transaction ID: ${id}`);

    try {
        const initialLength = transactions.length;
        transactions = transactions.filter(tx => tx.id !== id);

        if (transactions.length === initialLength) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        await saveData();
        console.log(`[server.js] Transaction ID: ${id} deleted successfully`);
        res.json({ message: 'Transaction deleted successfully' });

    } catch (error) {
        console.error(`[server.js] Error deleting transaction ID: ${id}`, error);
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
        console.error('[server.js] Error updating transaction:', error);
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
        console.error('[server.js] Error generating CSV:', error);
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
        
        console.log('[server.js] All transactions deleted successfully');
        res.json({ message: 'All transactions deleted successfully' });
    } catch (error) {
        console.error('[server.js] Error deleting all transactions:', error);
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
        console.error('[server.js] Error loading settings:', error);
        return { secondaryCurrency: "PLN", mainCurrency: "EUR" };
    }
}

// Save settings
function saveSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.error('[server.js] Error saving settings:', error);
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
        
        if (!newSettings.secondaryCurrency) {
            return res.status(400).json({ error: 'Missing secondaryCurrency' });
        }
        
        if (saveSettings(newSettings)) {
            res.json({ message: 'Settings saved', settings: newSettings });
        } else {
            res.status(500).json({ error: 'Failed to save settings' });
        }
    } catch (error) {
        console.error('[server.js] Error updating settings:', error);
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
        
        try {
            const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&x_cg_demo_api_key=${apiKey}`;
            const response = await axios.get(apiUrl);
            
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
            console.error('[server.js] CoinGecko API error:', apiError.response?.data || apiError.message);
            
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
        console.error('[server.js] Server error testing API key:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error when testing API key'
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
        console.log('[server.js] Login failed:', decodeURIComponent(errorParam.substring(7)));
    }
});

// Login form submission - Update the failure redirect to include the error
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('[server.js] Login error:', err);
            return res.redirect('/login?error=' + encodeURIComponent('An error occurred during login'));
        }
        
        if (!user) {
            const errorMessage = info && info.message ? info.message : 'Invalid username or password';
            console.log('[server.js] Login failed:', errorMessage);
            return res.redirect('/login?error=' + encodeURIComponent(errorMessage));
        }
        
        req.logIn(user, (err) => {
            if (err) {
                console.error('[server.js] Session error:', err);
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
        console.log('[server.js] Setup form submission received');
        
        if (userModel.hasUsers()) {
            return res.redirect('/login');
        }
        
        const { username, password, confirmPassword } = req.body;
        
        if (!username || !password) {
            console.error('[server.js] Setup error: Username and password are required');
            return res.redirect('/setup?error=' + encodeURIComponent('Username and password are required'));
        }
        
        if (password !== confirmPassword) {
            console.error('[server.js] Setup error: Passwords do not match');
            return res.redirect('/setup?error=' + encodeURIComponent('Passwords do not match'));
        }
        
        console.log('[server.js] Creating new user:', username);
        await userModel.createUser(username, password);
        console.log('[server.js] User created successfully');
        
        res.redirect('/login');
    } catch (error) {
        console.error('[server.js] Setup error:', error);
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
        console.error('[server.js] Error changing password:', error);
        res.status(500).json({ 
            error: 'Failed to change password', 
            message: error.message 
        });
    }
});

// Use exchange routes
app.use('/api', exchangeRoutes);

// Serve index.html for all other routes that aren't static files
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
    console.error('[server.js] Server error:', err.stack);
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
    
    app.listen(PORT, () => {
        console.log(`[server.js] Server running at http://localhost:${PORT}`);
    });
}

startServer();