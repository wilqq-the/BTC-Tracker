const { v4: uuidv4 } = require('uuid');

class Transaction {
    /**
     * Create a new transaction
     * @param {Object} data Initial transaction data
     */
    constructor(data = {}) {
        // Core transaction data
        this.id = data.id || uuidv4();
        this.exchange = data.exchange || 'manual';
        this.type = data.type || 'buy';
        this.amount = parseFloat(data.amount) || 0;
        this.date = new Date(data.date || Date.now()).toISOString();
        this.txType = data.txType || 'spot'; // spot, fiat_payment, deposit, withdrawal
        this.status = data.status || 'Completed';
        this.paymentMethod = data.paymentMethod;

        // Original transaction values (immutable)
        this.original = {
            currency: data.original?.currency || data.currency || 'EUR',
            price: parseFloat(data.original?.price || data.price) || 0,
            cost: parseFloat(data.original?.cost || data.cost) || 0,
            fee: parseFloat(data.original?.fee || data.fee) || 0
        };

        // Base currency values (EUR and USD)
        this.base = {
            eur: {
                price: 0,
                cost: 0,
                fee: 0,
                rate: 1.0
            },
            usd: {
                price: 0,
                cost: 0,
                fee: 0,
                rate: 1.0
            }
        };

        // Optional secondary currency
        this.secondary = null;

        // Additional metadata
        this.pair = data.pair;
        this.baseCurrency = data.baseCurrency || 'BTC';
        this.quoteCurrency = data.quoteCurrency || this.original.currency;
        
        // If exchange rates are provided, calculate base currency values
        if (data.base?.eur) {
            this.setBaseValues('eur', data.base.eur);
        }
        if (data.base?.usd) {
            this.setBaseValues('usd', data.base.usd);
        }
    }

    /**
     * Set values for a base currency
     * @param {string} currency - 'eur' or 'usd'
     * @param {Object} values - { price, cost, fee, rate }
     */
    setBaseValues(currency, values) {
        if (!this.base[currency]) {
            throw new Error(`Invalid base currency: ${currency}`);
        }

        this.base[currency] = {
            price: parseFloat(values.price) || 0,
            cost: parseFloat(values.cost) || 0,
            fee: parseFloat(values.fee) || 0,
            rate: parseFloat(values.rate) || 1.0
        };
    }

    /**
     * Set a secondary currency
     * @param {Object} values - { currency, price, cost, fee, rate }
     */
    setSecondaryCurrency(values) {
        this.secondary = {
            currency: values.currency,
            price: parseFloat(values.price) || 0,
            cost: parseFloat(values.cost) || 0,
            fee: parseFloat(values.fee) || 0,
            rate: parseFloat(values.rate) || 1.0
        };
    }

    /**
     * Get values in a specific currency
     * @param {string} currency - Currency code (e.g., 'EUR', 'USD', 'PLN')
     * @returns {Object} Values in requested currency
     */
    getValuesInCurrency(currency) {
        const curr = currency.toLowerCase();
        
        // Check if it's a base currency
        if (this.base[curr]) {
            return this.base[curr];
        }
        
        // Check if it's the secondary currency
        if (this.secondary && this.secondary.currency.toLowerCase() === curr) {
            return this.secondary;
        }
        
        // Check if it's the original currency
        if (this.original.currency.toLowerCase() === curr) {
            return {
                price: this.original.price,
                cost: this.original.cost,
                fee: this.original.fee,
                rate: 1.0
            };
        }
        
        throw new Error(`No values available for currency: ${currency}`);
    }

    /**
     * Convert transaction values to a different currency
     * @param {string} targetCurrency - Currency to convert to
     * @param {number} rate - Exchange rate
     */
    convertTo(targetCurrency, rate) {
        const curr = targetCurrency.toLowerCase();
        
        // Don't convert if it's already a base currency
        if (this.base[curr]) {
            return;
        }
        
        // Create secondary currency values
        this.setSecondaryCurrency({
            currency: targetCurrency,
            price: this.original.price * rate,
            cost: this.original.cost * rate,
            fee: this.original.fee * rate,
            rate: rate
        });
    }

    /**
     * Validate the transaction data
     * @returns {boolean} Whether the transaction is valid
     */
    isValid() {
        // Basic validation
        if (!this.amount || this.amount <= 0) return false;
        if (!this.date) return false;
        if (!['buy', 'sell'].includes(this.type)) return false;
        
        // Ensure we have original values
        if (!this.original.price || !this.original.currency) return false;
        
        // Ensure we have at least one base currency
        if (!this.base.eur.price && !this.base.usd.price) return false;
        
        return true;
    }

    /**
     * Convert the transaction to a plain object
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            // Core data
            id: this.id,
            exchange: this.exchange,
            type: this.type,
            amount: this.amount,
            date: this.date,
            txType: this.txType,
            status: this.status,
            paymentMethod: this.paymentMethod,
            
            // Original values
            original: this.original,
            
            // Base currency values
            base: this.base,
            
            // Secondary currency (if exists)
            secondary: this.secondary,
            
            // Additional metadata
            pair: this.pair,
            baseCurrency: this.baseCurrency,
            quoteCurrency: this.quoteCurrency
        };
    }

    /**
     * Create a Transaction instance from a plain object
     * @param {Object} data Plain object data
     * @returns {Transaction} New Transaction instance
     */
    static fromJSON(data) {
        return new Transaction(data);
    }
}

module.exports = Transaction; 