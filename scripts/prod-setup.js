#!/usr/bin/env node

const { execSync } = require('child_process')

function setupProductionDatabase(options = {}) {
  const { skipSeed = false } = options

  console.log('🚀 Setting up production database...')

  try {
    // Generate Prisma client (essential for production)
    console.log('📋 Generating Prisma client...')
    execSync('npx prisma generate', { stdio: 'inherit' })

    // Deploy migrations (safe for production)
    console.log('🔄 Deploying database migrations...')
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })

    if (!skipSeed) {
      // Run seed for initial system data only (safe - uses upsert)
      console.log('🌱 Setting up initial system data...')
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })
    }

    console.log('\n🎉 Production database setup complete!')
    console.log('\n📋 Next steps:')
    console.log('   1. Verify database connection')
    console.log('   2. Start the application')
    console.log('   3. Monitor logs for any issues')

  } catch (error) {
    console.error('❌ Error setting up production database:', error.message)
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