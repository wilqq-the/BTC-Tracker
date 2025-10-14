import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';
import { DCAAnalysisService } from '@/lib/dca-analysis-service';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { SettingsService } from '@/lib/settings-service';

/**
 * GET /api/goals/dca-analysis
 * 
 * Analyzes user's Dollar-Cost Averaging strategy performance
 * Returns comprehensive metrics, scores, and recommendations
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    try {
      // Get all user transactions
      const transactions = await prisma.bitcoinTransaction.findMany({
        where: {
          userId: userId
        },
        orderBy: {
          transactionDate: 'asc'
        }
      });

      // Get current BTC price (in USD)
      const currentPriceData = await BitcoinPriceService.getCurrentPrice();
      const currentBtcPriceUSD = currentPriceData?.price || 100000;

      // Get user settings for currency
      const settings = await SettingsService.getSettings();
      const mainCurrency = settings.currency.mainCurrency;

      // Convert BTC price to user's main currency
      const usdToMainRate = await ExchangeRateService.getExchangeRate('USD', mainCurrency);
      const currentBtcPrice = currentBtcPriceUSD * usdToMainRate;

      // Convert all transaction prices to main currency
      const transactionsWithConvertedPrices = await Promise.all(
        transactions.map(async (tx) => {
          // Get exchange rate from original currency to main currency
          const rate = await ExchangeRateService.getExchangeRate(tx.originalCurrency, mainCurrency);
          
          // Convert prices to main currency
          return {
            ...tx,
            originalPricePerBtc: tx.originalPricePerBtc * rate,
            originalTotalAmount: tx.originalTotalAmount * rate
          };
        })
      );

      // Run DCA analysis with converted prices
      const analysisResult = DCAAnalysisService.analyzeDCA(
        transactionsWithConvertedPrices as any,
        currentBtcPrice,
        mainCurrency
      );

      // Format response
      return NextResponse.json({
        success: true,
        data: {
          ...analysisResult,
          currency: mainCurrency,
          analysis_date: new Date().toISOString(),
          total_transactions: transactions.length,
          buy_transactions: transactions.filter(tx => tx.type === 'BUY').length,
          sell_transactions: transactions.filter(tx => tx.type === 'SELL').length
        }
      });

    } catch (error) {
      console.error('Error analyzing DCA strategy:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to analyze DCA strategy',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  });
}


