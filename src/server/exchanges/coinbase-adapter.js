const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const credentialManager = require('../services/credential-manager');
const Logger = require('../utils/logger');

class CoinbaseAdapter {
    constructor() {
        this.name = 'Coinbase';
        this.id = 'coinbase';
        this.baseUrl = 'https://api.coinbase.com';
        this.credentials = null;
        this.logger = Logger.create('COINBASE');
    }

    getRequiredCredentials() {
        return [
            {
                key: 'apiKey',
                label: 'API Key ID',
                type: 'text',
                help: 'Your Coinbase API Key ID (format: organizations/...)'
            },
            {
                key: 'privateKey',
                label: 'Private Key',
                type: 'password',
                help: 'Your EC Private Key (BEGIN EC PRIVATE KEY...)'
            }
        ];
    }

    async testConnection(credentials) {
        try {
            if (!credentials.apiKey || !credentials.privateKey) {
                this.logger.error('Missing required credentials for Coinbase connection test');
                return false;
            }

            // Clean up the private key if needed
            let cleanPrivateKey = credentials.privateKey.trim();
            
            // Fix private key formatting for proper PEM format
            cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
            
            // Ensure it has the standard EC private key format
            if (!cleanPrivateKey.includes('-----BEGIN EC PRIVATE KEY-----')) {
                this.logger.error('Invalid private key format: EC private key required');
                return false;
            }
            
            // If the key doesn't have proper newlines, restructure it
            if (!cleanPrivateKey.includes('\n-----END EC PRIVATE KEY-----')) {
                const parts = cleanPrivateKey.split('-----');
                if (parts.length >= 3) {
                    // Extract the base64 content
                    const keyContent = parts[2].replace(/\s+/g, '');
                    // Reconstruct with proper PEM format
                    cleanPrivateKey = `-----BEGIN EC PRIVATE KEY-----\n${keyContent}\n-----END EC PRIVATE KEY-----`;
                }
            }
            
            this.logger.debug('Private key format being used:', 
                        cleanPrivateKey.substring(0, 30) + '...' + cleanPrivateKey.substring(cleanPrivateKey.length - 30));

            // Store credentials temporarily for the test with clean private key
            this.credentials = {
                ...credentials,
                privateKey: cleanPrivateKey
            };

            this.logger.info('Testing Coinbase connection...');
            
            // Try to get accounts as a connection test
            const response = await this.makeRequest('GET', '/api/v3/brokerage/accounts');
            
            // Clear credentials after test
            this.credentials = null;

            const success = response.data && Array.isArray(response.data.accounts);
            this.logger.info(`Coinbase connection test ${success ? 'successful' : 'failed'}`);
            
            return success;
        } catch (error) {
            this.logger.error('Coinbase connection test failed:', error.message);
            if (error.response) {
                this.logger.error('Error response:', JSON.stringify(error.response.data, null, 2));
            }
            this.credentials = null;
            return false;
        }
    }

    async getTransactions(startDate, endDate) {
        try {
            if (!this.credentials) {
                throw new Error('No credentials set for Coinbase');
            }

            // First, get the BTC account
            const accountsResponse = await this.makeRequest('GET', '/api/v3/brokerage/accounts');
            
            if (!accountsResponse.data || !accountsResponse.data.accounts || !accountsResponse.data.accounts.length) {
                this.logger.warn('No accounts found on Coinbase');
                return [];
            }
            
            const btcAccount = accountsResponse.data.accounts.find(acc => acc.currency === 'BTC');
            if (!btcAccount) {
                this.logger.warn('No BTC account found on Coinbase');
                return [];
            }
            
            this.logger.info(`Found Coinbase BTC account with balance: ${btcAccount.available_balance.value}`);
            
            // Handle date parameters safely
            let formattedStartDate;
            let formattedEndDate;
            
            try {
                // Use account creation date if no start date provided
                if (!startDate && btcAccount.created_at) {
                    formattedStartDate = new Date(btcAccount.created_at).toISOString();
                } else if (startDate) {
                    // Make sure the date is valid
                    formattedStartDate = new Date(startDate);
                    if (isNaN(formattedStartDate.getTime())) {
                        this.logger.warn('Invalid start date provided, using account creation date instead');
                        formattedStartDate = btcAccount.created_at ? 
                            new Date(btcAccount.created_at).toISOString() : 
                            new Date(0).toISOString(); // fallback to epoch start
                    } else {
                        formattedStartDate = formattedStartDate.toISOString();
                    }
                } else {
                    // If all else fails, use a safe default
                    formattedStartDate = new Date(0).toISOString(); // start from epoch
                }
                
                // Default to current time if no end date or invalid
                if (!endDate) {
                    formattedEndDate = new Date().toISOString();
                } else {
                    formattedEndDate = new Date(endDate);
                    if (isNaN(formattedEndDate.getTime())) {
                        this.logger.warn('Invalid end date provided, using current date instead');
                        formattedEndDate = new Date().toISOString();
                    } else {
                        formattedEndDate = formattedEndDate.toISOString();
                    }
                }
            } catch (dateError) {
                this.logger.error('Error parsing dates:', dateError);
                // Use safe defaults
                formattedStartDate = btcAccount.created_at ? 
                    new Date(btcAccount.created_at).toISOString() : 
                    new Date(0).toISOString();
                formattedEndDate = new Date().toISOString();
            }
            
            this.logger.info(`Fetching Coinbase transactions from ${formattedStartDate} to ${formattedEndDate}`);
            
            // Get order fills - these contain the most complete transaction information including fees
            const fillsResponse = await this.makeRequest('GET', '/api/v3/brokerage/orders/historical/fills', {
                start_sequence_timestamp: formattedStartDate,
                end_sequence_timestamp: formattedEndDate,
                limit: 100
            });
            
            if (!fillsResponse.data?.fills?.length) {
                this.logger.info('No transaction fills found on Coinbase for the specified date range');
                return [];
            }
            
            this.logger.info(`Found ${fillsResponse.data.fills.length} transaction fills on Coinbase`);
            
            // Format transactions from fills
            const transactions = fillsResponse.data.fills.map(fill => {
                try {
                    const [baseCurrency, quoteCurrency] = fill.product_id.split('-');
                    const isBuy = fill.side === 'BUY';
                    
                    // Skip sell orders - only include buy transactions
                    if (!isBuy) {
                        return null;
                    }
                    
                    const amount = parseFloat(fill.size || 0);
                    const price = parseFloat(fill.price || 0);
                    const fee = parseFloat(fill.commission || 0);
                    
                    // Calculate the actual cost including fees
                    const cost = (amount * price) + fee;
                    
                    return {
                        id: fill.trade_id || uuidv4(),
                        date: new Date(fill.trade_time).toISOString(),
                        type: 'buy', // Always 'buy' since we're filtering out sells
                        amount,
                        pair: `${baseCurrency}/${quoteCurrency}`,
                        baseCurrency,
                        quoteCurrency,
                        txType: 'spot',
                        status: 'Completed',
                        exchange: 'coinbase',
                        exchangeOrderId: fill.order_id,
                        
                        original: {
                            currency: quoteCurrency,
                            price,
                            cost, // Include fees in the cost
                            fee
                        }
                    };
                } catch (itemError) {
                    console.error('Error processing transaction item:', itemError, fill);
                    return null;
                }
            }).filter(tx => tx !== null); // Remove any failed items
            
            this.logger.info(`Returning ${transactions.length} buy transactions from Coinbase`);
            
            return transactions;
        } catch (error) {
            this.logger.error('Error fetching Coinbase transactions:', error.message);
            if (error.response) {
                this.logger.error('Error response:', JSON.stringify(error.response.data, null, 2));
            }
            throw new Error(`Failed to fetch Coinbase transactions: ${error.message}`);
        }
    }

    generateJwt(method, path, params = {}) {
        try {
            const service = 'retail_rest_api_proxy';
            const apiKeyName = this.credentials.apiKey;
            let privateKey = this.credentials.privateKey;

            // Fix private key formatting
            // Ensure it has the right format with proper line breaks
            if (!privateKey.includes('-----BEGIN EC PRIVATE KEY-----')) {
                throw new Error('Private key must be an EC private key');
            }

            // Normalize the private key format
            privateKey = privateKey.replace(/\\n/g, '\n');
            
            // If the key doesn't have proper newlines, add them
            if (!privateKey.includes('\n-----END EC PRIVATE KEY-----')) {
                const parts = privateKey.split('-----');
                if (parts.length >= 3) {
                    const keyContent = parts[2].replace(/\s+/g, '');
                    // Reconstruct the key with proper formatting
                    privateKey = `-----BEGIN EC PRIVATE KEY-----\n${keyContent}\n-----END EC PRIVATE KEY-----`;
                }
            }

            const request_host = 'api.coinbase.com';
            const request_path = path;
            const request_method = method.toUpperCase();

            // Don't include query params in the URI for JWT generation
            const uri = `${request_method} ${request_host}${request_path}`;

            const payload = {
                sub: apiKeyName,
                iss: 'coinbase-cloud',
                nbf: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 120, // Expires in 2 minutes
                aud: [service],
                uri: uri,
                nonce: uuidv4() // Generate a unique nonce for each request
            };

            this.logger.debug('Attempting to sign JWT with key format:', 
                         privateKey.substring(0, 30) + '...' + privateKey.substring(privateKey.length - 30));

            const token = jwt.sign(payload, privateKey, { 
                algorithm: 'ES256', 
                header: { 
                    kid: apiKeyName, 
                    alg: 'ES256', 
                    nonce: payload.nonce 
                } 
            });
            return token;
        } catch (error) {
            this.logger.error("Error generating JWT:", error.message);
            throw error;
        }
    }

    async makeRequest(method, path, params = {}) {
        try {
            // Validate credentials
            if (!this.credentials || !this.credentials.apiKey || !this.credentials.privateKey) {
                throw new Error('Missing or invalid Coinbase credentials');
            }

            const token = this.generateJwt(method, path, params);
            const url = `${this.baseUrl}${path}`;
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            console.log(`Making ${method} request to ${path} with params:`, JSON.stringify(params, null, 2));
            
            const response = await axios({
                method: method,
                url: url,
                headers: headers,
                params: method.toUpperCase() === 'GET' ? params : undefined,
                data: method.toUpperCase() !== 'GET' ? params : undefined
            });
            
            return response;
        } catch (error) {
            let errorMessage = `Error calling Coinbase ${path}: ${error.message}`;
            
            // Enhanced error reporting
            if (error.response) {
                errorMessage += ` (Status: ${error.response.status})`;
                this.logger.error('API Response Status:', error.response.status);
                this.logger.error('API Response Data:', JSON.stringify(error.response.data, null, 2));
                
                // Try to extract a more specific error message if available
                if (error.response.data && error.response.data.message) {
                    errorMessage += ` - ${error.response.data.message}`;
                }
            } else if (error.request) {
                errorMessage += ' - No response received from server';
                this.logger.error('No response received:', error.request);
            }
            
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }

    setCredentials(credentials) {
        this.credentials = credentials;
    }

    async connect(credentials = null) {
        try {
            console.log('Coinbase adapter connect called with:', credentials ? 'credentials provided' : 'undefined credentials');
            
            // Use provided credentials or try to get saved credentials
            let credsToUse = credentials;
            
            // If no credentials provided, attempt to load from credential manager
            if (!credsToUse) {
                console.log('No credentials provided, trying to load saved credentials');
                credsToUse = await credentialManager.getCredentials('coinbase');
                
                if (!credsToUse) {
                    console.error('No saved credentials found for Coinbase');
                    return false;
                }
                
                console.log('Loaded Coinbase credentials, API Key starts with:', 
                           credsToUse.apiKey.substring(0, 20) + '...');
            }
            
            // Validate credentials
            if (!credsToUse || !credsToUse.apiKey || !credsToUse.privateKey) {
                console.error('Missing required Coinbase credentials in connect method');
                return false;
            }
            
            // Test the connection
            const isConnected = await this.testConnection(credsToUse);
            
            if (isConnected) {
                // If successful, store the credentials
                this.setCredentials(credsToUse);
                console.log('Coinbase connection established successfully');
                return true;
            }
            
            console.error('Coinbase connection test failed in connect method');
            return false;
        } catch (error) {
            console.error('Failed to connect to Coinbase:', error.message);
            return false;
        }
    }

    getStatus() {
        return !!this.credentials;
    }

    getName() {
        return this.name;
    }
}

module.exports = CoinbaseAdapter; 