import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinTransaction, TransactionFormData, TransactionSummary, TransactionResponse } from '@/lib/types';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { SettingsService } from '@/lib/settings-service';
import { withAuth } from '@/lib/auth-helpers';

// Enhanced transaction interface with secondary currency values
interface EnhancedTransaction extends BitcoinTransaction {
  // Secondary currency display values (calculated in real-time)
  secondary_currency: string;
  secondary_currency_price_per_btc: number;
  secondary_currency_total_amount: number;
  secondary_currency_current_value: number;
  secondary_currency_pnl: number;
}

// Helper function to get current Bitcoin price from our database
const getCurrentBitcoinPrice = async (): Promise<number> => {
  try {
    const priceData = await BitcoinPriceService.getCurrentPrice();
    // Handle null response
    if (!priceData || !priceData.price) {
      console.warn('No price data available, using fallback');
      return 100000; // Fallback price
    }
    return priceData.price;
  } catch (error) {
    console.error('Error getting current Bitcoin price:', error);
    return 100000; // Fallback price
  }
};

// Helper function to get exchange rate
const getExchangeRate = async (fromCurrency: string, toCurrency: string = 'USD'): Promise<number> => {
  if (fromCurrency === toCurrency) return 1.0;
  
  try {
    return await ExchangeRateService.getExchangeRate(fromCurrency, toCurrency);
  } catch (error) {
    console.error(`Error getting exchange rate ${fromCurrency} -> ${toCurrency}:`, error);
    
    // Fallback to hardcoded rates as last resort
    const fallbackRates: { [key: string]: number } = {
      'EUR': 1.05,
      'PLN': 0.25,
      'GBP': 1.27,
      'USD': 1.0
    };
    
    const rate = fallbackRates[fromCurrency] || 1.0;
    console.warn(`Using fallback exchange rate for ${fromCurrency}: ${rate}`);
    return rate;
  }
};

// GET - Fetch all transactions with optional filtering and pagination
export async function GET(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    // Get user's currency settings (TODO: Make user-specific)
    const settings = await SettingsService.getSettings();
    const mainCurrency = settings.currency.mainCurrency;
    const secondaryCurrency = settings.currency.secondaryCurrency;

    // Build Prisma where clause with user filter
    const whereClause: any = {
      userId: userId
    };

    // Apply filters
    if (type && type !== 'ALL') {
      whereClause.type = type;
    }

    if (dateFrom || dateTo) {
      whereClause.transactionDate = {};
      if (dateFrom) {
        whereClause.transactionDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.transactionDate.lte = new Date(dateTo);
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.bitcoinTransaction.count({
      where: whereClause
    });

    // Get transactions for this user only
    const transactions = await prisma.bitcoinTransaction.findMany({
      where: whereClause,
      orderBy: [
        { transactionDate: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset
    });

    // Convert Prisma results to match the expected format
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      type: tx.type as 'BUY' | 'SELL',
      transaction_date: tx.transactionDate.toISOString().split('T')[0], // Ensure date format
      btc_amount: tx.btcAmount,
      original_price_per_btc: tx.originalPricePerBtc,
      original_currency: tx.originalCurrency,
      original_total_amount: tx.originalTotalAmount,
      fees_currency: tx.feesCurrency,
      notes: tx.notes || '',
      tags: (tx as any).tags || '',
      created_at: tx.createdAt,
      updated_at: tx.updatedAt
    }));

    // Get current Bitcoin price and exchange rates for secondary currency calculations
    const currentBtcPriceUSD = await getCurrentBitcoinPrice(); // This is always in USD
    const usdToMainRate = await ExchangeRateService.getExchangeRate('USD', mainCurrency);
    const usdToSecondaryRate = await ExchangeRateService.getExchangeRate('USD', secondaryCurrency);
    
    // Convert BTC price to user's currencies
    const currentBtcPriceInMain = currentBtcPriceUSD * usdToMainRate;
    const currentBtcPriceInSecondary = currentBtcPriceUSD * usdToSecondaryRate;

    // Enhance transactions with dynamically calculated currency values
    const enhancedTransactions = await Promise.all(formattedTransactions.map(async (transaction) => {
      // Get exchange rates for this transaction's currency
      const originalToMainRate = await ExchangeRateService.getExchangeRate(transaction.original_currency, mainCurrency);
      const originalToSecondaryRate = await ExchangeRateService.getExchangeRate(transaction.original_currency, secondaryCurrency);
      
      // Calculate main currency values dynamically
      const mainCurrencyPrice = transaction.original_price_per_btc * originalToMainRate;
      const mainCurrencyTotal = transaction.original_total_amount * originalToMainRate;

      // Calculate secondary currency values dynamically
      const secondaryCurrencyPrice = transaction.original_price_per_btc * originalToSecondaryRate;
      const secondaryCurrencyTotal = transaction.original_total_amount * originalToSecondaryRate;
      
      // Calculate current value and P&L in both currencies (using pre-converted prices)
      
      const currentValueMain = transaction.btc_amount * currentBtcPriceInMain;
      const currentValueSecondary = transaction.btc_amount * currentBtcPriceInSecondary;
      
      const pnlMain = transaction.type === 'BUY' 
        ? currentValueMain - mainCurrencyTotal
        : mainCurrencyTotal - currentValueMain;
      const pnlSecondary = transaction.type === 'BUY'
        ? currentValueSecondary - secondaryCurrencyTotal
        : secondaryCurrencyTotal - currentValueSecondary;

      return {
        ...transaction,
        // Add dynamically calculated main currency values
        main_currency: mainCurrency,
        main_currency_price_per_btc: mainCurrencyPrice,
        main_currency_total_amount: mainCurrencyTotal,
        
        // Add dynamically calculated secondary currency values
        secondary_currency: secondaryCurrency,
        secondary_currency_price_per_btc: secondaryCurrencyPrice,
        secondary_currency_total_amount: secondaryCurrencyTotal,
        secondary_currency_current_value: currentValueSecondary,
        secondary_currency_pnl: pnlSecondary,
        
        // Add current values for convenience
        current_value_main: currentValueMain,
        pnl_main: pnlMain
      };
    }));

    // Calculate summary statistics for this user
    const summary = await calculateTransactionSummary(userId);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    const response: TransactionResponse = {
      success: true,
      data: enhancedTransactions as any, // Type assertion for compatibility
      summary,
      pagination: {
        total: totalCount,
        page: page,
        limit: limit,
        totalPages: totalPages
      },
      message: `Retrieved ${transactions.length} of ${totalCount} transactions with ${secondaryCurrency} display values`
    };

    return NextResponse.json(response);
  });
}

// POST - Create new transaction
export async function POST(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    const formData: TransactionFormData = await request.json();

    // Validate required fields
    if (!formData.type || !formData.btc_amount || !formData.price_per_btc || !formData.transaction_date) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'Type, BTC amount, price, and date are required'
      } as TransactionResponse, { status: 400 });
    }

    // Convert string values to numbers
    const btcAmount = parseFloat(formData.btc_amount);
    const pricePerBtc = parseFloat(formData.price_per_btc);
    const fees = parseFloat(formData.fees || '0');

    // Allow zero price for mining/gifts/airdrops (but not negative)
    if (isNaN(btcAmount) || isNaN(pricePerBtc) || btcAmount <= 0 || pricePerBtc < 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid numeric values',
        message: 'BTC amount must be positive, price cannot be negative'
      } as TransactionResponse, { status: 400 });
    }

    // Calculate original total amount
    const originalTotalAmount = btcAmount * pricePerBtc;

    // Insert transaction using Prisma - only store original data with user association
    const newTransaction = await prisma.bitcoinTransaction.create({
      data: {
        userId: userId,
        type: formData.type,
        btcAmount: btcAmount,
        originalPricePerBtc: pricePerBtc,
        originalCurrency: formData.currency,
        originalTotalAmount: originalTotalAmount,
        fees: fees,
        feesCurrency: formData.currency, // fees currency same as transaction currency
        transactionDate: new Date(formData.transaction_date),
        notes: formData.notes || '',
        tags: formData.tags || null
      } as any
    });

    // Format the transaction to match expected format
    const formattedTransaction = {
      ...newTransaction,
      type: newTransaction.type as 'BUY' | 'SELL',
      transaction_date: newTransaction.transactionDate.toISOString().split('T')[0],
      btc_amount: newTransaction.btcAmount,
      original_price_per_btc: newTransaction.originalPricePerBtc,
      original_currency: newTransaction.originalCurrency,
      original_total_amount: newTransaction.originalTotalAmount,
      fees_currency: newTransaction.feesCurrency,
      notes: newTransaction.notes || '',
      tags: (newTransaction as any).tags || '',
      created_at: newTransaction.createdAt,
      updated_at: newTransaction.updatedAt
    };

    // Recalculate portfolio after adding transaction (debounced to reduce I/O)
    try {
      await BitcoinPriceService.calculateAndStorePortfolioSummaryDebounced();
    } catch (portfolioError) {
      console.error('Error updating portfolio after transaction creation:', portfolioError);
      // Don't fail the transaction creation if portfolio update fails
    }

    const response: TransactionResponse = {
      success: true,
      data: formattedTransaction as any,
      message: 'Transaction created successfully'
    };

    return NextResponse.json(response, { status: 201 });
  });
}

// Helper function to calculate transaction summary
async function calculateTransactionSummary(userId: number): Promise<TransactionSummary> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get user's currency settings (TODO: Make user-specific)
      const settings = await SettingsService.getSettings();
      const mainCurrency = settings.currency.mainCurrency;

      // Get transaction statistics using Prisma aggregations for this user
      const [totalTransactions, buyTransactions, sellTransactions, allTransactions] = await Promise.all([
        prisma.bitcoinTransaction.count({ where: { userId } }),
        prisma.bitcoinTransaction.findMany({ where: { userId, type: 'BUY' } }),
        prisma.bitcoinTransaction.findMany({ where: { userId, type: 'SELL' } }),
        prisma.bitcoinTransaction.findMany({ where: { userId } })
      ]);

      const totalBtcBought = buyTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
      const totalBtcSold = sellTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
      const totalFeesPaid = allTransactions.reduce((sum, tx) => sum + tx.fees, 0);

      let totalInvested = 0;
      let totalReceived = 0;
      let weightedBuyPriceSum = 0;
      let weightedSellPriceSum = 0;

      // Calculate totals by converting each transaction to main currency
      for (const tx of allTransactions) {
        const exchangeRate = await ExchangeRateService.getExchangeRate(tx.originalCurrency, mainCurrency);
        const mainCurrencyTotal = tx.originalTotalAmount * exchangeRate;
        const mainCurrencyPrice = tx.originalPricePerBtc * exchangeRate;

        if (tx.type === 'BUY') {
          totalInvested += mainCurrencyTotal + (tx.fees || 0);
          // Volume-weighted average: sum of (price × volume)
          weightedBuyPriceSum += mainCurrencyPrice * tx.btcAmount;
        } else {
          totalReceived += mainCurrencyTotal - (tx.fees || 0);
          // Volume-weighted average: sum of (price × volume)
          weightedSellPriceSum += mainCurrencyPrice * tx.btcAmount;
        }
      }

      const currentBtcPrice = await getCurrentBitcoinPrice();
      const currentBtcHoldings = totalBtcBought - totalBtcSold;
      const currentValue = currentBtcHoldings * currentBtcPrice;
      
      // Calculate P&L
      const unrealizedPnl = currentValue - totalInvested + totalReceived;
      const totalPnl = unrealizedPnl;
      const roiPercentage = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

      const summary: TransactionSummary = {
        total_transactions: totalTransactions,
        total_buy_transactions: buyTransactions.length,
        total_sell_transactions: sellTransactions.length,
        total_btc_bought: totalBtcBought,
        total_btc_sold: totalBtcSold,
        current_btc_holdings: currentBtcHoldings,
        total_usd_invested: totalInvested,
        total_usd_received: totalReceived,
        total_fees_paid: totalFeesPaid,
        // Volume-weighted average prices
        average_buy_price: totalBtcBought > 0 ? weightedBuyPriceSum / totalBtcBought : 0,
        average_sell_price: totalBtcSold > 0 ? weightedSellPriceSum / totalBtcSold : 0,
        realized_pnl: 0, // Simplified for now
        unrealized_pnl: unrealizedPnl,
        total_pnl: totalPnl,
        roi_percentage: roiPercentage
      };

      resolve(summary);
    } catch (error) {
      reject(error);
    }
  });
} 