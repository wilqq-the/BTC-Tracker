const { BaseFormat } = require('./BaseFormat.js');

class BtcTrackerFormat extends BaseFormat {
    static BTCTRACKER_HEADERS = [
        'Date', 'Type', 'Amount (BTC)', 'Exchange',
        'Original Currency', 'Original Price',
        'Original Cost', 'Original Fee'
    ];

    constructor(row) {
        super();
        if (!row || typeof row !== 'object') {
            throw new Error('Invalid row data: row must be an object');
        }

        this.date = row?.['Date'] || new Date().toISOString().split('T')[0];
        this.type = (row?.['Type'] || 'buy').toLowerCase();
        const amountField = row?.['Amount (BTC)'] || row?.['Amount'] || row?.['amount'] || '0';
        this.amount = parseFloat(amountField);
        this.exchange = row?.['Exchange'] || 'manual';

        let detectedCurrency = 'USD';
        const currencyFields = [
            'Original Currency', 'Currency', 'currency',
            'Fiat (USD)', 'Fiat (EUR)', 'Fiat (BRL)',
            'Fiat Currency', 'fiat currency'
        ];

        for (const field of currencyFields) {
            if (row?.[field]) {
                if (field.startsWith('Fiat (')) {
                    detectedCurrency = field.match(/\(([^)]+)\)/)?.[1] || 'USD';
                } else {
                    detectedCurrency = row[field];
                }
                break;
            }
        }

        if (detectedCurrency === 'USD') {
            const fiatFields = Object.keys(row || {}).filter(key => 
                key.startsWith('Fiat (') || 
                key.toLowerCase().includes('fiat') || 
                key.toLowerCase().includes('price')
            );
            
            if (fiatFields.length > 0) {
                for (const field of fiatFields) {
                    if (parseFloat(row[field]) > 0) {
                        if (field.startsWith('Fiat (')) {
                            detectedCurrency = field.match(/\(([^)]+)\)/)?.[1] || 'USD';
                        } else if (field.toLowerCase().includes('eur')) {
                            detectedCurrency = 'EUR';
                        } else if (field.toLowerCase().includes('brl')) {
                            detectedCurrency = 'BRL';
                        }
                        break;
                    }
                }
            }
        }

        this.originalCurrency = detectedCurrency;
        this.originalPrice = parseFloat(row?.['Original Price'] || '0');
        this.originalCost = parseFloat(row?.['Original Cost'] || '0');
        this.originalFee = parseFloat(row?.['Original Fee'] || '0');

        // Log the row data for debugging
        console.log('[BtcTrackerFormat] Processing row:', row);
        console.log('[BtcTrackerFormat] Available headers:', Object.keys(row || {}));
        
        // Calculate the standard format values for logging
        const standardFormat = this.toStandardFormat();
        console.log('[BtcTrackerFormat] Processed values:', {
            rawType: this.type,
            processedType: standardFormat.type,
            date: this.date,
            amount: this.amount,
            exchange: this.exchange,
            originalCurrency: this.originalCurrency,
            currencyDetection: {
                foundFields: currencyFields.filter(field => row?.[field]),
                detectedCurrency: this.originalCurrency
            }
        });
    }

    static detectFormat(content) {
        const firstLine = content.split('\n')[0];
        const headers = firstLine.split(',');
        console.log('[BtcTrackerFormat] Detecting format with headers:', headers);
        const matches = BtcTrackerFormat.BTCTRACKER_HEADERS.every(header => 
            headers.includes(header.trim())
        );
        console.log('[BtcTrackerFormat] Format detection result:', matches);
        return matches;
    }

    parseRow(row) {
        return new BtcTrackerFormat(row);
    }

    toStandardFormat() {
        try {
            // Validate required fields
            if (!this.date) {
                throw new Error('Date is required');
            }

            // Try to parse the date, if it fails use the current date
            let formattedDate;
            try {
                // Try to parse the date in various formats
                const dateObj = new Date(this.date);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toISOString().split('T')[0];
                } else {
                    console.warn('[BtcTrackerFormat] Invalid date format, using current date');
                    formattedDate = new Date().toISOString().split('T')[0];
                }
            } catch (dateError) {
                console.warn('[BtcTrackerFormat] Error parsing date, using current date:', dateError);
                formattedDate = new Date().toISOString().split('T')[0];
            }
            
            // Convert type to lowercase and ensure it's either 'buy' or 'sell'
            const transactionType = this.type.toLowerCase() === 'buy' ? 'buy' : 'sell';
            
            return {
                date: formattedDate,
                type: transactionType,
                amount: this.amount,
                exchange: this.exchange,
                originalCurrency: this.originalCurrency,
                originalPrice: this.originalPrice,
                originalCost: this.originalCost,
                originalFee: this.originalFee
            };
        } catch (error) {
            console.error('[BtcTrackerFormat] Error in toStandardFormat:', error);
            throw error;
        }
    }

    getHeaders() {
        return BtcTrackerFormat.BTCTRACKER_HEADERS;
    }

    getDelimiter() {
        return ',';
    }
}

module.exports = { BtcTrackerFormat }; 