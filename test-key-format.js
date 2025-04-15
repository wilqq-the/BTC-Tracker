// Simple script to test EC private key formatting
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Replace with your private key as copied from Coinbase
let privateKey = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIHK4DIQ7kRwQ1wa4QbsyU/vohoJWmpm1Y9IwsJMlJg9eoAoGCCqGSM49
AwEHoUQDQgAESc3RiUSI7RUR5AgQW4J9fhCe6fVktvgM+kZ430LLrRdkPtYo3+6n
JFj4DgbI8OfiahumMILMq2T2xffbL0mwXA==
-----END EC PRIVATE KEY-----`;

// Try to fix common formatting issues
function formatEcPrivateKey(key) {
    // Clean up the key
    let formattedKey = key.trim();
    
    // Replace escaped newlines with actual newlines
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    
    // Check if key has the right format
    if (!formattedKey.includes('-----BEGIN EC PRIVATE KEY-----')) {
        console.error('ERROR: This is not an EC private key!');
        return null;
    }
    
    // Ensure proper line breaks
    if (!formattedKey.includes('\n-----END EC PRIVATE KEY-----')) {
        const parts = formattedKey.split('-----');
        if (parts.length >= 3) {
            // Extract the key content (remove all whitespace)
            const keyContent = parts[2].replace(/\s+/g, '');
            // Reconstruct with proper formatting
            formattedKey = `-----BEGIN EC PRIVATE KEY-----\n${keyContent}\n-----END EC PRIVATE KEY-----`;
        }
    }
    
    return formattedKey;
}

// Format the key
const formattedKey = formatEcPrivateKey(privateKey);
console.log('\nFormatted private key:\n', formattedKey);

// Test if the key works with jwt.sign
try {
    const payload = {
        sub: 'test',
        iss: 'test',
        exp: Math.floor(Date.now() / 1000) + 60,
        nonce: uuidv4()
    };
    
    const token = jwt.sign(payload, formattedKey, { 
        algorithm: 'ES256',
        header: { alg: 'ES256', nonce: payload.nonce }
    });
    
    console.log('\nSUCCESS! The key works for JWT signing');
    console.log('Generated token:', token.substring(0, 30) + '...');
} catch (error) {
    console.error('\nERROR: Failed to sign JWT with this key');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
}

// Instructions for fixing the key
console.log('\n---------------------------------------------');
console.log('INSTRUCTIONS');
console.log('---------------------------------------------');
console.log('1. Make sure your private key is in EC format (not RSA)');
console.log('2. Key must include proper BEGIN and END markers');
console.log('3. The key should be formatted with newlines like this:');
console.log(`
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIHK4DIQ7kRwQ1...base64content...
-----END EC PRIVATE KEY-----
`);
console.log('4. When copying to the web form, copy the ENTIRE key including BEGIN and END lines');
console.log('---------------------------------------------'); 