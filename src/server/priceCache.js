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
        this.lastDayUpdate = null;
        this.lastWeekUpdate = null;
    }

    async initialize() {
        try {
            // Create data directory if it doesn't exist
            const dataDir = path.dirname(this.cacheFilePath);
            await fs.mkdir(dataDir, { recursive: true });

            // Try to load cached data from disk
            await this.loadFromDisk();
            
            // Initial price fetch if cache is empty or old
            if (!this.cache.timestamp || 
                Date.now() - new Date(this.cache.timestamp).getTime() > this.updateInterval) {
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
            
            logger.debug('[priceCache] Initialized with data:', this.cache);
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
            
            // Check if we need to update the previous day price
            if (!this.lastDayUpdate || now.getDate() !== this.lastDayUpdate.getDate()) {
                const oldPrice = this.cache.previousDayPrice;
                this.cache.previousDayPrice = this.cache.priceEUR || btcPriceEUR;
                this.lastDayUpdate = now;
                logger.debug(`[priceCache] Updated previous day price: ${oldPrice} -> ${this.cache.previousDayPrice}`);
            } else {
                logger.debug(`[priceCache] Keeping previous day price: ${this.cache.previousDayPrice}`);
            }
            
            // Check if we need to update the previous week price
            const daysSinceLastUpdate = this.lastWeekUpdate ? 
                Math.floor((now - this.lastWeekUpdate) / (24 * 60 * 60 * 1000)) : 
                8; // Force update if never updated
                
            if (!this.lastWeekUpdate || 
                (now.getDay() === 1 && this.lastWeekUpdate.getDay() !== 1) ||
                daysSinceLastUpdate >= 7) {
                const oldWeeklyPrice = this.cache.previousWeekPrice;
                this.cache.previousWeekPrice = this.cache.priceEUR || btcPriceEUR;
                this.lastWeekUpdate = now;
                logger.debug(`[priceCache] Updated previous week price: ${oldWeeklyPrice} -> ${this.cache.previousWeekPrice} (Days since last update: ${daysSinceLastUpdate})`);
            } else {
                logger.debug(`[priceCache] Keeping previous week price: ${this.cache.previousWeekPrice} (Days since last update: ${daysSinceLastUpdate})`);
            }
            
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
                exchangeRates,
                timestamp: new Date().toISOString()
            };
            
            await this.saveToDisk();
            logger.debug(`[priceCache] BTC prices from Yahoo Finance: ${btcPriceEUR} EUR / ${btcPriceUSD} USD, updated at ${this.cache.timestamp}`);
        } catch (error) {
            logger.error('[priceCache] Error updating prices from Yahoo Finance:', error.message);
            
            if (!this.cache.priceEUR && !this.cache.priceUSD) {
                logger.debug('[priceCache] Setting default fallback values');
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
                    eurBrl: 6.34, // Updated BRL rate
                    exchangeRates: {
                        EUR: { USD: 1.1, PLN: 4.5, GBP: 0.85, JPY: 160, CHF: 0.95, BRL: 6.34 },
                        USD: { EUR: 0.9, PLN: 4.0, GBP: 0.75, JPY: 145, CHF: 0.85, BRL: 5.76 }
                    },
                    timestamp: new Date().toISOString()
                };
            }
        } finally {
            this.isUpdating = false;
        }
    }

    getCachedPrices() {
        return {
            ...this.cache,
            // For backward compatibility
            price: this.cache.priceEUR || this.cache.price || 0,
            priceUSD: this.cache.priceUSD || (this.cache.price ? this.cache.price * (this.cache.eurUsd || 1.1) : 0),
            previousDayPrice: this.cache.previousDayPrice || this.cache.priceEUR || 0,
            previousWeekPrice: this.cache.previousWeekPrice || this.cache.previousDayPrice || this.cache.priceEUR || 0,
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
            // Direct rate if available
            if (this.cache.exchangeRates?.[fromCurrency]?.[toCurrency]) {
                const rate = this.cache.exchangeRates[fromCurrency][toCurrency];
                return rate;
            }
            
            // Handle legacy format
            if (fromCurrency === 'EUR' && toCurrency === 'USD' && this.cache.eurUsd) {
                return this.cache.eurUsd;
            } else if (fromCurrency === 'EUR' && toCurrency === 'PLN' && this.cache.eurPln) {
                return this.cache.eurPln;
            } else if (fromCurrency === 'EUR' && toCurrency === 'BRL' && this.cache.eurBrl) {
                return this.cache.eurBrl;
            } else if (fromCurrency === 'USD' && toCurrency === 'EUR' && this.cache.eurUsd) {
                return 1 / this.cache.eurUsd;
            } else if (fromCurrency === 'PLN' && toCurrency === 'EUR' && this.cache.eurPln) {
                return 1 / this.cache.eurPln;
            } else if (fromCurrency === 'BRL' && toCurrency === 'EUR' && this.cache.eurBrl) {
                return 1 / this.cache.eurBrl;
            }
            
            // Conversion through EUR as base
            if (fromCurrency === 'EUR' && this.cache.exchangeRates?.EUR?.[toCurrency]) {
                return this.cache.exchangeRates.EUR[toCurrency];
            } else if (toCurrency === 'EUR' && this.cache.exchangeRates?.EUR?.[fromCurrency]) {
                return 1 / this.cache.exchangeRates.EUR[fromCurrency];
            }
            
            // Conversion through USD as base
            if (fromCurrency === 'USD' && this.cache.exchangeRates?.USD?.[toCurrency]) {
                return this.cache.exchangeRates.USD[toCurrency];
            } else if (toCurrency === 'USD' && this.cache.exchangeRates?.[fromCurrency]?.USD) {
                return 1 / this.cache.exchangeRates[fromCurrency].USD;
            }
            
            // Cross-currency conversion via EUR
            if (this.cache.exchangeRates?.EUR?.[fromCurrency] && this.cache.exchangeRates?.EUR?.[toCurrency]) {
                const fromToEUR = 1 / this.cache.exchangeRates.EUR[fromCurrency];
                const eurToTarget = this.cache.exchangeRates.EUR[toCurrency];
                return fromToEUR * eurToTarget;
            }
            
            // Cross-currency conversion via USD
            if (this.cache.exchangeRates?.USD?.[fromCurrency] && this.cache.exchangeRates?.USD?.[toCurrency]) {
                const fromToUSD = 1 / this.cache.exchangeRates.USD[fromCurrency];
                const usdToTarget = this.cache.exchangeRates.USD[toCurrency];
                return fromToUSD * usdToTarget;
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
        if (currency === 'EUR') {
            return this.cache.priceEUR || this.cache.price || 0;
        } else if (currency === 'USD') {
            return this.cache.priceUSD || (this.cache.priceEUR * this.getExchangeRate('EUR', 'USD')) || 0;
        } else {
            // Convert from EUR to target currency
            const eurPrice = this.cache.priceEUR || this.cache.price || 0;
            return eurPrice * this.getExchangeRate('EUR', currency);
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
                'EURUSD=X', 'EURPLN=X', 'EURGBP=X', 'EURJPY=X', 'EURCHF=X', 'EURBRL=X'
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
                EUR: { USD: 1.1, PLN: 4.5, GBP: 0.85, JPY: 160, CHF: 0.95, BRL: 6.34 },
                USD: { EUR: 0.9, PLN: 4.0, GBP: 0.75, JPY: 145, CHF: 0.85, BRL: 5.76 }
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
            logger.info(`[priceCache] Final EUR exchange rates - USD: ${exchangeRates.EUR.USD.toFixed(4)}, PLN: ${exchangeRates.EUR.PLN.toFixed(4)}, GBP: ${exchangeRates.EUR.GBP.toFixed(4)}, JPY: ${exchangeRates.EUR.JPY.toFixed(2)}, CHF: ${exchangeRates.EUR.CHF.toFixed(4)}, BRL: ${exchangeRates.EUR.BRL.toFixed(4)}`);
            logger.info(`[priceCache] Final USD exchange rates - EUR: ${exchangeRates.USD.EUR.toFixed(4)}, PLN: ${exchangeRates.USD.PLN.toFixed(4)}, GBP: ${exchangeRates.USD.GBP.toFixed(4)}, JPY: ${exchangeRates.USD.JPY.toFixed(2)}, CHF: ${exchangeRates.USD.CHF.toFixed(4)}, BRL: ${exchangeRates.USD.BRL.toFixed(4)}`);

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