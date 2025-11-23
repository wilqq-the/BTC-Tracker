#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Default database path
const DEFAULT_DB_PATH = 'bitcoin-tracker.db'

function resetDatabase(options = {}) {
  const { seed = true, dbPath = DEFAULT_DB_PATH } = options

  console.log('[RESET] Resetting database to clean deployment state...')

  try {
    // Remove existing database file if it exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
      console.log(`[OK] Removed existing database file: ${dbPath}`)
    } else {
      console.log(`[INFO] Database file doesn't exist: ${dbPath}`)
    }

    // Push the schema to create fresh database
    console.log('[INFO] Creating fresh database schema...')
    execSync('npm exec prisma db push --force-reset', { stdio: 'inherit' })

    if (seed) {
      // Run the seed script
      console.log('[SEED] Setting up clean deployment data...')
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
    }

    console.log('\n[SUCCESS] Clean deployment setup complete!')
    
    if (seed) {
      console.log('\n[INFO] Ready for testing!')
      console.log('   1. Start the dev server: npm run dev')
      console.log('   2. Navigate to /auth/signup to register your first user')
      console.log('   3. Test the complete auth flow from scratch')
      console.log('   4. Test login/logout functionality')
    }

  } catch (error) {
    console.error('[ERROR] Error resetting database:', error.message)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {}

args.forEach(arg => {
  if (arg === '--no-seed') {
    options.seed = false
  } else if (arg.startsWith('--db-path=')) {
    options.dbPath = arg.replace('--db-path=', '')
  }
})

// Run the reset
resetDatabase(options) 