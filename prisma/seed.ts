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
  console.log('🌱 Seeding database with default data...')

  try {
    // 1. Create default app settings
    console.log('📋 Creating default app settings...')
    await prisma.appSettings.upsert({
      where: { id: 1 },
      update: {}, // Don't update if exists
      create: {
        id: 1,
        settingsData: JSON.stringify(defaultSettings),
        version: defaultSettings.version,
      },
    })
    console.log('✅ Default app settings created')

    // 2. Initialize portfolio summary with defaults
    console.log('💼 Initializing portfolio summary...')
    await prisma.portfolioSummary.upsert({
      where: { id: 1 },
      update: {}, // Don't update if exists
      create: {
        id: 1,
        totalBtc: 0,
        totalTransactions: 0,
        totalInvested: 0,
        totalFees: 0,
        averageBuyPrice: 0,
        mainCurrency: 'USD',
        currentBtcPriceUsd: 0,
        currentPortfolioValue: 0,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        portfolioChange24h: 0,
        portfolioChange24hPercent: 0,
        secondaryCurrency: 'EUR',
        currentValueSecondary: 0,
      },
    })
    console.log('✅ Portfolio summary initialized')

    // 3. Create default custom currencies (common ones beyond the main supported list)
    console.log('💱 Creating default custom currencies...')
    const customCurrencies = [
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    ]

    for (const currency of customCurrencies) {
      await prisma.customCurrency.upsert({
        where: { code: currency.code },
        update: {}, // Don't update if exists
        create: currency,
      })
    }
    console.log(`✅ Created ${customCurrencies.length} default custom currencies`)

    console.log('🎉 Database seeding completed successfully!')
    console.log('')
    console.log('📊 Summary:')
    console.log('• Default application settings created')
    console.log('• Portfolio summary initialized')
    console.log('• Custom currencies added')
    console.log('')
    console.log('🚀 Your Bitcoin Tracker is ready for first use!')

  } catch (error) {
    console.error('❌ Error during database seeding:', error)
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