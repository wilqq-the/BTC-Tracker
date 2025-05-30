const axios = require('axios');
const priceCache = require('../priceCache');

class CurrencyConverter {
    constructor() {
        // Base currencies that we always support
        this.baseCurrencies = ['EUR', 'USD'];
        
        // Secondary currencies that we support
        this.secondaryCurrencies = ['GBP', 'JPY', 'CHF', 'PLN'];
        
        // All supported currencies
        this.supportedCurrencies = [...this.baseCurrencies, ...this.secondaryCurrencies];
    }

    /**
     * Initialize the converter
     * This will use the priceCache's existing rates
     */
    initialize() {
        // No need to initialize rates as we'll use priceCache
        console.log('CurrencyConverter initialized, using priceCache for rates');
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
     * Update exchange rates from external source
     * @returns {Promise<void>}
     */
    async updateRates() {
        try {
            console.log('Fetching fresh exchange rates...');
            
            // Get EUR-based rates
            const eurResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/EUR');
            const eurRates = eurResponse.data.rates;
            
            // Get USD-based rates
            const usdResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
            const usdRates = usdResponse.data.rates;
            
            // Format rates for our supported currencies
            const formattedEurRates = {};
            const formattedUsdRates = {};
            
            this.supportedCurrencies.forEach(currency => {
                if (eurRates[currency]) {
                    formattedEurRates[currency] = eurRates[currency];
                }
                if (usdRates[currency]) {
                    formattedUsdRates[currency] = usdRates[currency];
                }
            });
            
            // Update priceCache with new rates
            await priceCache.updateExchangeRates(formattedEurRates, formattedUsdRates);
            
            console.log('Exchange rates updated successfully');
        } catch (error) {
            console.error('Error updating exchange rates:', error);
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