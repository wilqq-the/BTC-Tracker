#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function setupDevelopmentEnvironment() {
  console.log('[START] Setting up development environment...')

  try {
    // 1. Check if .env exists
    const envPath = path.join(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) {
      console.log('[WARN] No .env file found. Please create one with:')
      console.log('   NODE_ENV=development')
      console.log('   DATABASE_URL="file:./dev.db"')
      console.log('   NEXTAUTH_SECRET="your-secret-here"')
      console.log('   NEXTAUTH_URL="http://localhost:3000"')
      console.log('')
      console.log('Run: openssl rand -hex 32  to generate a secret')
      process.exit(1)
    }

    // 2. Run migrations (handles everything: client generation, migrations, safety checks)
    console.log('[SYNC] Setting up database...')
    execSync('node scripts/migrate.js', { stdio: 'inherit' })

    // 3. Seed database with default data
    console.log('[SEED] Seeding database with default data...')
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' })

    // 5. Trigger initial app setup via API call (after Next.js starts)
    console.log('[OK] Development environment setup complete!')
    console.log('')
    console.log('[INFO] Next steps:')
    console.log('   1. Run: npm run dev')
    console.log('   2. App will auto-initialize on first API call')
    console.log('   3. Visit: http://localhost:3000')
    console.log('')
    console.log('[TOOL] Development utilities:')
    console.log('   • Health check: http://localhost:3000/api/health')
    console.log('   • System status: http://localhost:3000/api/system/status')
    console.log('   • Manual init: curl -X POST http://localhost:3000/api/startup')

  } catch (error) {
    console.error('[ERROR] Error setting up development environment:', error.message)
    process.exit(1)
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDevelopmentEnvironment()
}

module.exports = { setupDevelopmentEnvironment } 