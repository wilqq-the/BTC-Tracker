#!/usr/bin/env node

const { execSync } = require('child_process')

function setupProductionDatabase(options = {}) {
  const { skipSeed = false } = options

  console.log('[START] Setting up production database...')

  try {
    // Run migrations (handles legacy DBs, generates client)
    console.log('[SYNC] Running database migrations...')
    execSync('node scripts/migrate.js', { stdio: 'inherit' })

    if (!skipSeed) {
      // Run seed for initial system data only (safe - uses upsert)
      console.log('[SEED] Setting up initial system data...')
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
    }

    console.log('\n[SUCCESS] Production database setup complete!')
    console.log('\n[INFO] Next steps:')
    console.log('   1. Verify database connection')
    console.log('   2. Start the application')
    console.log('   3. Monitor logs for any issues')

  } catch (error) {
    console.error('[ERROR] Error setting up production database:', error.message)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {}

args.forEach(arg => {
  if (arg === '--skip-seed') {
    options.skipSeed = true
  }
})

// Run the setup
setupProductionDatabase(options) 