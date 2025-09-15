/**
 * Jest Environment Setup
 * Sets environment variables before tests run
 */

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jest-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Disable external API calls during testing
process.env.DISABLE_EXTERNAL_APIS = 'true'
process.env.MOCK_BITCOIN_PRICE = 'true'
process.env.MOCK_EXCHANGE_RATES = 'true'

// Test-specific settings
process.env.TEST_TIMEOUT = '10000'
process.env.JEST_VERBOSE = 'false'

console.log('🧪 Jest test environment configured')
console.log('[DATA] Database URL:', process.env.DATABASE_URL)
console.log('[LOCK] NextAuth URL:', process.env.NEXTAUTH_URL) 