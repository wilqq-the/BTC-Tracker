const { BaseFormat } = require('./BaseFormat.js');

class TrezorFormat extends BaseFormat {
    static TREZOR_HEADERS = [
        'Timestamp', 'Date', 'Time', 'Type', 'Transaction ID',
        'Fee', 'Fee unit', 'Address', 'Label', 'Amount',
        'Amount unit', 'Fiat (USD)', 'Other'
    ];

    constructor(row) {
        super();
        if (!row || typeof row !== 'object') {
            console.error('[TrezorFormat] Invalid row data:', row);
            throw new Error('Invalid row data: row must be an object');
        }

        // Log the raw row data for debugging
        console.log('[TrezorFormat] Raw row data:', row);

        // Handle timestamp with default to current timestamp
        this.timestamp = parseInt(row['Timestamp'] || Date.now().toString());
        
        // Handle date with default to current date
        this.date = row['Date'] || new Date().toISOString().split('T')[0];
        
        // Handle time with default to current time
        this.time = row['Time'] || new Date().toTimeString().split(' ')[0];
        
        // Handle type with default to 'buy'
        this.type = (row['Type'] || 'buy').toLowerCase();
        
        // Handle transaction ID with default to empty string
        this.txId = row['Transaction ID'] || '';
        
        // Handle fee with default to 0
        this.fee = parseFloat(row['Fee'] || '0');
        this.feeUnit = row['Fee unit'] || 'BTC';
        
        // Handle address and label with defaults
        this.address = row['Address'] || '';
        this.label = row['Label'] || '';
        
        // Handle amount with multiple possible field names
        const amountField = row['Amount'] || '0';
        this.amount = parseFloat(amountField);
        this.amountUnit = row['Amount unit'] || 'BTC';

        // Handle fiat amount with default to 0
        this.fiatUsd = parseFloat(row['Fiat (USD)'] || '0');

        // Set currency to USD by default since Trezor exports in USD
        this.originalCurrency = 'USD';

        // Log the processed values for debugging
        console.log('[TrezorFormat] Processed values:', {
            timestamp: this.timestamp,
            date: this.date,
            time: this.time,
            type: this.type,
            txId: this.txId,
            fee: this.fee,
            feeUnit: this.feeUnit,
            address: this.address,
            label: this.label,
            amount: this.amount,
            amountUnit: this.amountUnit,
            fiatUsd: this.fiatUsd,
            originalCurrency: this.originalCurrency
        });
    }

    static detectFormat(content) {
        const firstLine = content.split('\n')[0];
        const headers = firstLine.split(';');
        console.log('[TrezorFormat] Detecting format with headers:', headers);
        
        // Check if we have at least some of the expected headers
        const requiredHeaders = ['Timestamp', 'Date', 'Type', 'Amount'];
        const hasRequiredHeaders = requiredHeaders.every(header => 
            headers.some(h => h.trim() === header)
        );
        
        console.log('[TrezorFormat] Format detection result:', hasRequiredHeaders);
        return hasRequiredHeaders;
    }

    parseRow(row) {
        return new TrezorFormat(row);
    }

    toStandardFormat() {
        try {
            // Validate required fields
            if (!this.date) {
                console.warn('[TrezorFormat] Date is missing, using current date');
                this.date = new Date().toISOString().split('T')[0];
            }

            // Try to parse the date, if it fails use the current date
            let formattedDate;
            try {
                // First try to parse as MM/DD/YYYY
                const dateParts = this.date.split('/');
                if (dateParts.length === 3) {
                    const [month, day, year] = dateParts;
                    if (month && day && year) {
                        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    } else {
                        throw new Error('Invalid date parts');
                    }
                } else {
                    // Try to parse as ISO string or other format
                    const dateObj = new Date(this.date);
                    if (!isNaN(dateObj.getTime())) {
                        formattedDate = dateObj.toISOString().split('T')[0];
                    } else {
                        throw new Error('Invalid date format');
                    }
                }
            } catch (dateError) {
                console.warn('[TrezorFormat] Error parsing date, using current date:', dateError);
                formattedDate = new Date().toISOString().split('T')[0];
            }
            
            // Convert transaction type - handle both uppercase and lowercase
            const transactionType = this.type?.toLowerCase() === 'recv' ? 'buy' : 'sell';
            
            // Calculate price per BTC, handle division by zero
            const pricePerBtc = this.amount !== 0 ? (this.fiatUsd || 0) / Math.abs(this.amount) : 0;
            
            // Validate and sanitize values
            const standardFormat = {
                date: formattedDate,
                type: transactionType,
                amount: Math.abs(this.amount || 0),
                exchange: 'Trezor', // Always use Trezor as the exchange
                originalCurrency: this.originalCurrency || 'USD',
                originalPrice: pricePerBtc,
                originalCost: Math.abs(this.fiatUsd || 0),
                originalFee: this.fee || 0,
                // Additional metadata
                timestamp: this.timestamp || Date.now(),
                txId: this.txId || '',
                address: this.address || '',
                label: this.label || ''
            };

            // Log the processed values for debugging
            console.log('[TrezorFormat] Processed standard format:', standardFormat);
            
            return standardFormat;
        } catch (error) {
            console.error('[TrezorFormat] Error in toStandardFormat:', error);
            // Return a minimal valid format instead of throwing
            return {
                date: new Date().toISOString().split('T')[0],
                type: 'buy',
                amount: 0,
                exchange: 'Trezor',
                originalCurrency: 'USD',
                originalPrice: 0,
                originalCost: 0,
                originalFee: 0,
                timestamp: Date.now(),
                txId: '',
                address: '',
                label: ''
            };
        }
    }

    getHeaders() {
        return TrezorFormat.TREZOR_HEADERS;
    }

    getDelimiter() {
        return ';';
    }
}

module.exports = { TrezorFormat }; 