import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Default settings for clean deployment
const defaultSettings = {
  currency: {
    mainCurrency: 'USD',
    secondaryCurrency: 'EUR',
    supportedCurrencies: ['USD', 'EUR', 'PLN', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK'],
    autoUpdateRates: true,
    rateUpdateInterval: 4,
    fallbackToHardcodedRates: true,
  },
  priceData: {
    historicalDataPeriod: '1Y',
    intradayInterval: '1h',
    priceUpdateInterval: 5,
    liveUpdateInterval: 300,
    enableIntradayData: true,
    maxHistoricalDays: 730,
    dataRetentionDays: 365,
    maxIntradayDays: 7,
  },
  display: {
    theme: 'dark',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '24h',
    decimalPlaces: 8,
    currencyDecimalPlaces: 2,
    showSatoshis: true,
    compactNumbers: false,
  },
  notifications: {
    priceAlerts: false,
    priceThresholds: {
      high: 120000,
      low: 80000,
    },
    portfolioAlerts: false,
    portfolioThresholds: {
      profitPercent: 50,
      lossPercent: -20,
    },
    emailNotifications: false,
    pushNotifications: false,
  },
  version: '1.0.0',
}

async function main() {
  console.log('[SEED] Seeding database with default data...')

  try {
    // 1. Create default app settings (global, no user_id)
    console.log('[INFO] Creating default global app settings...')
    await prisma.appSettings.upsert({
      where: { id: 1 },
      update: {}, // Don't update if exists
      create: {
        id: 1,
        userId: null, // Global settings
        settingsData: JSON.stringify(defaultSettings),
        version: defaultSettings.version,
      },
    })
    console.log('[OK] Default global app settings created')

    // 2. Note: Portfolio summary is now user-specific, no global initialization needed
    console.log('[INFO] Portfolio summary will be created per-user when they first use the app')

    // 3. Create default custom currencies (global, no user_id - available to all users)
    console.log('[INFO] Creating default global custom currencies...')
    const customCurrencies = [
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', userId: null },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', userId: null },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$', userId: null },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', userId: null },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩', userId: null },
    ]

    for (const currency of customCurrencies) {
      await prisma.customCurrency.upsert({
        where: { 
          id: customCurrencies.indexOf(currency) + 1000 // Use high ID for globals
        },
        update: {}, // Don't update if exists
        create: {
          id: customCurrencies.indexOf(currency) + 1000,
          ...currency
        },
      })
    }
    console.log(`[OK] Created ${customCurrencies.length} default global custom currencies`)

    console.log('[SUCCESS] Database seeding completed successfully!')
    console.log('')
    console.log('[SUMMARY] Summary:')
    console.log('• Default global application settings created')
    console.log('• Global custom currencies added')
    console.log('• User-specific data (portfolio, settings) will be created per user')
    console.log('')
    console.log('[READY] Your multi-user Bitcoin Tracker is ready for first use!')

  } catch (error) {
    console.error('[ERROR] Error during database seeding:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 