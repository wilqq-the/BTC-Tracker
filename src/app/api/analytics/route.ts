import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '1Y';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch(range) {
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'ALL':
        startDate = new Date('2009-01-01'); // Bitcoin genesis
        break;
    }

    // Get ALL transactions for accurate holdings calculation
    const allTransactions = await prisma.bitcoinTransaction.findMany({
      orderBy: {
        transactionDate: 'asc'
      }
    });
    
    // Filter transactions for the selected range (for charts/analysis)
    const rangeTransactions = allTransactions.filter((tx: any) => 
      tx.transactionDate >= startDate
    );

    // Get current BTC price
    const currentPriceData = await BitcoinPriceService.getCurrentPrice();
    const currentPrice = currentPriceData?.price || 100000;
    
    // Get exchange rates for currency conversion
    const { ExchangeRateService } = await import('@/lib/exchange-rate-service');
    const { SettingsService } = await import('@/lib/settings-service');
    const settings = await SettingsService.getSettings();
    const mainCurrency = settings.currency.mainCurrency;

    // Calculate monthly breakdown
    const monthlyData = new Map<string, { 
      buys: number, 
      sells: number, 
      totalBought: number, 
      totalSold: number,
      avgBuyPrice: number,
      avgSellPrice: number,
      pnl: number,
      monthName: string
    }>();

    // Calculate statistics - use ALL transactions for accurate holdings
    const allBuyTransactions = allTransactions.filter((tx: any) => tx.type === 'BUY');
    const allSellTransactions = allTransactions.filter((tx: any) => tx.type === 'SELL');
    
    const totalBtcBought = allBuyTransactions.reduce((sum: number, tx: any) => sum + tx.btcAmount, 0);
    const totalBtcSold = allSellTransactions.reduce((sum: number, tx: any) => sum + tx.btcAmount, 0);
    const currentHoldings = totalBtcBought - totalBtcSold;
    
    // For period analysis, use filtered transactions
    const buyTransactions = rangeTransactions.filter((tx: any) => tx.type === 'BUY');
    const sellTransactions = rangeTransactions.filter((tx: any) => tx.type === 'SELL');
    
    // Get exchange rates for all currencies used in ALL transactions
    const uniqueCurrencies = Array.from(new Set(allTransactions.map(tx => tx.originalCurrency))) as string[];
    const exchangeRatePromises = uniqueCurrencies.map(currency => 
      ExchangeRateService.getExchangeRate(currency, mainCurrency).catch(() => 1.0)
    );
    const exchangeRates = await Promise.all(exchangeRatePromises);
    const currencyToRateMap = Object.fromEntries(
      uniqueCurrencies.map((currency, index) => [currency, exchangeRates[index]])
    );
    
    // Calculate invested and received amounts with currency conversion for ALL transactions
    let totalInvestedMain = 0;
    let weightedBuyPriceSum = 0;
    
    for (const tx of allBuyTransactions) {
      const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
      const mainCurrencyTotal = tx.originalTotalAmount * exchangeRate;
      const mainCurrencyPrice = tx.originalPricePerBtc * exchangeRate;
      
      totalInvestedMain += mainCurrencyTotal;
      weightedBuyPriceSum += mainCurrencyPrice * tx.btcAmount;
    }
    
    let totalReceivedMain = 0;
    let weightedSellPriceSum = 0;
    
    for (const tx of allSellTransactions) {
      const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
      const mainCurrencyTotal = tx.originalTotalAmount * exchangeRate;
      const mainCurrencyPrice = tx.originalPricePerBtc * exchangeRate;
      
      totalReceivedMain += mainCurrencyTotal;
      weightedSellPriceSum += mainCurrencyPrice * tx.btcAmount;
    }
    
    // Calculate weighted average prices based on ALL transactions
    const avgBuyPrice = totalBtcBought > 0 ? weightedBuyPriceSum / totalBtcBought : 0;
    const avgSellPrice = totalBtcSold > 0 ? weightedSellPriceSum / totalBtcSold : 0;
    
    // Now calculate monthly breakdown with converted prices (for range only)
    rangeTransactions.forEach((tx: any) => {
      const monthKey = tx.transactionDate.toISOString().substring(0, 7); // YYYY-MM
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
        // Weighted average for buy price
        data.avgBuyPrice = ((data.avgBuyPrice * (data.totalBought - tx.btcAmount)) + (convertedPrice * tx.btcAmount)) / data.totalBought;
      } else {
        data.sells++;
        data.totalSold += tx.btcAmount;
        // Weighted average for sell price
        data.avgSellPrice = ((data.avgSellPrice * (data.totalSold - tx.btcAmount)) + (convertedPrice * tx.btcAmount)) / data.totalSold;
        // Calculate realized P&L (sell price - avg buy price at that time)
        const sellValue = tx.btcAmount * convertedPrice;
        const costBasis = tx.btcAmount * avgBuyPrice; // Using overall avg buy price
        data.pnl += (sellValue - costBasis);
      }

      monthlyData.set(monthKey, data);
    });
    
    // Calculate P&L
    const currentValue = currentHoldings * currentPrice;
    const costBasis = currentHoldings * avgBuyPrice;
    const unrealizedPnL = currentValue - costBasis;
    const realizedPnL = totalReceivedMain - (totalBtcSold * avgBuyPrice);
    const totalPnL = unrealizedPnL + realizedPnL;
    
    // Calculate ROI and other metrics
    const roi = totalInvestedMain > 0 ? ((currentValue + totalReceivedMain - totalInvestedMain) / totalInvestedMain) * 100 : 0;
    
    // Calculate win rate using ALL sell transactions
    let winningTrades = 0;
    let losingTrades = 0;
    allSellTransactions.forEach((tx: any) => {
      // Find volume-weighted average buy price before this sell from ALL buy transactions
      const buysBeforeSell = allBuyTransactions.filter((b: any) => b.transactionDate < tx.transactionDate);
      
      let weightedPriceSum = 0;
      let totalVolume = 0;
      buysBeforeSell.forEach((b: any) => {
        weightedPriceSum += b.originalPricePerBtc * b.btcAmount;
        totalVolume += b.btcAmount;
      });
      
      const avgBuyBeforeSell = totalVolume > 0 ? weightedPriceSum / totalVolume : 0;
      
      if (tx.originalPricePerBtc > avgBuyBeforeSell) {
        winningTrades++;
      } else {
        losingTrades++;
      }
    });
    
    const winRate = (winningTrades + losingTrades) > 0 
      ? (winningTrades / (winningTrades + losingTrades)) * 100 
      : 0;

    // Find best and worst trades from ALL sell transactions
    let bestTrade = null;
    let worstTrade = null;
    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    
    allSellTransactions.forEach((tx: any) => {
      const buysBeforeSell = allBuyTransactions.filter((b: any) => b.transactionDate < tx.transactionDate);
      const avgBuyBeforeSell = buysBeforeSell.length > 0
        ? buysBeforeSell.reduce((sum: number, b: any) => sum + b.originalPricePerBtc, 0) / buysBeforeSell.length
        : 0;
      
      const profit = (tx.originalPricePerBtc - avgBuyBeforeSell) * tx.btcAmount;
      
      if (profit > maxProfit) {
        maxProfit = profit;
        bestTrade = {
          date: tx.transactionDate,
          amount: tx.btcAmount,
          profit: profit
        };
      }
      
      if (profit < maxLoss) {
        maxLoss = profit;
        worstTrade = {
          date: tx.transactionDate,
          amount: tx.btcAmount,
          profit: profit
        };
      }
    });

    // Calculate holding period (from ALL transactions)
    const oldestTransaction = allTransactions[0];
    const holdingDays = oldestTransaction 
      ? Math.floor((now.getTime() - oldestTransaction.transactionDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate annualized return (RoR)
    const years = holdingDays / 365;
    const annualizedReturn = years > 0 ? Math.pow(1 + (roi / 100), 1 / years) - 1 : 0;

    // Calculate Sharpe Ratio (simplified - using BTC volatility assumption)
    const riskFreeRate = 0.045; // 4.5% treasury rate
    const btcVolatility = 0.60; // 60% annual volatility (typical for BTC)
    const sharpeRatio = btcVolatility > 0 ? (annualizedReturn - riskFreeRate) / btcVolatility : 0;

    // Format monthly data for chart
    const monthlyBreakdown = Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      monthName: data.monthName,
      year: month.substring(0, 4),
      buys: data.buys,
      sells: data.sells,
      netBtc: data.totalBought - data.totalSold,
      pnl: data.pnl,
      performance: data.avgBuyPrice > 0 ? ((data.avgSellPrice - data.avgBuyPrice) / data.avgBuyPrice) * 100 : 0
    }));

    // Most active month
    const mostActiveMonth = monthlyBreakdown.reduce((max: any, month: any) => 
      (month.buys + month.sells) > (max.buys + max.sells) ? month : max
    , monthlyBreakdown[0] || { monthName: 'N/A', year: '' });

    // Largest purchase (from ALL buy transactions)
    const largestPurchase = allBuyTransactions.length > 0 
      ? allBuyTransactions.reduce((max: any, tx: any) => 
          tx.btcAmount > max.btcAmount ? tx : max
        )
      : null;

    return NextResponse.json({
      success: true,
      data: {
        // Key metrics
        avgBuyPrice,
        avgSellPrice,
        totalPnL,
        unrealizedPnL,
        realizedPnL,
        roi,
        annualizedReturn: annualizedReturn * 100,
        sharpeRatio,
        winRate,
        bestTrade,
        worstTrade,
        currentBtcPrice: currentPrice,
        
        // Monthly breakdown for chart
        monthlyBreakdown,
        
        // Statistics
        statistics: {
          totalTransactions: allTransactions.length,
          totalBuys: allBuyTransactions.length,
          totalSells: allSellTransactions.length,
          avgHoldTime: holdingDays,
          totalDaysHolding: holdingDays,
          mostActiveMonth: `${mostActiveMonth.monthName} ${mostActiveMonth.year}`,
          largestPurchase: largestPurchase ? largestPurchase.btcAmount : 0,
          avgBuyAmount: totalBtcBought / (allBuyTransactions.length || 1),
          currentHoldings,
          totalBtcBought,
          totalBtcSold
        },
        
        // Tax report calculation
        taxReport: (() => {
          let shortTermGains = 0;
          let longTermGains = 0;
          let totalFeesPaid = 0;
          
          allSellTransactions.forEach((sellTx: any) => {
            const sellDate = sellTx.transactionDate;
            const exchangeRate = currencyToRateMap[sellTx.originalCurrency] || 1.0;
            const sellPrice = sellTx.originalPricePerBtc * exchangeRate;
            
            // Find matching buy transactions (FIFO)
            let remainingToMatch = sellTx.btcAmount;
            
            for (const buyTx of allBuyTransactions) {
              if (buyTx.transactionDate >= sellDate || remainingToMatch <= 0) break;
              
              const buyExchangeRate = currencyToRateMap[buyTx.originalCurrency] || 1.0;
              const buyPrice = buyTx.originalPricePerBtc * buyExchangeRate;
              const matchAmount = Math.min(remainingToMatch, buyTx.btcAmount);
              
              const gain = (sellPrice - buyPrice) * matchAmount;
              const holdingPeriod = Math.floor((sellDate.getTime() - buyTx.transactionDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (holdingPeriod > 365) {
                longTermGains += gain;
              } else {
                shortTermGains += gain;
              }
              
              remainingToMatch -= matchAmount;
            }
            
            totalFeesPaid += sellTx.fees || 0;
          });
          
          allBuyTransactions.forEach((tx: any) => {
            totalFeesPaid += tx.fees || 0;
          });
          
          return {
            shortTermGains,
            longTermGains,
            totalTaxable: shortTermGains + longTermGains,
            totalFeesPaid
          };
        })()
      }
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate analytics' },
      { status: 500 }
    );
  }
}
