const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const pathManager = require('./utils/path-manager');
const Logger = require('./utils/logger');

// Initialize logger
const logger = Logger.create('PRICE-CACHE');

class PriceCache {
    constructor() {
        this.cache = {
            priceEUR: null,   // BTC price in EUR
            priceUSD: null,   // BTC price in USD
            previousDayPrice: null, // Previous day's price in EUR
            previousWeekPrice: null, // Previous week's price in EUR
            exchangeRates: {}, // All exchange rates
            timestamp: null
        };
        this.updateInterval = 10 * 60 * 1000; // 10 minutes (increased from 5 to reduce Yahoo Finance requests)
        this.isUpdating = false;
        this.cacheFilePath = pathManager.getPriceCachePath();
    }

    async initialize() {
        try {
            // Create data directory if it doesn't exist
            const dataDir = path.dirname(this.cacheFilePath);
            await fs.mkdir(dataDir, { recursive: true });

            logger.debug('[priceCache] Starting initialization...');
            
            // Try to load cached data from disk
            await this.loadFromDisk();
            
            // Initial price fetch if cache is empty or old
            if (!this.cache.timestamp || 
                Date.now() - new Date(this.cache.timestamp).getTime() > this.updateInterval) {
                logger.debug('[priceCache] Cache empty or old, performing initial update');
                await this.updatePrices();
            }
            
            // Initialize previousWeekPrice if not present
            if (!this.cache.previousWeekPrice && this.cache.priceEUR) {
                this.cache.previousWeekPrice = this.cache.priceEUR;
                this.lastWeekUpdate = new Date();
                logger.debug(`[priceCache] Initialized previousWeekPrice to ${this.cache.previousWeekPrice}`);
                await this.saveToDisk();
            }
            
            // Set up periodic updates
            setInterval(() => this.updatePrices(), this.updateInterval);
            
            logger.debug('[priceCache] Initialization complete. Cache state:', {
                priceEUR: this.cache.priceEUR,
                priceUSD: this.cache.priceUSD,
                exchangeRates: this.cache.exchangeRates,
                timestamp: this.cache.timestamp
            });
        } catch (error) {
            logger.error('[priceCache] Initialization error:', error);
            // If initialization fails, still try to set up updates
            setInterval(() => this.updatePrices(), this.updateInterval);
        }
    }

    async loadFromDisk() {
        try {
            const data = await fs.readFile(this.cacheFilePath, 'utf8');
            const cachedData = JSON.parse(data);
            
            if (cachedData.price && !cachedData.priceEUR) {
                cachedData.priceEUR = cachedData.price;
                if (cachedData.eurUsd) {
                    cachedData.priceUSD = cachedData.priceEUR * cachedData.eurUsd;
                }
            }
            
            if (cachedData && 
                (cachedData.priceEUR || cachedData.priceUSD) && 
                cachedData.timestamp) {
                this.cache = {
                    ...cachedData,
                    exchangeRates: cachedData.exchangeRates || {}
                };
                logger.debug('[priceCache] Loaded from disk');
                return true;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('[priceCache] Error loading from disk:', error);
            }
        }
        return false;
    }

    async saveToDisk() {
        try {
            await fs.writeFile(
                this.cacheFilePath,
                JSON.stringify(this.cache, null, 2),
                'utf8'
            );
            logger.debug('[priceCache] Saved to disk');
        } catch (error) {
            logger.error('[priceCache] Error saving to disk:', error);
        }
    }

    async updatePrices() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        try {
            logger.debug('[priceCache] Updating BTC prices and exchange rates using Yahoo Finance');
            
            // Use Yahoo Finance for BTC prices
            const { btcPriceEUR, btcPriceUSD } = await this.fetchBTCPricesFromYahoo();
            
            // Use Yahoo Finance for exchange rates
            const exchangeRates = await this.fetchExchangeRatesFromYahoo();
            
            const now = new Date();
            
            // Get historical prices from historical_btc.json for accurate daily/weekly changes
            let previousDayPrice = this.cache.previousDayPrice || 0;
            let previousWeekPrice = this.cache.previousWeekPrice || 0;
            
            try {
                const historicalFilePath = path.join(pathManager.getDataDirectory(), 'historical_btc.json');
                const historicalData = JSON.parse(await fs.readFile(historicalFilePath, 'utf8'));
                
                // Get yesterday's date
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                // Get date from 7 days ago
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekAgoStr = weekAgo.toISOString().split('T')[0];
                
                // Find yesterday's price
                const yesterdayData = historicalData.find(entry => entry.date === yesterdayStr);
                if (yesterdayData && yesterdayData.priceEUR) {
                    previousDayPrice = yesterdayData.priceEUR;
                    logger.debug(`[priceCache] Found previous day price from historical data: ${previousDayPrice} EUR (${yesterdayStr})`);
                } else {
                    // Fallback: find closest date to yesterday
                    let closestDayData = null;
                    let smallestDiff = Infinity;
                    const targetTime = yesterday.getTime();
                    
                    for (const entry of historicalData) {
                        if (!entry.date || !entry.priceEUR) continue;
                        const entryTime = new Date(entry.date).getTime();
                        const diff = Math.abs(entryTime - targetTime);
                        if (diff < smallestDiff && diff < 3 * 24 * 60 * 60 * 1000) { // Within 3 days
                            smallestDiff = diff;
                            closestDayData = entry;
                        }
                    }
                    
                    if (closestDayData) {
                        previousDayPrice = closestDayData.priceEUR;
                        logger.debug(`[priceCache] Using closest historical price for daily change: ${previousDayPrice} EUR (${closestDayData.date})`);
                    } else {
                        logger.debug(`[priceCache] No suitable historical data for daily change, keeping cached: ${previousDayPrice} EUR`);
                    }
                }
                
                // Find week ago price
                const weekAgoData = historicalData.find(entry => entry.date === weekAgoStr);
                if (weekAgoData && weekAgoData.priceEUR) {
                    previousWeekPrice = weekAgoData.priceEUR;
                    logger.debug(`[priceCache] Found previous week price from historical data: ${previousWeekPrice} EUR (${weekAgoStr})`);
                } else {
                    // Fallback: find closest date to week ago
                    let closestWeekData = null;
                    let smallestDiff = Infinity;
                    const targetTime = weekAgo.getTime();
                    
                    for (const entry of historicalData) {
                        if (!entry.date || !entry.priceEUR) continue;
                        const entryTime = new Date(entry.date).getTime();
                        const diff = Math.abs(entryTime - targetTime);
                        if (diff < smallestDiff && diff < 10 * 24 * 60 * 60 * 1000) { // Within 10 days
                            smallestDiff = diff;
                            closestWeekData = entry;
                        }
                    }
                    
                    if (closestWeekData) {
                        previousWeekPrice = closestWeekData.priceEUR;
                        logger.debug(`[priceCache] Using closest historical price for weekly change: ${previousWeekPrice} EUR (${closestWeekData.date})`);
                    } else {
                        logger.debug(`[priceCache] No suitable historical data for weekly change, keeping cached: ${previousWeekPrice} EUR`);
                    }
                }
                
            } catch (error) {
                logger.error('[priceCache] Error reading historical data for daily/weekly prices:', error);
                logger.debug(`[priceCache] Using cached previous prices: day=${previousDayPrice}, week=${previousWeekPrice}`);
            }
            
            // Update cache with historical-based prices
            this.cache.previousDayPrice = previousDayPrice;
            this.cache.previousWeekPrice = previousWeekPrice;
            
            this.cache = {
                ...this.cache,
                priceEUR: btcPriceEUR,
                priceUSD: btcPriceUSD,
                price: btcPriceEUR,
                eurUsd: exchangeRates.EUR.USD,
                eurPln: exchangeRates.EUR.PLN,
                eurGbp: exchangeRates.EUR.GBP,
                eurJpy: exchangeRates.EUR.JPY,
                eurChf: exchangeRates.EUR.CHF,
                eurBrl: exchangeRates.EUR.BRL,
                eurInr: exchangeRates.EUR.INR,
                exchangeRates,
                timestamp: new Date().toISOString()
            };
            
            await this.saveToDisk();

            // Update the latest entry in historical_btc.json
            try {
                const historicalFilePath = path.join(pathManager.getDataDirectory(), 'historical_btc.json');
                const historicalData = JSON.parse(await fs.readFile(historicalFilePath, 'utf8'));
                
                // Get today's date in YYYY-MM-DD format
                const today = new Date().toISOString().split('T')[0];
                
                // Create new entry for today
                const newEntry = {
                    date: today,
                    priceEUR: btcPriceEUR,
                    timestamp: Date.now(),
                    priceUSD: btcPriceUSD,
                    price: btcPriceEUR
                };

                // Find if today's entry already exists
                const todayIndex = historicalData.findIndex(entry => entry.date === today);
                
                if (todayIndex !== -1) {
                    // Update existing entry
                    historicalData[todayIndex] = newEntry;
                } else {
                    // Add new entry
                    historicalData.push(newEntry);
                }

                // Sort data by date to ensure chronological order
                historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // Save updated historical data
                await fs.writeFile(historicalFilePath, JSON.stringify(historicalData, null, 2), 'utf8');
                logger.debug(`[priceCache] Updated historical_btc.json with latest price for ${today}`);
            } catch (error) {
                logger.error('[priceCache] Error updating historical_btc.json:', error);
            }

            logger.debug(`[priceCache] BTC prices from Yahoo Finance: ${btcPriceEUR} EUR / ${btcPriceUSD} USD, updated at ${this.cache.timestamp}`);
        } catch (error) {
            logger.error('[priceCache] Error updating prices from Yahoo Finance:', error.message);
            
            // Only set fallback values if we have no cached data at all
            if (!this.cache.priceEUR && !this.cache.priceUSD && !this.cache.exchangeRates?.EUR) {
                logger.warn('[priceCache] No cached data available, setting initial fallback values');
                this.cache = {
                    ...this.cache,
                    priceEUR: 0,
                    priceUSD: 0,
                    price: 0,
                    eurUsd: 1.1,
                    eurPln: 4.5,
                    eurGbp: 0.85,
                    eurJpy: 160,
                    eurChf: 0.95,
                    eurBrl: 6.34,
                    eurInr: 89.23,
                    exchangeRates: {
                        EUR: { 
                            USD: 1.1, 
                            PLN: 4.5, 
                            GBP: 0.85, 
                            JPY: 160, 
                            CHF: 0.95, 
                            BRL: 6.34, 
                            INR: 89.23 
                        },
                        USD: { 
                            EUR: 1 / 1.1,
                            PLN: 4.5 / 1.1,
                            GBP: 0.85 / 1.1,
                            JPY: 160 / 1.1,
                            CHF: 0.95 / 1.1,
                            BRL: 6.34 / 1.1,
                            INR: 89.23 / 1.1
                        }
                    },
                    timestamp: new Date().toISOString()
                };
                await this.saveToDisk();
            } else {
                // We have cached data, just log that we're using it
                const cacheAgeMinutes = this.cache.timestamp ? 
                    Math.round((Date.now() - new Date(this.cache.timestamp).getTime()) / (1000 * 60)) : 
                    'unknown';
                logger.info(`[priceCache] Using cached data (age: ${cacheAgeMinutes} minutes) due to API failure`);
                
                // Ensure we have fallback exchange rates even in cached data
                if (!this.cache.exchangeRates?.EUR) {
                    logger.debug('[priceCache] Adding fallback exchange rates to cached data');
                    this.cache.exchangeRates = {
                        EUR: { 
                            USD: this.cache.eurUsd || 1.1, 
                            PLN: this.cache.eurPln || 4.5, 
                            GBP: this.cache.eurGbp || 0.85, 
                            JPY: this.cache.eurJpy || 160, 
                            CHF: this.cache.eurChf || 0.95, 
                            BRL: this.cache.eurBrl || 6.34,
                            INR: this.cache.eurInr || 89.23
                        },
                        USD: { 
                            EUR: 1 / (this.cache.eurUsd || 1.1),
                            PLN: (this.cache.eurPln || 4.5) / (this.cache.eurUsd || 1.1),
                            GBP: (this.cache.eurGbp || 0.85) / (this.cache.eurUsd || 1.1),
                            JPY: (this.cache.eurJpy || 160) / (this.cache.eurUsd || 1.1),
                            CHF: (this.cache.eurChf || 0.95) / (this.cache.eurUsd || 1.1),
                            BRL: (this.cache.eurBrl || 6.34) / (this.cache.eurUsd || 1.1),
                            INR: (this.cache.eurInr || 89.23) / (this.cache.eurUsd || 1.1)
                        }
                    };
                }
            }
        } finally {
            this.isUpdating = false;
        }
    }

    getCachedPrices() {
        // Ensure legacy exchange rate fields are populated from structured data
        const legacyRates = {
            eurUsd: this.cache.eurUsd || this.cache.exchangeRates?.EUR?.USD || 1.1,
            eurPln: this.cache.eurPln || this.cache.exchangeRates?.EUR?.PLN || 4.5,
            eurGbp: this.cache.eurGbp || this.cache.exchangeRates?.EUR?.GBP || 0.85,
            eurJpy: this.cache.eurJpy || this.cache.exchangeRates?.EUR?.JPY || 160,
            eurChf: this.cache.eurChf || this.cache.exchangeRates?.EUR?.CHF || 0.95,
            eurBrl: this.cache.eurBrl || this.cache.exchangeRates?.EUR?.BRL || 6.34,
            eurInr: this.cache.eurInr || this.cache.exchangeRates?.EUR?.INR || 89.23
        };

        return {
            ...this.cache,
            // For backward compatibility
            price: this.cache.priceEUR || this.cache.price || 0,
            priceUSD: this.cache.priceUSD || (this.cache.price ? this.cache.price * legacyRates.eurUsd : 0),
            previousDayPrice: this.cache.previousDayPrice || this.cache.priceEUR || 0,
            previousWeekPrice: this.cache.previousWeekPrice || this.cache.previousDayPrice || this.cache.priceEUR || 0,
            // Ensure legacy exchange rate fields are available
            ...legacyRates,
            isCached: true,
            age: this.cache.timestamp ? 
                Math.round((Date.now() - new Date(this.cache.timestamp).getTime()) / 1000) : 
                null
        };
    }

    async updatePrice(priceEUR, priceUSD = null) {
        // Calculate USD price from EUR if not provided
        if (!priceUSD && priceEUR && this.cache.eurUsd) {
            priceUSD = priceEUR * this.cache.eurUsd;
        }
        
        // Update prices in the cache
        this.cache.priceEUR = priceEUR;
        this.cache.price = priceEUR; // Legacy support
        if (priceUSD) {
            this.cache.priceUSD = priceUSD;
        }
        this.cache.timestamp = new Date().toISOString();
        
        await this.saveToDisk();
        logger.debug(`[priceCache] Prices updated to ${priceEUR} EUR / ${priceUSD || 'N/A'} USD at ${this.cache.timestamp}`);
    }

    async updateExchangeRates(eurRates, usdRates = null) {
        // Update EUR rates
        if (typeof eurRates === 'object') {
            this.cache.exchangeRates = this.cache.exchangeRates || {};
            this.cache.exchangeRates.EUR = eurRates;
            
            // Update legacy fields
            if (eurRates.USD) this.cache.eurUsd = eurRates.USD;
            if (eurRates.PLN) this.cache.eurPln = eurRates.PLN;
            if (eurRates.GBP) this.cache.eurGbp = eurRates.GBP;
            if (eurRates.JPY) this.cache.eurJpy = eurRates.JPY;
            if (eurRates.CHF) this.cache.eurChf = eurRates.CHF;
            if (eurRates.BRL) this.cache.eurBrl = eurRates.BRL;
            if (eurRates.INR) this.cache.eurInr = eurRates.INR;
        }
        
        // Update USD rates if provided
        if (usdRates && typeof usdRates === 'object') {
            this.cache.exchangeRates = this.cache.exchangeRates || {};
            this.cache.exchangeRates.USD = usdRates;
        }
        
        this.cache.timestamp = new Date().toISOString();
        await this.saveToDisk();
        logger.debug(`[priceCache] Exchange rates updated at ${this.cache.timestamp}`);
    }
    
    // Get rate between any two currencies
    getExchangeRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return 1;
        
        try {
            logger.debug(`[priceCache] Getting exchange rate from ${fromCurrency} to ${toCurrency}`);
            
            // Direct rate if available
            if (this.cache.exchangeRates?.[fromCurrency]?.[toCurrency]) {
                const rate = this.cache.exchangeRates[fromCurrency][toCurrency];
                logger.debug(`[priceCache] Found direct rate: ${rate}`);
                return rate;
            }
            
            // Handle legacy format
            if (fromCurrency === 'EUR' && toCurrency === 'USD' && this.cache.eurUsd) {
                logger.debug(`[priceCache] Using legacy EUR/USD rate: ${this.cache.eurUsd}`);
                return this.cache.eurUsd;
            }
            
            // Conversion through EUR as base
            if (fromCurrency === 'EUR' && this.cache.exchangeRates?.EUR?.[toCurrency]) {
                const rate = this.cache.exchangeRates.EUR[toCurrency];
                logger.debug(`[priceCache] Using EUR base rate: ${rate}`);
                return rate;
            } else if (toCurrency === 'EUR' && this.cache.exchangeRates?.EUR?.[fromCurrency]) {
                const rate = 1 / this.cache.exchangeRates.EUR[fromCurrency];
                logger.debug(`[priceCache] Using inverse EUR base rate: ${rate}`);
                return rate;
            }
            
            // Cross-currency conversion via EUR
            if (this.cache.exchangeRates?.EUR?.[fromCurrency] && this.cache.exchangeRates?.EUR?.[toCurrency]) {
                const fromToEUR = 1 / this.cache.exchangeRates.EUR[fromCurrency];
                const eurToTarget = this.cache.exchangeRates.EUR[toCurrency];
                const rate = fromToEUR * eurToTarget;
                logger.debug(`[priceCache] Using cross rate via EUR: ${rate} (${fromToEUR} * ${eurToTarget})`);
                return rate;
            }
            
            // Fallback
            logger.warn(`[priceCache] No exchange rate found for ${fromCurrency} to ${toCurrency}, using 1`);
            return 1;
        } catch (error) {
            logger.error(`[priceCache] Error getting exchange rate from ${fromCurrency} to ${toCurrency}:`, error);
            return 1;
        }
    }
    
    // Get BTC price in any currency
    getBTCPrice(currency = 'EUR') {
        try {
            logger.debug(`[priceCache] Getting BTC price in ${currency}`);
            
            if (currency === 'EUR') {
                const price = this.cache.priceEUR || this.cache.price || 0;
                logger.debug(`[priceCache] Using direct EUR price: ${price}`);
                return price;
            } else if (currency === 'USD') {
                const price = this.cache.priceUSD || (this.cache.priceEUR * this.getExchangeRate('EUR', 'USD')) || 0;
                logger.debug(`[priceCache] Using USD price: ${price}`);
                return price;
            } else {
                // Convert from EUR to target currency
                const eurPrice = this.cache.priceEUR || this.cache.price || 0;
                const rate = this.getExchangeRate('EUR', currency);
                
                logger.debug(`[priceCache] Converting EUR price to ${currency}:`, {
                    eurPrice,
                    rate,
                    result: eurPrice * rate
                });
                
                // Validate the rate to prevent unreasonable conversions
                if (!rate || rate <= 0 || !isFinite(rate)) {
                    logger.error(`[priceCache] Invalid exchange rate for ${currency}: ${rate}`);
                    return 0;
                }
                
                const convertedPrice = eurPrice * rate;
                
                // Validate the result
                if (!isFinite(convertedPrice) || convertedPrice < 0) {
                    logger.error(`[priceCache] Invalid converted price for ${currency}: ${convertedPrice}`);
                    return 0;
                }
                
                return convertedPrice;
            }
        } catch (error) {
            logger.error(`[priceCache] Error getting BTC price in ${currency}:`, error);
            return 0;
        }
    }
    
    // Get the timestamp of when prices were last updated
    getPriceLastUpdated() {
        if (!this.cache.timestamp) {
            return null;
        }
        
        // Return formatted timestamp and time since last update
        const timestamp = new Date(this.cache.timestamp);
        const now = new Date();
        const secondsAgo = Math.floor((now - timestamp) / 1000);
        
        return {
            timestamp: timestamp.toISOString(),
            formatted: timestamp.toLocaleString(),
            secondsAgo: secondsAgo,
            minutesAgo: Math.floor(secondsAgo / 60)
        };
    }
    
    // Get the timestamp of when exchange rates were last updated
    getRatesLastUpdated() {
        if (!this.cache.timestamp) {
            return null;
        }
        
        // For now, rates and prices are updated at the same time
        return this.getPriceLastUpdated();
    }

    // Check if price has changed since last check
    hasPriceChanged() {
        const lastUpdate = this.getPriceLastUpdated();
        if (!lastUpdate) return true;

        // Consider price changed if:
        // 1. Last update was more than 5 minutes ago
        // 2. Previous day or week price was updated
        const fiveMinutesAgo = 5 * 60; // in seconds
        return lastUpdate.secondsAgo > fiveMinutesAgo;
    }

    // Clear the cache and force immediate refresh
    async clearCache() {
        logger.debug('[priceCache] Clearing cache and forcing immediate refresh');
        
        // Reset cache to initial state but keep structure
        this.cache = {
            priceEUR: null,
            priceUSD: null,
            previousDayPrice: this.cache.previousDayPrice, // Keep historical data
            previousWeekPrice: this.cache.previousWeekPrice, // Keep historical data
            exchangeRates: {},
            timestamp: null
        };
        
        // Remove the cache file
        try {
            await fs.unlink(this.cacheFilePath);
            logger.debug('[priceCache] Cache file removed');
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('[priceCache] Error removing cache file:', error);
            }
        }
        
        // Force immediate update
        await this.updatePrices();
        
        logger.debug('[priceCache] Cache cleared and refreshed');
    }

    // Fetch BTC prices from Yahoo Finance
    async fetchBTCPricesFromYahoo() {
        try {
            const endDate = Math.floor(Date.now() / 1000);
            const startDate = endDate - (24 * 60 * 60); // 1 day ago

            // Fetch both EUR and USD prices
            const [btcEurData, btcUsdData] = await Promise.all([
                this.fetchYahooFinanceData('BTC-EUR', startDate, endDate),
                this.fetchYahooFinanceData('BTC-USD', startDate, endDate)
            ]);

            // Get the latest prices
            const eurDates = Object.keys(btcEurData).sort();
            const usdDates = Object.keys(btcUsdData).sort();

            if (eurDates.length === 0 || usdDates.length === 0) {
                throw new Error('No BTC price data available from Yahoo Finance');
            }

            const latestEurDate = eurDates[eurDates.length - 1];
            const latestUsdDate = usdDates[usdDates.length - 1];

            const btcPriceEUR = btcEurData[latestEurDate].close;
            const btcPriceUSD = btcUsdData[latestUsdDate].close;

            logger.debug(`[priceCache] Fetched BTC prices from Yahoo Finance: ${btcPriceEUR} EUR / ${btcPriceUSD} USD`);

            return { btcPriceEUR, btcPriceUSD };
        } catch (error) {
            logger.error('[priceCache] Error fetching BTC prices from Yahoo Finance:', error.message);
            throw error;
        }
    }

    // Fetch exchange rates from Yahoo Finance
    async fetchExchangeRatesFromYahoo() {
        try {
            const endDate = Math.floor(Date.now() / 1000);
            const startDate = endDate - (24 * 60 * 60); // 1 day ago

            // Fetch only essential currency pairs to reduce API calls
            const essentialPairs = [
                'EURUSD=X', 'EURPLN=X', 'EURGBP=X', 'EURJPY=X', 'EURCHF=X', 'EURBRL=X', 'EURINR=X'
            ];

            if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                logger.debug(`[priceCache] 🚀 Starting exchange rate fetch process`);
                logger.debug(`[priceCache] 📋 Currency pairs to fetch: ${essentialPairs.join(', ')}`);
                logger.debug(`[priceCache] 📅 Time range: ${new Date(startDate * 1000).toISOString()} to ${new Date(endDate * 1000).toISOString()}`);
                logger.debug(`[priceCache] ⏱️  Sequential fetching with 200ms delays to prevent rate limiting`);
            }

            logger.debug(`[priceCache] Fetching ${essentialPairs.length} essential currency pairs to minimize Yahoo Finance requests`);

            // Process results and build exchange rates object with fallback values
            const exchangeRates = {
                EUR: { USD: 1.1, PLN: 4.5, GBP: 0.85, JPY: 160, CHF: 0.95, BRL: 6.34, INR: 89.23 },
                USD: { EUR: 0.9, PLN: 4.0, GBP: 0.75, JPY: 145, CHF: 0.85, BRL: 5.76, INR: 78.23 }
            };

            if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                logger.debug(`[priceCache] 🛡️  Default fallback rates initialized:`);
                logger.debug(`[priceCache] 💶 EUR rates: ${JSON.stringify(exchangeRates.EUR)}`);
                logger.debug(`[priceCache] 💵 USD rates: ${JSON.stringify(exchangeRates.USD)}`);
            }

            // Track successful and failed fetches
            const fetchResults = {
                successful: [],
                failed: [],
                usingFallback: []
            };

            // Fetch rates sequentially with delays to avoid rate limiting
            for (let i = 0; i < essentialPairs.length; i++) {
                const pair = essentialPairs[i];
                
                if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                    logger.debug(`[priceCache] 🔄 [${i + 1}/${essentialPairs.length}] Fetching ${pair}...`);
                }
                
                try {
                    // Add delay between requests to avoid rate limiting
                    if (i > 0) {
                        if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                            logger.debug(`[priceCache] ⏳ Waiting 200ms before next request...`);
                        }
                        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
                    }
                    
                    const data = await this.fetchYahooFinanceData(pair, startDate, endDate);
                    
                    if (data && Object.keys(data).length > 0) {
                        const dates = Object.keys(data).sort();
                        const latestDate = dates[dates.length - 1];
                        const rate = data[latestDate].close;

                        fetchResults.successful.push({ pair, rate, date: latestDate });

                        if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                            logger.debug(`[priceCache] ${pair} successful: ${rate} (${latestDate})`);
                        }

                        // Map the rates to our structure
                        if (pair === 'EURUSD=X') {
                            exchangeRates.EUR.USD = rate;
                            exchangeRates.USD.EUR = 1 / rate; // Calculate inverse
                            logger.debug(`[priceCache] Updated EUR/USD rate: ${rate} (inverse: ${exchangeRates.USD.EUR.toFixed(4)})`);
                        } else if (pair === 'EURPLN=X') {
                            exchangeRates.EUR.PLN = rate;
                            exchangeRates.USD.PLN = rate / exchangeRates.EUR.USD; // Calculate USD/PLN
                            logger.debug(`[priceCache] Updated EUR/PLN rate: ${rate}, calculated USD/PLN: ${exchangeRates.USD.PLN.toFixed(4)}`);
                        } else if (pair === 'EURGBP=X') {
                            exchangeRates.EUR.GBP = rate;
                            exchangeRates.USD.GBP = rate / exchangeRates.EUR.USD; // Calculate USD/GBP
                            logger.debug(`[priceCache] Updated EUR/GBP rate: ${rate}, calculated USD/GBP: ${exchangeRates.USD.GBP.toFixed(4)}`);
                        } else if (pair === 'EURJPY=X') {
                            exchangeRates.EUR.JPY = rate;
                            exchangeRates.USD.JPY = rate / exchangeRates.EUR.USD; // Calculate USD/JPY
                            logger.debug(`[priceCache] Updated EUR/JPY rate: ${rate}, calculated USD/JPY: ${exchangeRates.USD.JPY.toFixed(2)}`);
                        } else if (pair === 'EURCHF=X') {
                            exchangeRates.EUR.CHF = rate;
                            exchangeRates.USD.CHF = rate / exchangeRates.EUR.USD; // Calculate USD/CHF
                            logger.debug(`[priceCache] Updated EUR/CHF rate: ${rate}, calculated USD/CHF: ${exchangeRates.USD.CHF.toFixed(4)}`);
                        } else if (pair === 'EURBRL=X') {
                            exchangeRates.EUR.BRL = rate;
                            exchangeRates.USD.BRL = rate / exchangeRates.EUR.USD; // Calculate USD/BRL
                            logger.debug(`[priceCache] Updated EUR/BRL rate: ${rate}, calculated USD/BRL: ${exchangeRates.USD.BRL.toFixed(4)}`);
                        } else if (pair === 'EURINR=X') {
                            exchangeRates.EUR.INR = rate;
                            exchangeRates.USD.INR = rate / exchangeRates.EUR.USD; // Calculate USD/INR
                            logger.debug(`[priceCache] Updated EUR/INR rate: ${rate}, calculated USD/INR: ${exchangeRates.USD.INR.toFixed(2)}`);
                        }
                    } else {
                        // Empty data received
                        fetchResults.failed.push({ pair, error: 'Empty data received' });
                        fetchResults.usingFallback.push(pair);
                        logger.warn(`[priceCache] Using fallback rate for ${pair} - received empty data`);
                        
                        if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                            logger.debug(`[priceCache] ${pair} failed: Empty data received`);
                        }
                    }
                } catch (error) {
                    fetchResults.failed.push({ pair, error: error.message });
                    fetchResults.usingFallback.push(pair);
                    logger.warn(`[priceCache] Failed to fetch ${pair}: ${error.message}, using fallback rate`);
                    
                    if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                        logger.debug(`[priceCache] ${pair} failed: ${error.message}`);
                    }
                }
            }

            // Log comprehensive results
            logger.info(`[priceCache] Exchange rate fetch summary - Success: ${fetchResults.successful.length}/${essentialPairs.length}, Failed: ${fetchResults.failed.length}`);
            
            if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                logger.debug(`[priceCache] Detailed fetch results:`);
                logger.debug(`[priceCache] Successful (${fetchResults.successful.length}): ${fetchResults.successful.map(r => r.pair).join(', ')}`);
                logger.debug(`[priceCache] Failed (${fetchResults.failed.length}): ${fetchResults.failed.map(r => r.pair).join(', ')}`);
                logger.debug(`[priceCache] Using fallback (${fetchResults.usingFallback.length}): ${fetchResults.usingFallback.join(', ')}`);
            }
            
            if (fetchResults.successful.length > 0) {
                const successfulPairs = fetchResults.successful.map(r => `${r.pair}=${r.rate.toFixed(4)}`).join(', ');
                logger.debug(`[priceCache] Successfully fetched rates: ${successfulPairs}`);
            }
            
            if (fetchResults.failed.length > 0) {
                const failedPairs = fetchResults.failed.map(r => r.pair).join(', ');
                logger.warn(`[priceCache] Failed to fetch rates for: ${failedPairs}`);
                
                if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                    fetchResults.failed.forEach(failure => {
                        logger.debug(`[priceCache] ${failure.pair} failure details: ${failure.error}`);
                    });
                }
            }

            if (fetchResults.usingFallback.length > 0) {
                const fallbackPairs = fetchResults.usingFallback.join(', ');
                logger.warn(`[priceCache] Using fallback rates for: ${fallbackPairs}`);
            }

            // Final rate summary for ALL pairs
            logger.info(`[priceCache] Final EUR exchange rates - USD: ${exchangeRates.EUR.USD.toFixed(4)}, PLN: ${exchangeRates.EUR.PLN.toFixed(4)}, GBP: ${exchangeRates.EUR.GBP.toFixed(4)}, JPY: ${exchangeRates.EUR.JPY.toFixed(2)}, CHF: ${exchangeRates.EUR.CHF.toFixed(4)}, BRL: ${exchangeRates.EUR.BRL.toFixed(4)}, INR: ${exchangeRates.EUR.INR.toFixed(2)}`);
            logger.info(`[priceCache] Final USD exchange rates - EUR: ${exchangeRates.USD.EUR.toFixed(4)}, PLN: ${exchangeRates.USD.PLN.toFixed(4)}, GBP: ${exchangeRates.USD.GBP.toFixed(4)}, JPY: ${exchangeRates.USD.JPY.toFixed(2)}, CHF: ${exchangeRates.USD.CHF.toFixed(4)}, BRL: ${exchangeRates.USD.BRL.toFixed(4)}, INR: ${exchangeRates.USD.INR.toFixed(2)}`);

            if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                logger.debug(`[priceCache] Exchange rate fetch process completed successfully`);
                logger.debug(`[priceCache] Final rate structure:`, JSON.stringify(exchangeRates, null, 2));
            }

            return exchangeRates;
        } catch (error) {
            logger.error('[priceCache] Error fetching exchange rates from Yahoo Finance:', error.message);
            
            if (process.env.DEBUG_EXCHANGE_RATES === 'true') {
                logger.error(`[priceCache] Fatal error in fetchExchangeRatesFromYahoo:`);
                logger.error(`[priceCache] Error details:`, error);
            }
            
            throw error;
        }
    }

    // Yahoo Finance data fetching method (copied from server.js)
    async fetchYahooFinanceData(symbol, startDate, endDate) {
        try {
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
            
            // Debug logging for Yahoo Finance API calls
            if (process.env.DEBUG_YAHOO_API === 'true') {
                logger.debug(`[priceCache] Yahoo Finance API Request:`);
                logger.debug(`[priceCache] 📡URL: ${url}`);
                logger.debug(`[priceCache] 📋 Symbol: ${symbol}`);
                logger.debug(`[priceCache] 📅 Period: ${new Date(startDate * 1000).toISOString()} to ${new Date(endDate * 1000).toISOString()}`);
                logger.debug(`[priceCache] 🔧 Params:`, JSON.stringify(params, null, 2));
            }
            
            const response = await axios.get(url, { 
                params,
                headers,
                timeout: 10000
            });
            
            // Debug response logging
            if (process.env.DEBUG_YAHOO_API === 'true') {
                logger.debug(`[priceCache] Yahoo Finance Response for ${symbol}:`);
                logger.debug(`[priceCache] Status: ${response.status} ${response.statusText}`);
                logger.debug(`[priceCache] Response size: ${JSON.stringify(response.data).length} characters`);
                
                if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result[0]) {
                    const result = response.data.chart.result[0];
                    logger.debug(`[priceCache] Data points available: ${result.timestamp ? result.timestamp.length : 0}`);
                    logger.debug(`[priceCache] Meta info:`, JSON.stringify(result.meta, null, 2));
                } else {
                    logger.debug(`[priceCache] Invalid data structure in response`);
                }
            }
            
            if (!response.data || response.data.error) {
                throw new Error(`Yahoo Finance API error: ${response.data?.error?.description || 'Unknown error'}`);
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
            
            if (Object.keys(data).length === 0) {
                throw new Error('No valid data points found in Yahoo Finance response');
            }
            
            // Debug processed data
            if (process.env.DEBUG_YAHOO_API === 'true') {
                const dates = Object.keys(data).sort();
                const latestDate = dates[dates.length - 1];
                const latestRate = data[latestDate];
                
                logger.debug(`[priceCache] Processed ${symbol} data:`);
                logger.debug(`[priceCache] Valid data points: ${Object.keys(data).length}`);
                logger.debug(`[priceCache] Date range: ${dates[0]} to ${latestDate}`);
                logger.debug(`[priceCache] Latest rate: ${latestRate.close} (${latestDate})`);
                logger.debug(`[priceCache] All rates:`, Object.entries(data).map(([date, info]) => `${date}: ${info.close}`).join(', '));
            }
            
            return data;
            
        } catch (error) {
            if (process.env.DEBUG_YAHOO_API === 'true') {
                logger.error(`[priceCache] Yahoo Finance API Error for ${symbol}:`);
                logger.error(`[priceCache] Error type: ${error.name}`);
                logger.error(`[priceCache] Error message: ${error.message}`);
                logger.error(`[priceCache] Error stack:`, error.stack);
            }
            
            logger.error(`[priceCache] Error fetching data for symbol ${symbol}:`, error.message);
            throw error;
        }
    }
}

// Create a singleton instance
const priceCache = new PriceCache();

module.exports = priceCache;