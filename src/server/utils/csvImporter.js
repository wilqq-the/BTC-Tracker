const { parse } = require('csv-parse');
const { FormatDetector } = require('./formatDetector');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

class CsvImporter {
    constructor(currencyConverter) {
        this.currencyConverter = currencyConverter;
    }

    async importCsvData(csvFilePath, transactions = []) {
        try {
            console.log(`[csvImporter] Reading CSV file from path: ${csvFilePath}`);
            
            const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
            console.log(`[csvImporter] CSV file read, content length: ${fileContent.length} bytes`);
            
            if (fileContent.length === 0) {
                throw new Error('CSV file is empty');
            }

            // Detect the format
            const Format = FormatDetector.detectFormat(fileContent);
            console.log(`[csvImporter] Detected format: ${Format.name}`);

            // Parse the CSV content
            const records = await new Promise((resolve, reject) => {
                // First detect the delimiter
                const firstLine = fileContent.split('\n')[0];
                const delimiter = firstLine.includes(';') ? ';' : ',';
                console.log('[csvImporter] Detected delimiter:', delimiter);
                console.log('[csvImporter] First line sample:', firstLine);

                parse(fileContent, {
                    columns: true,
                    skip_empty_lines: true,
                    delimiter: delimiter,
                    trim: true,
                    skip_records_with_empty_values: true,
                    relax_column_count: true // Allow varying number of columns
                }, (err, records) => {
                    if (err) {
                        console.error('[csvImporter] Error parsing CSV:', err);
                        reject(err);
                        return;
                    }
                    
                    // Validate records array
                    if (!Array.isArray(records)) {
                        console.error('[csvImporter] Invalid records format:', typeof records);
                        reject(new Error('Invalid CSV format: records must be an array'));
                        return;
                    }

                    // Log raw records for debugging
                    console.log('[csvImporter] Raw records sample:', records.slice(0, 2));

                    // Filter out invalid records and normalize column names
                    const validRecords = records
                        .filter(record => 
                            record && 
                            typeof record === 'object' && 
                            Object.keys(record).length > 0
                        )
                        .map(record => {
                            // Normalize column names by trimming and removing BOM
                            const normalizedRecord = {};
                            for (const [key, value] of Object.entries(record)) {
                                const normalizedKey = key.trim().replace(/^\uFEFF/, '');
                                normalizedRecord[normalizedKey] = value;
                            }
                            return normalizedRecord;
                        });

                    if (validRecords.length === 0) {
                        console.error('[csvImporter] No valid records found after filtering');
                        reject(new Error('No valid records found in CSV file'));
                        return;
                    }

                    // Log the headers and first record after normalization
                    console.log('[csvImporter] Normalized headers:', Object.keys(validRecords[0]));
                    console.log('[csvImporter] First normalized record:', validRecords[0]);
                    
                    resolve(validRecords);
                });
            });

            if (!records || records.length === 0) {
                throw new Error('No valid records found in CSV file');
            }

            console.log(`[csvImporter] CSV parsed successfully. Found ${records.length} records`);
            
            await this.currencyConverter.ensureRates();
            
            const newTransactions = [];
            let skippedCount = 0;
            
            for (const record of records) {
                try {
                    // Validate record before processing
                    if (!record || typeof record !== 'object' || Object.keys(record).length === 0) {
                        console.warn('[csvImporter] Skipping invalid record:', record);
                        skippedCount++;
                        continue;
                    }

                    // Convert to standard format using our format handlers
                    const formatInstance = new Format(record);
                    const standardFormat = formatInstance.toStandardFormat();

                    // Validate standard format
                    if (!this.isValidStandardFormat(standardFormat)) {
                        console.warn('[csvImporter] Skipping record with invalid standard format:', standardFormat);
                        skippedCount++;
                        continue;
                    }

                    // Create transaction data
                    const transactionData = {
                        id: uuidv4(),
                        exchange: standardFormat.exchange,
                        type: standardFormat.type,
                        amount: standardFormat.amount,
                        date: standardFormat.date,
                        txType: 'spot',
                        status: 'Completed',
                        paymentMethod: '',
                        
                        original: {
                            currency: standardFormat.originalCurrency,
                            price: standardFormat.originalPrice,
                            cost: standardFormat.originalCost,
                            fee: standardFormat.originalFee
                        },
                        
                        pair: `BTC/${standardFormat.originalCurrency}`,
                        baseCurrency: 'BTC',
                        quoteCurrency: standardFormat.originalCurrency
                    };

                    // Add currency conversions
                    await this.addCurrencyConversions(transactionData, standardFormat.originalCurrency);
                    
                    // Validate and add transaction
                    if (this.isValidTransaction(transactionData)) {
                        newTransactions.push(transactionData);
                    } else {
                        console.warn('[csvImporter] Skipping invalid transaction:', transactionData);
                        skippedCount++;
                    }
                } catch (recordError) {
                    console.error('[csvImporter] Error processing record:', recordError, record);
                    skippedCount++;
                }
            }

            // Sort new transactions by date
            newTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

            console.log(`[csvImporter] CSV Import Summary:
                - Total records: ${records.length}
                - Valid transactions: ${newTransactions.length}
                - Skipped records: ${skippedCount}`);

            // Filter out duplicates
            const existingTransactionIds = new Set(transactions.map(tx => tx.id));
            const uniqueNewTransactions = newTransactions.filter(tx => !existingTransactionIds.has(tx.id));
            
            console.log(`[csvImporter] Found ${uniqueNewTransactions.length} unique new transactions to add`);
            
            return uniqueNewTransactions;

        } catch (error) {
            console.error('[csvImporter] Error importing CSV data:', error);
            throw error;
        }
    }

    async addCurrencyConversions(transactionData, originalCurrency) {
        // Add EUR conversion if needed
        if (originalCurrency.toUpperCase() !== 'EUR') {
            try {
                const eurValues = await this.currencyConverter.convertValues({
                    price: transactionData.original.price,
                    cost: transactionData.original.cost,
                    fee: transactionData.original.fee
                }, originalCurrency, 'EUR');
                
                transactionData.base = {
                    eur: {
                        price: eurValues.price,
                        cost: eurValues.cost,
                        fee: eurValues.fee,
                        rate: eurValues.rate
                    }
                };
            } catch (error) {
                console.error(`[csvImporter] Error converting ${originalCurrency} to EUR:`, error.message);
                transactionData.base = {
                    eur: {
                        price: transactionData.original.price,
                        cost: transactionData.original.cost,
                        fee: transactionData.original.fee,
                        rate: 1.0
                    }
                };
            }
        } else {
            transactionData.base = {
                eur: {
                    price: transactionData.original.price,
                    cost: transactionData.original.cost,
                    fee: transactionData.original.fee,
                    rate: 1.0
                }
            };
        }

        // Add USD conversion if needed
        if (originalCurrency.toUpperCase() !== 'USD') {
            try {
                const usdValues = await this.currencyConverter.convertValues({
                    price: transactionData.original.price,
                    cost: transactionData.original.cost,
                    fee: transactionData.original.fee
                }, originalCurrency, 'USD');
                
                transactionData.base.usd = {
                    price: usdValues.price,
                    cost: usdValues.cost,
                    fee: usdValues.fee,
                    rate: usdValues.rate
                };
            } catch (error) {
                console.error(`[csvImporter] Error converting ${originalCurrency} to USD:`, error.message);
                transactionData.base.usd = {
                    price: transactionData.original.price,
                    cost: transactionData.original.cost,
                    fee: transactionData.original.fee,
                    rate: 1.0
                };
            }
        } else {
            transactionData.base.usd = {
                price: transactionData.original.price,
                cost: transactionData.original.cost,
                fee: transactionData.original.fee,
                rate: 1.0
            };
        }
    }

    isValidTransaction(transaction) {
        return (
            transaction.amount &&
            transaction.type &&
            transaction.original.currency &&
            transaction.original.price &&
            transaction.date
        );
    }

    isValidStandardFormat(format) {
        return (
            format &&
            typeof format === 'object' &&
            format.date &&
            format.type &&
            typeof format.amount === 'number' &&
            format.exchange &&
            format.originalCurrency
        );
    }
}

module.exports = { CsvImporter }; 