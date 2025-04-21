const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

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
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.isUpdating = false;
        this.cacheFilePath = path.join(__dirname, '..', 'data', 'price-cache.json');
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
                console.log(`[priceCache] Initialized previousWeekPrice to ${this.cache.previousWeekPrice}`);
                await this.saveToDisk();
            }
            
            // Set up periodic updates
            setInterval(() => this.updatePrices(), this.updateInterval);
            
            console.log('[priceCache] Initialized with data:', this.cache);
        } catch (error) {
            console.error('[priceCache] Initialization error:', error);
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
                console.log('[priceCache] Loaded from disk');
                return true;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('[priceCache] Error loading from disk:', error);
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
            console.log('[priceCache] Saved to disk');
        } catch (error) {
            console.error('[priceCache] Error saving to disk:', error);
        }
    }

    async updatePrices() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        try {
            console.log('[priceCache] Updating BTC prices and exchange rates');
            
            const btcResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur,usd');
            const btcPriceEUR = btcResponse.data.bitcoin.eur;
            const btcPriceUSD = btcResponse.data.bitcoin.usd;
            
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            // Check if we need to update the previous day price
            if (!this.lastDayUpdate || now.getDate() !== this.lastDayUpdate.getDate()) {
                const oldPrice = this.cache.previousDayPrice;
                this.cache.previousDayPrice = this.cache.priceEUR || btcPriceEUR;
                this.lastDayUpdate = now;
                console.log(`[priceCache] Updated previous day price: ${oldPrice} -> ${this.cache.previousDayPrice}`);
            } else {
                console.log(`[priceCache] Keeping previous day price: ${this.cache.previousDayPrice}`);
            }
            
            // Check if we need to update the previous week price
            // Update on Mondays (day 1) or if we haven't updated in over 7 days
            const daysSinceLastUpdate = this.lastWeekUpdate ? 
                Math.floor((now - this.lastWeekUpdate) / (24 * 60 * 60 * 1000)) : 
                8; // Force update if never updated
                
            if (!this.lastWeekUpdate || 
                (now.getDay() === 1 && this.lastWeekUpdate.getDay() !== 1) ||
                daysSinceLastUpdate >= 7) {
                const oldWeeklyPrice = this.cache.previousWeekPrice;
                this.cache.previousWeekPrice = this.cache.priceEUR || btcPriceEUR;
                this.lastWeekUpdate = now;
                console.log(`[priceCache] Updated previous week price: ${oldWeeklyPrice} -> ${this.cache.previousWeekPrice} (Days since last update: ${daysSinceLastUpdate})`);
            } else {
                console.log(`[priceCache] Keeping previous week price: ${this.cache.previousWeekPrice} (Days since last update: ${daysSinceLastUpdate})`);
            }
            
            const eurRatesResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
            const eurRates = eurRatesResponse.data.rates;
            
            const usdRatesResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
            const usdRates = usdRatesResponse.data.rates;
            
            const exchangeRates = {
                EUR: {
                    USD: eurRates.USD || 1.1,
                    PLN: eurRates.PLN || 4.5,
                    GBP: eurRates.GBP || 0.85,
                    JPY: eurRates.JPY || 160,
                    CHF: eurRates.CHF || 0.95
                },
                USD: {
                    EUR: usdRates.EUR || 0.9,
                    PLN: usdRates.PLN || 4.0,
                    GBP: usdRates.GBP || 0.75,
                    JPY: usdRates.JPY || 145,
                    CHF: usdRates.CHF || 0.85
                }
            };
            
            this.cache = {
                ...this.cache,
                priceEUR: btcPriceEUR,
                priceUSD: btcPriceUSD,
                price: btcPriceEUR,
                eurUsd: eurRates.USD,
                eurPln: eurRates.PLN,
                eurGbp: eurRates.GBP,
                eurJpy: eurRates.JPY,
                eurChf: eurRates.CHF,
                exchangeRates,
                timestamp: new Date().toISOString()
            };
            
            await this.saveToDisk();
            console.log(`[priceCache] BTC prices: ${btcPriceEUR} EUR / ${btcPriceUSD} USD, updated at ${this.cache.timestamp}`);
        } catch (error) {
            console.error('[priceCache] Error updating prices:', error);
            
            if (!this.cache.priceEUR && !this.cache.priceUSD) {
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
                    exchangeRates: {
                        EUR: { USD: 1.1, PLN: 4.5, GBP: 0.85, JPY: 160, CHF: 0.95 },
                        USD: { EUR: 0.9, PLN: 4.0, GBP: 0.75, JPY: 145, CHF: 0.85 }
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
        console.log(`[priceCache] Prices updated to ${priceEUR} EUR / ${priceUSD || 'N/A'} USD at ${this.cache.timestamp}`);
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
        }
        
        // Update USD rates if provided
        if (usdRates && typeof usdRates === 'object') {
            this.cache.exchangeRates = this.cache.exchangeRates || {};
            this.cache.exchangeRates.USD = usdRates;
        }
        
        this.cache.timestamp = new Date().toISOString();
        await this.saveToDisk();
        console.log(`[priceCache] Exchange rates updated at ${this.cache.timestamp}`);
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
            } else if (fromCurrency === 'USD' && toCurrency === 'EUR' && this.cache.eurUsd) {
                return 1 / this.cache.eurUsd;
            } else if (fromCurrency === 'PLN' && toCurrency === 'EUR' && this.cache.eurPln) {
                return 1 / this.cache.eurPln;
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
            console.warn(`[priceCache] No exchange rate found for ${fromCurrency} to ${toCurrency}, using 1`);
            return 1;
        } catch (error) {
            console.error(`[priceCache] Error getting exchange rate from ${fromCurrency} to ${toCurrency}:`, error);
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
}

// Create a singleton instance
const priceCache = new PriceCache();

module.exports = priceCache;