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
    
    // Separate buy, sell, and transfer transactions
    const buyTransactions = allTransactions.filter(tx => tx.type === 'BUY');
    const sellTransactions = allTransactions.filter(tx => tx.type === 'SELL');
    const transferTransactions = allTransactions.filter(tx => tx.type === 'TRANSFER');
    
    // Separate internal transfers (no balance change) from external transfers (change balance)
    // Support both legacy transferType and new transferCategory
    const internalTransfers = transferTransactions.filter(tx => 
      tx.transferCategory === 'INTERNAL' ||
      tx.transferType === 'TO_COLD_WALLET' || 
      tx.transferType === 'FROM_COLD_WALLET' || 
      tx.transferType === 'BETWEEN_WALLETS'
    );
    const transfersIn = transferTransactions.filter(tx => 
      tx.transferCategory === 'EXTERNAL_IN' || tx.transferType === 'TRANSFER_IN'
    );
    const transfersOut = transferTransactions.filter(tx => 
      tx.transferCategory === 'EXTERNAL_OUT' || tx.transferType === 'TRANSFER_OUT'
    );
    
    // Calculate BTC fees from transfer transactions
    // IMPORTANT: btcAmount = total LEAVING source wallet, fees = network fee
    // Amount arriving at destination = btcAmount - fees
    let totalFeesBTC = 0;
    
    for (const tx of internalTransfers) {
      // If fees are paid in BTC, reduce total holdings (burned, gone forever)
      if (tx.feesCurrency.toUpperCase() === 'BTC') {
        totalFeesBTC += tx.fees;
      }
    }
    
    // Handle external transfer fees
    for (const tx of [...transfersIn, ...transfersOut]) {
      if (tx.feesCurrency.toUpperCase() === 'BTC') {
        totalFeesBTC += tx.fees;
      }
    }
    
    // Calculate external transfer amounts (adds/removes from portfolio without affecting P&L)
    const totalBtcTransferredIn = transfersIn.reduce((sum, tx) => sum + tx.btcAmount, 0);
    const totalBtcTransferredOut = transfersOut.reduce((sum, tx) => sum + tx.btcAmount, 0);
    
    // Calculate total BTC (BUY - SELL + TRANSFER_IN - TRANSFER_OUT - BTC_FEES)
    const totalBtcBought = buyTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
    const totalBtcSold = sellTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
    const currentHoldings = totalBtcBought - totalBtcSold + totalBtcTransferredIn - totalBtcTransferredOut - totalFeesBTC;
    
    // Calculate hot/cold wallet distribution using new wallet-based system
    let hotWalletBTC = 0;
    let coldWalletBTC = 0;
    
    // Try to use new wallet-based calculation
    const userWallets = await prisma.wallet.findMany({
      where: { userId, includeInTotal: true }
    });
    
    if (userWallets.length > 0) {
      // New multi-wallet system: calculate per wallet
      for (const wallet of userWallets) {
        const incoming = await prisma.bitcoinTransaction.aggregate({
          where: { userId, destinationWalletId: wallet.id },
          _sum: { btcAmount: true }
        });
        const outgoing = await prisma.bitcoinTransaction.aggregate({
          where: { userId, sourceWalletId: wallet.id },
          _sum: { btcAmount: true }
        });
        const outgoingFees = await prisma.bitcoinTransaction.aggregate({
          where: { userId, sourceWalletId: wallet.id, feesCurrency: 'BTC' },
          _sum: { fees: true }
        });
        
        const walletBalance = (incoming._sum.btcAmount || 0) - (outgoing._sum.btcAmount || 0) - (outgoingFees._sum.fees || 0);
        
        if (wallet.temperature === 'COLD') {
          coldWalletBTC += Math.max(0, walletBalance);
        } else {
          hotWalletBTC += Math.max(0, walletBalance);
        }
      }
    } else {
      // Legacy fallback: use transferType-based calculation
      for (const tx of internalTransfers) {
        if (tx.transferType === 'TO_COLD_WALLET') {
          coldWalletBTC += (tx.btcAmount - tx.fees);
        } else if (tx.transferType === 'FROM_COLD_WALLET') {
          coldWalletBTC -= tx.btcAmount;
        }
      }
      hotWalletBTC = currentHoldings - coldWalletBTC;
    }
    
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
    let totalFeesMain = 0; // Total fees in main currency
    
    for (const tx of sellTransactions) {
      const exchangeRate = currencyToRateMap[tx.originalCurrency] || 1.0;
      const mainCurrencyTotal = tx.originalTotalAmount * exchangeRate;
      const mainCurrencyPrice = tx.originalPricePerBtc * exchangeRate;
      
      totalReceivedMain += mainCurrencyTotal;
      weightedSellPriceSum += mainCurrencyPrice * tx.btcAmount;
      
      // Add fees from sell transactions (convert to main currency)
      if (tx.fees && tx.feesCurrency && tx.feesCurrency.toUpperCase() !== 'BTC') {
        const feesExchangeRate = currencyToRateMap[tx.feesCurrency] || 1.0;
        totalFeesMain += tx.fees * feesExchangeRate;
      }
    }
    
    // Add fees from buy transactions (convert to main currency)
    for (const tx of buyTransactions) {
      if (tx.fees && tx.feesCurrency && tx.feesCurrency.toUpperCase() !== 'BTC') {
        const feesExchangeRate = currencyToRateMap[tx.feesCurrency] || 1.0;
        totalFeesMain += tx.fees * feesExchangeRate;
      }
    }
    
    // Add fees from transfer transactions (convert to main currency, excluding BTC fees which are already in totalFeesBTC)
    for (const tx of transferTransactions) {
      if (tx.fees && tx.feesCurrency && tx.feesCurrency.toUpperCase() !== 'BTC') {
        const feesExchangeRate = currencyToRateMap[tx.feesCurrency] || 1.0;
        totalFeesMain += tx.fees * feesExchangeRate;
      }
    }
    
    // Calculate weighted average prices
    const avgBuyPrice = totalBtcBought > 0 ? weightedBuyPriceSum / totalBtcBought : 0;
    const avgSellPrice = totalBtcSold > 0 ? weightedSellPriceSum / totalBtcSold : 0;
    
    // Calculate P&L
    // IMPORTANT: Only BUY transactions affect cost basis, not TRANSFER_IN
    // TRANSFER_IN/OUT change holdings but NOT P&L or cost basis
    const currentValue = currentHoldings * currentPrice;
    
    // Cost basis only for BTC acquired via BUY (not transferred in)
    // We need to track how much BTC came from buys vs transfers
    const btcFromBuys = totalBtcBought - totalBtcSold; // Net BTC from buy/sell activity
    const btcFromTransfers = totalBtcTransferredIn - totalBtcTransferredOut; // Net BTC from transfers
    
    // Cost basis applies only to BTC acquired via buys
    // If we have more holdings than bought (due to transfers in), only bought amount has cost basis
    const btcWithCostBasis = Math.max(0, Math.min(currentHoldings, btcFromBuys - totalFeesBTC));
    const costBasis = btcWithCostBasis * avgBuyPrice;
    
    // Unrealized P&L = current value of BTC with cost basis - cost basis
    // BTC from transfers has no cost basis, so it's "free" in P&L terms
    const valueOfBtcWithCostBasis = btcWithCostBasis * currentPrice;
    const unrealizedPnL = valueOfBtcWithCostBasis - costBasis;
    
    const realizedPnL = totalReceivedMain - (totalBtcSold * avgBuyPrice);
    const totalPnL = unrealizedPnL + realizedPnL;
    
    // Calculate ROI (based on invested amount only, transfers don't count as investment)
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
      coldWalletBtc: coldWalletBTC,
      hotWalletBtc: hotWalletBTC,
      
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
      
      // Fees tracking
      totalFeesBTC,
      totalFeesMain, // Total fees in main currency (from all transaction types)
      
      // 24h changes (calculated in real-time)
      portfolioChange24h,
      portfolioChange24hPercent,
      priceChange24h: currentPriceData?.priceChange24h || 0,
      priceChangePercent24h: currentPriceData?.priceChangePercent24h || 0,
      
      // Transaction counts
      totalTransactions: allTransactions.length,
      totalBuys: buyTransactions.length,
      totalSells: sellTransactions.length,
      totalTransfers: transferTransactions.length,
      totalTransfersIn: transfersIn.length,
      totalTransfersOut: transfersOut.length,
      totalInternalTransfers: internalTransfers.length,
      
      // BTC from transfers (for info display)
      totalBtcTransferredIn,
      totalBtcTransferredOut,
      
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
        totalBtcTransferredIn,
        totalBtcTransferredOut,
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
