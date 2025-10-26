import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-helpers';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { SettingsService } from '@/lib/settings-service';

export interface BacktestParams {
  startDate: string;
  endDate?: string; // Default: today
  investmentAmount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  currency: string;
}

export interface BacktestResult {
  totalInvested: number;
  totalBtc: number;
  currentValue: number;
  roi: number;
  roiPercent: number;
  avgBuyPrice: number;
  purchaseCount: number;
  monthlyData: Array<{
    date: string;
    invested: number;
    btcBought: number;
    btcPrice: number;
    portfolioValue: number;
    cumulativeBtc: number;
    cumulativeInvested: number;
  }>;
  comparison: {
    lumpSumBtc: number;
    lumpSumValue: number;
    lumpSumRoi: number;
    lumpSumRoiPercent: number;
    dcaBenefit: number; // DCA value - Lump Sum value
    dcaBenefitPercent: number;
  };
  summary: {
    bestPurchasePrice: number;
    worstPurchasePrice: number;
    bestPurchaseDate: string;
    worstPurchaseDate: string;
    totalDays: number;
    averageInterval: number; // Days between purchases
  };
}

/**
 * POST /api/dca-backtest
 * 
 * Simulates historical DCA strategy using actual Bitcoin price data
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    try {
      const body: BacktestParams = await request.json();

      // Validate inputs
      if (!body.startDate || !body.investmentAmount || !body.frequency) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: startDate, investmentAmount, frequency'
        }, { status: 400 });
      }

      if (body.investmentAmount <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Investment amount must be positive'
        }, { status: 400 });
      }

      const startDate = new Date(body.startDate);
      const endDate = body.endDate ? new Date(body.endDate) : new Date();
      const investmentAmount = body.investmentAmount;
      const frequency = body.frequency;

      // Get user settings for currency
      const settings = await SettingsService.getSettings();
      const mainCurrency = body.currency || settings.currency.mainCurrency;

      // Get exchange rate if needed (convert investment to USD for historical lookup)
      const currencyToUsdRate = await ExchangeRateService.getExchangeRate(mainCurrency, 'USD');
      const investmentAmountUSD = investmentAmount * currencyToUsdRate;

      // Get current BTC price in USD for final value calculation
      const currentPriceRecord = await prisma.bitcoinCurrentPrice.findFirst({
        orderBy: { updatedAt: 'desc' }
      });
      const currentBtcPriceUSD = currentPriceRecord?.priceUsd || 100000;

      // Convert back to main currency
      const usdToMainRate = await ExchangeRateService.getExchangeRate('USD', mainCurrency);
      const currentBtcPrice = currentBtcPriceUSD * usdToMainRate;

      // Generate purchase dates based on frequency
      const purchaseDates: Date[] = [];
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        purchaseDates.push(new Date(currentDate));

        // Increment based on frequency
        switch (frequency) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'biweekly':
            currentDate.setDate(currentDate.getDate() + 14);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }
      }

      // Fetch historical prices for purchase dates
      const formattedDates = purchaseDates.map(d => d.toISOString().split('T')[0]);
      
      // Get all historical prices in the date range
      const historicalPrices = await prisma.bitcoinPriceHistory.findMany({
        where: {
          date: {
            gte: startDate.toISOString().split('T')[0],
            lte: endDate.toISOString().split('T')[0]
          }
        },
        orderBy: {
          date: 'asc'
        }
      });

      if (historicalPrices.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No historical price data available for the selected date range'
        }, { status: 400 });
      }

      // Helper function to find closest price for a date
      const findClosestPrice = (targetDate: Date): number => {
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // Try exact match first
        const exactMatch = historicalPrices.find(p => p.date === targetDateStr);
        if (exactMatch) return exactMatch.closeUsd;

        // Find closest date
        let closestPrice = historicalPrices[0].closeUsd;
        let minDiff = Math.abs(new Date(historicalPrices[0].date).getTime() - targetDate.getTime());

        for (const price of historicalPrices) {
          const diff = Math.abs(new Date(price.date).getTime() - targetDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestPrice = price.closeUsd;
          }
        }

        return closestPrice;
      };

      // Simulate DCA purchases
      const monthlyData = [];
      let totalBtc = 0;
      let totalInvested = 0;
      let bestPrice = Infinity;
      let worstPrice = 0;
      let bestDate = '';
      let worstDate = '';

      for (const purchaseDate of purchaseDates) {
        const btcPriceUSD = findClosestPrice(purchaseDate);
        const btcPriceMain = btcPriceUSD * usdToMainRate;
        const btcBought = investmentAmount / btcPriceMain;

        totalBtc += btcBought;
        totalInvested += investmentAmount;

        const portfolioValue = totalBtc * currentBtcPrice;

        // Track best/worst prices
        if (btcPriceMain < bestPrice) {
          bestPrice = btcPriceMain;
          bestDate = purchaseDate.toISOString().split('T')[0];
        }
        if (btcPriceMain > worstPrice) {
          worstPrice = btcPriceMain;
          worstDate = purchaseDate.toISOString().split('T')[0];
        }

        monthlyData.push({
          date: purchaseDate.toISOString().split('T')[0],
          invested: parseFloat(investmentAmount.toFixed(2)),
          btcBought: parseFloat(btcBought.toFixed(8)),
          btcPrice: parseFloat(btcPriceMain.toFixed(2)),
          portfolioValue: parseFloat(portfolioValue.toFixed(2)),
          cumulativeBtc: parseFloat(totalBtc.toFixed(8)),
          cumulativeInvested: parseFloat(totalInvested.toFixed(2))
        });
      }

      // Calculate final metrics
      const currentValue = totalBtc * currentBtcPrice;
      const roi = currentValue - totalInvested;
      const roiPercent = totalInvested > 0 ? (roi / totalInvested) * 100 : 0;
      const avgBuyPrice = totalInvested / totalBtc;

      // Calculate lump sum comparison (invest all at start date)
      const firstPriceUSD = findClosestPrice(startDate);
      const firstPriceMain = firstPriceUSD * usdToMainRate;
      const lumpSumBtc = totalInvested / firstPriceMain;
      const lumpSumValue = lumpSumBtc * currentBtcPrice;
      const lumpSumRoi = lumpSumValue - totalInvested;
      const lumpSumRoiPercent = totalInvested > 0 ? (lumpSumRoi / totalInvested) * 100 : 0;
      const dcaBenefit = currentValue - lumpSumValue;
      const dcaBenefitPercent = lumpSumValue > 0 ? (dcaBenefit / lumpSumValue) * 100 : 0;

      // Calculate summary stats
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const averageInterval = purchaseDates.length > 1 ? totalDays / (purchaseDates.length - 1) : 0;

      const result: BacktestResult = {
        totalInvested: parseFloat(totalInvested.toFixed(2)),
        totalBtc: parseFloat(totalBtc.toFixed(8)),
        currentValue: parseFloat(currentValue.toFixed(2)),
        roi: parseFloat(roi.toFixed(2)),
        roiPercent: parseFloat(roiPercent.toFixed(2)),
        avgBuyPrice: parseFloat(avgBuyPrice.toFixed(2)),
        purchaseCount: purchaseDates.length,
        monthlyData,
        comparison: {
          lumpSumBtc: parseFloat(lumpSumBtc.toFixed(8)),
          lumpSumValue: parseFloat(lumpSumValue.toFixed(2)),
          lumpSumRoi: parseFloat(lumpSumRoi.toFixed(2)),
          lumpSumRoiPercent: parseFloat(lumpSumRoiPercent.toFixed(2)),
          dcaBenefit: parseFloat(dcaBenefit.toFixed(2)),
          dcaBenefitPercent: parseFloat(dcaBenefitPercent.toFixed(2))
        },
        summary: {
          bestPurchasePrice: parseFloat(bestPrice.toFixed(2)),
          worstPurchasePrice: parseFloat(worstPrice.toFixed(2)),
          bestPurchaseDate: bestDate,
          worstPurchaseDate: worstDate,
          totalDays,
          averageInterval: parseFloat(averageInterval.toFixed(1))
        }
      };

      return NextResponse.json({
        success: true,
        data: result,
        currency: mainCurrency
      });

    } catch (error) {
      console.error('Error running DCA backtest:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to run DCA backtest'
      }, { status: 500 });
    }
  });
}


