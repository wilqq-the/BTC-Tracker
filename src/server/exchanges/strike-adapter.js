const axios = require('axios');
const ExchangeAdapter = require('./exchange-adapter');
const credentialManager = require('../services/credential-manager');

/**
 * Strike Adapter - Currently in development pending API clarification
 * For now, manual import is required
 */
class StrikeAdapter extends ExchangeAdapter {
    constructor(config = {}) {
        super(config);
        this.name = 'Strike (Manual Import)';
        this.baseUrl = 'https://api.strike.me/v1';
        this.apiVersion = 'v1';
        this.credentials = null;
        
        // Flag to indicate API limitations
        this.manualImportRequired = true;
    }

    getRequiredCredentials() {
        return [
            {
                key: 'apiKey',
                label: 'API Key',
                type: 'password',
                help: 'Generate API key from your Strike Dashboard. Note: Strike API access is currently limited, manual import may be required.'
            }
        ];
    }

    /**
     * Test connection with provided credentials
     * @param {Object} credentials - API credentials to test
     * @returns {Promise<boolean>} True if credentials are valid
     */
    async testConnection(credentials) {
        try {
            // For testing purposes - accept any credentials in dev mode
            if (process.env.NODE_ENV === 'development' && credentials.apiKey === 'test') {
                console.log('Using TEST MODE for Strike');
                return true;
            }
            
            // Check the minimum required fields
            if (!credentials.apiKey) {
                console.error('Missing API Key for Strike connection test');
                return false;
            }
            
            console.log(`Testing Strike connection with API Key: ${credentials.apiKey.substring(0, 5)}...`);
            
            // Try to get user profile - basic authentication test
            try {
                const response = await this._privateRequest('/accounts/profile', {}, credentials);
                // If we can access the profile, the API key is valid
                console.log('Strike API key is valid. Connected successfully.');
                return true;
            } catch (profileError) {
                // If we can't get the profile, let's try the balances endpoint
                try {
                    const balances = await this._privateRequest('/balances', {}, credentials);
                    console.log('Strike API key is valid. Connected successfully.');
                    return true;
                } catch (balanceError) {
                    console.error('Could not access Strike endpoints with provided API key');
                    return false;
                }
            }
        } catch (error) {
            console.error('Error testing Strike connection:', error.message);
            return false;
        }
    }

    /**
     * Connect to Strike using stored credentials
     * @returns {Promise<boolean>} True if connection successful
     */
    async connect() {
        try {
            console.info('Connecting to Strike API...');
            
            // Get credentials - FIXED: Added await here since getCredentials is async
            this.credentials = await credentialManager.getCredentials('strike');
            
            if (!this.credentials) {
                console.error('No Strike credentials found');
                this.isConnected = false;
                return false;
            }
            
            console.log('Loaded Strike credentials, API Key starts with:', this.credentials.apiKey.substring(0, 5));
            
            // Test credentials by fetching account profile
            const result = await this.testConnection(this.credentials);
            this.isConnected = result;
            
            if (result) {
                console.info('Successfully connected to Strike API');
                
                // Notify about manual import requirement
                console.info('NOTE: Strike API access for transaction history is limited.');
                console.info('Manual import is currently recommended until Strike support provides clearer API guidance.');
            }
            
            return result;
        } catch (error) {
            console.error(`Strike API connection error: ${error.message}`);
            this.isConnected = false;
            return false;
        }
    }

    async getTransactions(options = {}) {
        try {
            console.info(`Fetching Strike transactions with options: ${JSON.stringify(options)}`);
            
            // Display warning about limited API access
            console.warn('Strike API access for transaction history is limited.');
            console.warn('Manual import is currently recommended until Strike support provides clearer API guidance.');
            
            // Return empty array for now
            // This will be updated once Strike support provides the correct endpoints
            return [];
        } catch (error) {
            console.error(`Strike transaction fetch error: ${error.message}`);
            return [];
        }
    }

    async getBalances() {
        try {
            console.info('Fetching Strike balances');
            
            // Try to get balances - this endpoint might work
            const response = await this._privateRequest('/balances');
            
            if (!response || !response.data) {
                console.warn('No balances returned from Strike API');
                return { BTC: 0 };
            }
            
            const balances = response.data;
            
            // Transform to our standard format
            // Filter for BTC balances only
            const btcBalance = balances.find(balance => balance.currency === 'BTC');
            
            if (!btcBalance) {
                console.info('No BTC balance found on Strike');
                return { BTC: 0 };
            }
            
            return {
                BTC: parseFloat(btcBalance.current || 0)
            };
        } catch (error) {
            console.error(`Strike balance fetch error: ${error.message}`);
            console.warn('Strike API access might be limited. Please check with Strike support.');
            return { BTC: 0 };
        }
    }

    async _privateRequest(endpoint, params = {}, creds = null) {
        const credentials = creds || this.credentials;
        if (!credentials || !credentials.apiKey) {
            throw new Error('API key is required for private Strike API requests');
        }
        
        try {
            const url = `${this.baseUrl}${endpoint}`;
            console.debug(`Making private request to Strike: ${url}`);
            
            const response = await axios({
                method: 'GET',
                url,
                params,
                headers: {
                    'Authorization': `Bearer ${credentials.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return response;
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    throw new Error('Unauthorized: Invalid API key');
                } else if (status === 403) {
                    throw new Error('Forbidden: Insufficient permissions');
                } else if (status === 429) {
                    throw new Error('Rate limit exceeded');
                } else {
                    // Parse Strike API error format
                    if (data && data.data) {
                        const errorMsg = data.data.message || 'Unknown Strike API error';
                        const errorCode = data.data.code || 'UNKNOWN_ERROR';
                        throw new Error(`Strike API error (${errorCode}): ${errorMsg}`);
                    }
                }
            }
            
            throw error;
        }
    }
}

module.exports = StrikeAdapter; 