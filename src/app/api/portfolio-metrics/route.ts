import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { SettingsService } from '@/lib/settings-service';
import { withAuth } from '@/lib/auth-helpers';

// Unified portfolio metrics that can be used by both sidebar and analytics
export async function GET(request: NextRequest) {
  return withAuth(request, async (userId, user) => {
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get('detailed') === 'true'; // Include analytics data
    
    // Get all transactions for this user
    const allTransactions = await prisma.bitcoinTransaction.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        transactionDate: 'asc'
      }
    });
    
    // Get current BTC price (always in USD)
    const currentPriceData = await BitcoinPriceService.getCurrentPrice();
    const currentPriceUSD = currentPriceData?.price || 100000;
    
    // Get user settings (TODO: Make this user-specific)
    const settings = await SettingsService.getSettings();
    const mainCurrency = settings.currency.mainCurrency;
    const secondaryCurrency = settings.currency.secondaryCurrency;
    
    // Convert BTC price from USD to main currency
    const usdToMainRate = await ExchangeRateService.getExchangeRate('USD', mainCurrency);
    const currentPrice = currentPriceUSD * usdToMainRate;
    
    // Separate buy and sell transactions
    const buyTransactions = allTransactions.filter(tx => tx.type === 'BUY');
    const sellTransactions = allTransactions.filter(tx => tx.type === 'SELL');
    
    // Calculate total BTC
    const totalBtcBought = buyTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
    const totalBtcSold = sellTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
    const currentHoldings = totalBtcBought - totalBtcSold;
    
    // Get exchange rates for all currencies
    const uniqueCurrencies = Array.from(new Set(allTransactions.map(tx => tx.originalCurrency))) as string[];
    const exchangeRatePromises = uniqueCurrencies.map(currency => 
      ExchangeRateService.getExchangeRate(currency, mainCurrency).catch(() => 1.0)
    );
    const exchangeRates = await Promise.all(exchangeRatePromises);
    const currencyToRateMap = Object.fromEntries(
      uniqueCurrencies.map((currency, index) => [currency, exchangeRates[index]])
    );
    
    // Calculate invested amounts and average prices
    let totalInvestedMain = 0;
    let weightedBuyPriceSum = 0;
    
    for (const tx of buyTransactions) {
      const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
      const mainCurrencyTotal = tx.originalTotalAmount * exchangeRate;
      const mainCurrencyPrice = tx.originalPricePerBtc * exchangeRate;
      
      totalInvestedMain += mainCurrencyTotal;
      weightedBuyPriceSum += mainCurrencyPrice * tx.btcAmount;
    }
    
    let totalReceivedMain = 0;
    let weightedSellPriceSum = 0;
    
    for (const tx of sellTransactions) {
      const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
      const mainCurrencyTotal = tx.originalTotalAmount * exchangeRate;
      const mainCurrencyPrice = tx.originalPricePerBtc * exchangeRate;
      
      totalReceivedMain += mainCurrencyTotal;
      weightedSellPriceSum += mainCurrencyPrice * tx.btcAmount;
    }
    
    // Calculate weighted average prices
    const avgBuyPrice = totalBtcBought > 0 ? weightedBuyPriceSum / totalBtcBought : 0;
    const avgSellPrice = totalBtcSold > 0 ? weightedSellPriceSum / totalBtcSold : 0;
    
    // Calculate P&L
    const currentValue = currentHoldings * currentPrice;
    const costBasis = currentHoldings * avgBuyPrice;
    const unrealizedPnL = currentValue - costBasis;
    const realizedPnL = totalReceivedMain - (totalBtcSold * avgBuyPrice);
    const totalPnL = unrealizedPnL + realizedPnL;
    
    // Calculate ROI
    const roi = totalInvestedMain > 0 ? ((currentValue + totalReceivedMain - totalInvestedMain) / totalInvestedMain) * 100 : 0;
    
    // Calculate 24h portfolio change based on BTC price change
    let portfolioChange24h = 0;
    let portfolioChange24hPercent = 0;
    
    if (currentPriceData?.priceChange24h && currentHoldings > 0) {
      // Calculate the portfolio value change based on BTC price change
      const btcPriceChange24hInMain = currentPriceData.priceChange24h * usdToMainRate;
      portfolioChange24h = currentHoldings * btcPriceChange24hInMain;
      
      // Calculate percentage based on portfolio value 24h ago
      const portfolioValue24hAgo = currentValue - portfolioChange24h;
      portfolioChange24hPercent = portfolioValue24hAgo > 0 ? (portfolioChange24h / portfolioValue24hAgo) * 100 : 0;
    }
    
    // Get stored portfolio summary for this user (for future use)
    const portfolioSummary = await prisma.portfolioSummary.findUnique({
      where: { userId: userId }
    });
    
    // Base metrics (always returned)
    const baseMetrics = {
      // Holdings
      totalBtc: currentHoldings,
      totalSatoshis: Math.round(currentHoldings * 100000000),
      
      // Current values (in main currency)
      currentBtcPrice: currentPrice, // BTC price in main currency
      portfolioValue: currentValue, // Portfolio value in main currency
      
      // Average prices
      avgBuyPrice,
      avgSellPrice,
      
      // P&L
      unrealizedPnL,
      realizedPnL,
      totalPnL,
      roi,
      
      // Investment tracking
      totalInvested: totalInvestedMain,
      totalReceived: totalReceivedMain,
      
      // 24h changes (calculated in real-time)
      portfolioChange24h,
      portfolioChange24hPercent,
      priceChange24h: currentPriceData?.priceChange24h || 0,
      priceChangePercent24h: currentPriceData?.priceChangePercent24h || 0,
      
      // Transaction counts
      totalTransactions: allTransactions.length,
      totalBuys: buyTransactions.length,
      totalSells: sellTransactions.length,
      
      // Currency info
      mainCurrency,
      secondaryCurrency,
      
      // Timestamp
      lastUpdated: new Date().toISOString()
    };
    
    // If detailed=true, include analytics data
    if (detailed) {
      // Calculate monthly breakdown
      const monthlyData = new Map<string, any>();
      
      allTransactions.forEach(tx => {
        const monthKey = tx.transactionDate.toISOString().substring(0, 7);
        const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
        const convertedPrice = tx.originalPricePerBtc * exchangeRate;
        
        const data = monthlyData.get(monthKey) || {
          buys: 0,
          sells: 0,
          totalBought: 0,
          totalSold: 0,
          avgBuyPrice: 0,
          avgSellPrice: 0,
          pnl: 0,
          monthName: new Date(tx.transactionDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        };
        
        if (tx.type === 'BUY') {
          data.buys++;
          data.totalBought += tx.btcAmount;
          data.avgBuyPrice = ((data.avgBuyPrice * (data.totalBought - tx.btcAmount)) + (convertedPrice * tx.btcAmount)) / data.totalBought;
        } else {
          data.sells++;
          data.totalSold += tx.btcAmount;
          data.avgSellPrice = ((data.avgSellPrice * (data.totalSold - tx.btcAmount)) + (convertedPrice * tx.btcAmount)) / data.totalSold;
          const sellValue = tx.btcAmount * convertedPrice;
          const costBasis = tx.btcAmount * avgBuyPrice;
          data.pnl += (sellValue - costBasis);
        }
        
        monthlyData.set(monthKey, data);
      });
      
      const monthlyBreakdown = Array.from(monthlyData.entries()).map(([month, data]) => ({
        month,
        ...data,
        netBtc: data.totalBought - data.totalSold
      }));
      
      // Calculate additional analytics
      const oldestTransaction = allTransactions[0];
      const now = new Date();
      const holdingDays = oldestTransaction 
        ? Math.floor((now.getTime() - oldestTransaction.transactionDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      const years = holdingDays / 365;
      const annualizedReturn = years > 0 ? (Math.pow(1 + (roi / 100), 1 / years) - 1) * 100 : 0;
      
      // Win rate calculation
      let winningTrades = 0;
      let losingTrades = 0;
      
      sellTransactions.forEach(tx => {
        const buysBeforeSell = buyTransactions.filter(b => b.transactionDate < tx.transactionDate);
        const avgBuyBeforeSell = buysBeforeSell.length > 0
          ? buysBeforeSell.reduce((sum, b) => {
              const rate = currencyToRateMap[b.originalCurrency] || 1.0;
              return sum + (b.originalPricePerBtc * rate);
            }, 0) / buysBeforeSell.length
          : 0;
        
        const sellRate = currencyToRateMap[tx.originalCurrency] || 1.0;
        const sellPrice = tx.originalPricePerBtc * sellRate;
        
        if (sellPrice > avgBuyBeforeSell) {
          winningTrades++;
        } else {
          losingTrades++;
        }
      });
      
      const winRate = (winningTrades + losingTrades) > 0 
        ? (winningTrades / (winningTrades + losingTrades)) * 100 
        : 0;
      
      return NextResponse.json({
        success: true,
        data: {
          ...baseMetrics,
          
          // Additional analytics
          monthlyBreakdown,
          annualizedReturn,
          winRate,
          winningTrades,
          losingTrades,
          holdingDays,
          
          // Additional stats
          totalBtcBought,
          totalBtcSold,
          largestPurchase: buyTransactions.reduce((max, tx) => 
            tx.btcAmount > (max?.btcAmount || 0) ? tx : max, 
            buyTransactions[0]
          )?.btcAmount || 0,
          avgBuyAmount: totalBtcBought / (buyTransactions.length || 1)
        }
      });
    }
    
    // Return base metrics only
    return NextResponse.json({
      success: true,
      data: baseMetrics
    });
  });
}
