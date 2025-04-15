const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // For nonce generation

const credentials = {
	apiKey: 'organizations/207f9542-3d10-479b-b2cd-311dfaada2ac/apiKeys/90d4c8f3-4700-4ddf-9c8e-9b88ddd92c1f', // Replace with your actual API key name
		privateKey: `-----BEGIN EC PRIVATE KEY-----
	MHcCAQEEIHK4DIQ7kRwQ1wa4QbsyU/vohoJWmpm1Y9IwsJMlJg9eoAoGCCqGSM49
	AwEHoUQDQgAESc3RiUSI7RUR5AgQW4J9fhCe6fVktvgM+kZ430LLrRdkPtYo3+6n
	JFj4DgbI8OfiahumMILMq2T2xffbL0mwXA==
	-----END EC PRIVATE KEY-----` // Replace with your actual private key
};

const BASE_API_URL = 'https://api.coinbase.com'; // Use production or sandbox URL as needed
const CDP_API_URL = 'https://api.cdp.coinbase.com'; // CDP specific URL

function generateJwt(method, path, params = {}) {
	const service = 'retail_rest_api_proxy'; // Or the specific service you're accessing
	const apiKeyName = credentials.apiKey;
	const privateKey = credentials.privateKey;

	const request_host = 'api.coinbase.com'; // Hostname for the API
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

	try {
		const token = jwt.sign(payload, privateKey, { algorithm: 'ES256', header: { kid: apiKeyName, alg: 'ES256', nonce: payload.nonce } });
		// console.log("Generated JWT:", token); // Uncomment for debugging
		return token;
	} catch (error) {
		console.error("Error generating JWT:", error);
		throw error;
	}
}

async function makeApiCall(method, path, params = {}) {
	const token = generateJwt(method, path, params); // Pass params to generateJwt
	const url = `${BASE_API_URL}${path}`;
	const headers = {
		'Authorization': `Bearer ${token}`,
		'Content-Type': 'application/json' // Although body is empty for GET
	};

	// Log the request configuration before sending
	const logConfig = {
		method: method,
		maxBodyLength: Infinity,
		url: url,
		headers: { 
			...headers, 
			'Authorization': 'Bearer ***REDACTED***' // Redact token in logs
		}
	};
	if (method.toUpperCase() === 'GET' && Object.keys(params).length > 0) {
		logConfig.url += '?' + new URLSearchParams(params).toString(); // Show params in URL for GET
		// We pass params separately to axios, but show in URL for log clarity
	}
	// Add data field if it were a POST/PUT etc.
	// if (method.toUpperCase() !== 'GET') {
	//     logConfig.data = params; 
	// }
	console.log('\n--- Preparing Axios Request Config ---');
	console.log(JSON.stringify(logConfig, null, 2));
	console.log('--------------------------------------');

	console.log(`Making ${method} request to ${url} with params ${JSON.stringify(params)}...`);
	try {
		const response = await axios({
			method: method,
			url: url,
			headers: headers,
			params: params // Pass query parameters to axios
		});
		// Return the full response object instead of just response.data
		return response;
	} catch (error) {
		console.error(`Error calling ${path}:`, error.message);
		if (error.response) {
			console.error('API Response Status:', error.response.status);
			console.error('API Response Data:', JSON.stringify(error.response.data, null, 2));
			// Log response headers on error too, might be useful
			console.error('API Response Headers:', JSON.stringify(error.response.headers, null, 2));
		} else if (error.request) {
			console.error('No response received:', error.request);
		} else {
			console.error('Error setting up request:', error.message);
		}
		throw error; // Re-throw the error after logging
	}
}

async function makeCdpApiCall(method, path, params = {}) {
	const token = generateJwt(method, path, params);
	const url = `${CDP_API_URL}${path}`;
	const headers = {
		'Authorization': `Bearer ${token}`,
		'Content-Type': 'application/json',
		'Accept': 'application/json'
	};

	// Log the request configuration before sending
	const logConfig = {
		method: method,
		maxBodyLength: Infinity,
		url: url,
		headers: { 
			...headers, 
			'Authorization': 'Bearer ***REDACTED***' // Redact token in logs
		}
	};
	if (method.toUpperCase() === 'GET' && Object.keys(params).length > 0) {
		logConfig.url += '?' + new URLSearchParams(params).toString();
	}
	console.log('\n--- Preparing CDP API Request Config ---');
	console.log(JSON.stringify(logConfig, null, 2));
	console.log('--------------------------------------');

	console.log(`Making CDP ${method} request to ${url} with params ${JSON.stringify(params)}...`);
	try {
		const response = await axios({
			method: method,
			url: url,
			headers: headers,
			params: method.toUpperCase() === 'GET' ? params : undefined,
			data: method.toUpperCase() !== 'GET' ? params : undefined
		});
		return response;
	} catch (error) {
		console.error(`Error calling CDP ${path}:`, error.message);
		if (error.response) {
			console.error('CDP API Response Status:', error.response.status);
			console.error('CDP API Response Data:', JSON.stringify(error.response.data, null, 2));
			console.error('CDP API Response Headers:', JSON.stringify(error.response.headers, null, 2));
		} else if (error.request) {
			console.error('No response received from CDP:', error.request);
		} else {
			console.error('Error setting up CDP request:', error.message);
		}
		throw error;
	}
}

async function getCompletedOrders() {
	try {
		// 1. Get accounts to find BTC account
		console.log('\n--- Getting BTC Account ---');
		const accountsResponse = await makeApiCall('GET', '/api/v3/brokerage/accounts');
		
		if (!accountsResponse.data?.accounts?.length) {
			console.log('No accounts found');
			return;
		}
		
		const btcAccount = accountsResponse.data.accounts.find(acc => acc.currency === 'BTC');
		if (!btcAccount) {
			console.log('No BTC account found');
			return;
		}
		
		console.log('Found BTC Account:', {
			id: btcAccount.uuid,
			currency: btcAccount.currency,
			balance: btcAccount.available_balance.value,
			created_at: btcAccount.created_at
		});
		
		// 2. Get historical orders (FILLED status)
		console.log('\n--- Getting Completed Orders ---');
		const creationDate = new Date(btcAccount.created_at);
		const currentDate = new Date();
		
		const orderParams = {
			start_date: creationDate.toISOString(),
			end_date: currentDate.toISOString(),
			product_type: 'SPOT',
			order_status: 'FILLED',
			limit: 100
		};
		
		const ordersResponse = await makeApiCall('GET', '/api/v3/brokerage/orders/historical/batch', orderParams);
		
		if (!ordersResponse.data?.orders?.length) {
			console.log('No orders found');
		} else {
			console.log('\n=== COMPLETED ORDERS ===');
			ordersResponse.data.orders.forEach(order => {
				console.log({
					order_id: order.order_id,
					product_id: order.product_id,
					side: order.side,
					order_type: order.order_type,
					created_time: order.created_time,
					filled_size: order.filled_size,
					price: order.average_filled_price,
					status: order.status
				});
			});
		}
		
		// 3. Get order fills for more details (including fees)
		console.log('\n--- Getting Order Fills (with Fees) ---');
		const fillsParams = {
			start_sequence_timestamp: creationDate.toISOString(),
			end_sequence_timestamp: currentDate.toISOString(),
			limit: 100
		};
		
		const fillsResponse = await makeApiCall('GET', '/api/v3/brokerage/orders/historical/fills', fillsParams);
		
		if (!fillsResponse.data?.fills?.length) {
			console.log('No fills found');
		} else {
			console.log('\n=== ORDER FILLS (WITH FEES) ===');
			fillsResponse.data.fills.forEach(fill => {
				console.log({
					order_id: fill.order_id,
					product_id: fill.product_id,
					side: fill.side,
					size: fill.size,
					price: fill.price,
					fee: fill.commission,
					trade_time: fill.trade_time
				});
			});
			
			// 4. Format transactions for our app
			console.log('\n--- Formatted Transactions ---');
			const formattedTransactions = fillsResponse.data.fills.map(fill => {
				const [baseCurrency, quoteCurrency] = fill.product_id.split('-');
				const isBuy = fill.side === 'BUY';
				
				return {
					date: new Date(fill.trade_time).toISOString(),
					type: isBuy ? 'buy' : 'sell',
					amount: parseFloat(fill.size),
					exchange: 'Coinbase',
					pair: `${baseCurrency}/${quoteCurrency}`,
					baseCurrency,
					quoteCurrency,
					original: {
						currency: quoteCurrency,
						price: parseFloat(fill.price),
						cost: parseFloat(fill.size) * parseFloat(fill.price),
						fee: parseFloat(fill.commission)
					}
				};
			});
			
			console.log(JSON.stringify(formattedTransactions, null, 2));
		}
	} catch (error) {
		console.error('Failed to get completed orders:', error.message);
	}
}

getCompletedOrders();