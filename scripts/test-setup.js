#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('[TEST] Setting up test environment...')

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jest-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

try {
  // Remove existing test database
  const testDbPath = path.join(process.cwd(), 'test.db')
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
    console.log('[CLEAN] Removed existing test database')
  }

  // Generate Prisma client for test environment (only once)
  console.log('[PRISMA] Generating Prisma client for tests...')
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    env: process.env
  })

  // Create test database schema (skip generation since we just did it)
  console.log('[DB] Creating test database schema...')
  execSync('npx prisma db push --force-reset --skip-generate', { 
    stdio: 'inherit',
    env: process.env
  })

  console.log('[OK] Test environment setup completed successfully!')

} catch (error) {
  console.error('[ERROR] Test setup failed:', error.message)
  process.exit(1)
}
