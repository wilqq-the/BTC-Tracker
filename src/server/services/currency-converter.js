const priceCache = require('../priceCache');
const Logger = require('../utils/logger');

// Initialize logger
const logger = Logger.create('CURRENCY-CONVERTER');

class CurrencyConverter {
    constructor() {
        // Base currencies that we always support
        this.baseCurrencies = ['EUR', 'USD'];
        
        // Secondary currencies that we support
        this.secondaryCurrencies = ['GBP', 'JPY', 'CHF', 'PLN', 'BRL', 'INR'];
        
        // All supported currencies
        this.supportedCurrencies = [...this.baseCurrencies, ...this.secondaryCurrencies];
    }

    /**
     * Initialize the converter
     * This will use the priceCache's existing rates
     */
    initialize() {
        // No need to initialize rates as we'll use priceCache
        logger.debug('CurrencyConverter initialized, using priceCache for rates');
    }

    /**
     * Check if a currency is supported
     * @param {string} currency Currency code
     * @returns {boolean}
     */
    isSupported(currency) {
        return this.supportedCurrencies.includes(currency.toUpperCase());
    }

    /**
     * Get the exchange rate between two currencies
     * @param {string} from Source currency
     * @param {string} to Target currency
     * @returns {number} Exchange rate
     */
    getRate(from, to) {
        from = from.toUpperCase();
        to = to.toUpperCase();

        // Validate currencies
        if (!this.isSupported(from) || !this.isSupported(to)) {
            throw new Error(`Unsupported currency pair: ${from}/${to}`);
        }

        // Use priceCache's getExchangeRate method which already handles all conversion cases
        const rate = priceCache.getExchangeRate(from, to);
        if (!rate) {
            throw new Error(`No conversion rate available for ${from}/${to}`);
        }

        return rate;
    }

    /**
     * Convert an amount from one currency to another
     * @param {number} amount Amount to convert
     * @param {string} from Source currency
     * @param {string} to Target currency
     * @returns {number} Converted amount
     */
    convert(amount, from, to) {
        // Handle null/undefined amounts
        if (amount === null || amount === undefined || isNaN(amount)) {
            return 0;
        }
        
        const rate = this.getRate(from, to);
        return amount * rate;
    }

    /**
     * Convert all monetary values in an object from one currency to another
     * @param {Object} values Object containing monetary values
     * @param {string} from Source currency
     * @param {string} to Target currency
     * @returns {Object} Converted values
     */
    convertValues(values, from, to) {
        const rate = this.getRate(from, to);
        return {
            price: values.price * rate,
            cost: values.cost * rate,
            fee: (values.fee || 0) * rate,
            rate: rate
        };
    }

    /**
     * Check if rates need updating by checking priceCache
     * @returns {boolean}
     */
    needsUpdate() {
        const lastUpdated = priceCache.getRatesLastUpdated();
        if (!lastUpdated) return true;
        
        // Use the same cache duration as priceCache (1 hour)
        return lastUpdated.secondsAgo > 3600;
    }

    /**
     * Update exchange rates from Yahoo Finance
     * @returns {Promise<void>}
     */
    async updateRates() {
        try {
            logger.debug('Fetching fresh exchange rates from Yahoo Finance...');
            
            // Let priceCache handle the Yahoo Finance fetching
            await priceCache.updatePrices();
            
            logger.debug('Exchange rates updated successfully from Yahoo Finance');
        } catch (error) {
            logger.error('Error updating exchange rates from Yahoo Finance:', error);
            throw error;
        }
    }

    /**
     * Ensure we have up-to-date rates
     * @returns {Promise<void>}
     */
    async ensureRates() {
        if (this.needsUpdate()) {
            await this.updateRates();
        }
    }

    /**
     * Get all available exchange rates
     * @returns {Object} Current exchange rates
     */
    getAllRates() {
        const cachedPrices = priceCache.getCachedPrices();
        return cachedPrices.exchangeRates || {};
    }

    /**
     * Get the last update timestamp
     * @returns {Object} Timestamp information
     */
    getLastUpdate() {
        return priceCache.getRatesLastUpdated();
    }
}

// Export a singleton instance
module.exports = new CurrencyConverter(); 