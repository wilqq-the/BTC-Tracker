import { BitcoinTransaction } from '@prisma/client';

/**
 * DCA Analysis Service
 * 
 * Analyzes user's Dollar-Cost Averaging strategy performance
 * Provides insights, scores, and recommendations based on transaction history
 */

export interface DCAScore {
  overall: number; // 0-10 scale
  timing: number; // 0-10
  consistency: number; // 0-10
  performance: number; // 0-10
}

export interface TimingAnalysis {
  btcBoughtBelowCurrent: number; // Percentage
  btcBoughtAboveCurrent: number; // Percentage
  bestPurchasePrice: number;
  worstPurchasePrice: number;
  bestPurchaseDate: Date;
  worstPurchaseDate: Date;
  avgPurchasePrice: number;
  currentPrice: number;
  priceImprovement: number; // Percentage
}

export interface ConsistencyAnalysis {
  avgDaysBetweenPurchases: number;
  consistency: number; // 0-100
  longestGap: number; // Days
  longestGapStart: Date | null;
  longestGapEnd: Date | null;
  recentActivity: number; // Purchases in last 30 days
  totalPurchases: number;
  missedMonths: number; // Months with no purchases
}

export interface PriceDistribution {
  range: string;
  btcAmount: number;
  percentage: number;
  transactions: number;
}

export interface WhatIfScenario {
  name: string;
  description: string;
  totalInvested: number;
  btcHoldings: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
  difference: number; // Compared to actual
}

export interface MonthlyBreakdown {
  month: string; // YYYY-MM
  totalInvested: number;
  btcPurchased: number;
  avgPrice: number;
  transactions: number;
  missed: boolean;
}

export interface Recommendation {
  type: 'success' | 'warning' | 'info' | 'tip';
  icon: string;
  message: string;
}

export interface DCAAnalysisResult {
  score: DCAScore;
  timing: TimingAnalysis;
  consistency: ConsistencyAnalysis;
  priceDistribution: PriceDistribution[];
  whatIfScenarios: WhatIfScenario[];
  monthlyBreakdown: MonthlyBreakdown[];
  recommendations: Recommendation[];
  summary: {
    totalInvested: number;
    totalBtc: number;
    avgBuyPrice: number;
    currentPrice: number;
    currentValue: number;
    totalPnL: number;
    totalPnLPercent: number;
  };
}

export class DCAAnalysisService {
  /**
   * Analyze user's DCA strategy performance
   */
  static analyzeDCA(
    transactions: BitcoinTransaction[],
    currentBtcPrice: number,
    mainCurrency: string = 'USD'
  ): DCAAnalysisResult {
    // Filter only BUY transactions
    const buyTransactions = transactions.filter(tx => tx.type === 'BUY');
    
    if (buyTransactions.length === 0) {
      return this.getEmptyAnalysis(currentBtcPrice);
    }

    // Calculate all components
    const timing = this.analyzeTiming(buyTransactions, currentBtcPrice);
    const consistency = this.analyzeConsistency(buyTransactions);
    const priceDistribution = this.calculatePriceDistribution(buyTransactions, currentBtcPrice);
    const whatIfScenarios = this.calculateWhatIfScenarios(buyTransactions, currentBtcPrice);
    const monthlyBreakdown = this.calculateMonthlyBreakdown(buyTransactions);
    const score = this.calculateDCAScore(timing, consistency, buyTransactions, currentBtcPrice);
    const recommendations = this.generateRecommendations(score, timing, consistency, buyTransactions);
    
    // Calculate summary
    const totalBtc = buyTransactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
    const totalInvested = buyTransactions.reduce((sum, tx) => sum + tx.originalTotalAmount, 0);
    const avgBuyPrice = totalInvested / totalBtc;
    const currentValue = totalBtc * currentBtcPrice;
    const totalPnL = currentValue - totalInvested;
    const totalPnLPercent = (totalPnL / totalInvested) * 100;

    return {
      score,
      timing,
      consistency,
      priceDistribution,
      whatIfScenarios,
      monthlyBreakdown,
      recommendations,
      summary: {
        totalInvested,
        totalBtc,
        avgBuyPrice,
        currentPrice: currentBtcPrice,
        currentValue,
        totalPnL,
        totalPnLPercent
      }
    };
  }

  /**
   * Analyze timing quality - did user buy dips or chase pumps?
   * Compares each purchase to the rolling 7-day average around that time
   */
  private static analyzeTiming(
    transactions: BitcoinTransaction[],
    currentPrice: number
  ): TimingAnalysis {
    let btcBelowCurrent = 0;
    let btcAboveCurrent = 0;
    let btcBelowLocalAverage = 0; // NEW: vs rolling average
    let btcAboveLocalAverage = 0; // NEW: vs rolling average
    let bestPrice = Infinity;
    let worstPrice = 0;
    let bestDate = transactions[0].transactionDate;
    let worstDate = transactions[0].transactionDate;
    let totalBtc = 0;
    let weightedPriceSum = 0;

    // Sort transactions by date for rolling average calculation
    const sortedTx = [...transactions].sort((a, b) => 
      a.transactionDate.getTime() - b.transactionDate.getTime()
    );

    // Calculate each purchase vs its 7-day rolling average
    sortedTx.forEach((tx, index) => {
      const price = tx.originalPricePerBtc;
      const btc = tx.btcAmount;
      const txDate = tx.transactionDate.getTime();
      
      totalBtc += btc;
      weightedPriceSum += price * btc;
      
      // Compare to current price (keep for reference)
      if (price < currentPrice) {
        btcBelowCurrent += btc;
      } else {
        btcAboveCurrent += btc;
      }
      
      // Calculate 7-day rolling average around this purchase
      // Look at purchases within ±7 days
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const nearbyPurchases = sortedTx.filter(t => {
        const timeDiff = Math.abs(t.transactionDate.getTime() - txDate);
        return timeDiff <= sevenDays;
      });
      
      // Calculate average price in this window
      const localAvgPrice = nearbyPurchases.reduce((sum, t) => 
        sum + t.originalPricePerBtc, 0
      ) / nearbyPurchases.length;
      
      // Did this purchase beat the local average?
      if (price < localAvgPrice) {
        btcBelowLocalAverage += btc;
      } else {
        btcAboveLocalAverage += btc;
      }
      
      // Track best/worst prices
      if (price < bestPrice) {
        bestPrice = price;
        bestDate = tx.transactionDate;
      }
      
      if (price > worstPrice) {
        worstPrice = price;
        worstDate = tx.transactionDate;
      }
    });

    const avgPrice = weightedPriceSum / totalBtc;
    const priceImprovement = ((currentPrice - avgPrice) / avgPrice) * 100;

    // NEW: Calculate timing quality based on LOCAL context, not current price
    const localTimingQuality = (btcBelowLocalAverage / totalBtc) * 100;

    return {
      btcBoughtBelowCurrent: localTimingQuality, // Use local average instead of current
      btcBoughtAboveCurrent: 100 - localTimingQuality,
      bestPurchasePrice: bestPrice,
      worstPurchasePrice: worstPrice,
      bestPurchaseDate: bestDate,
      worstPurchaseDate: worstDate,
      avgPurchasePrice: avgPrice,
      currentPrice,
      priceImprovement
    };
  }

  /**
   * Analyze investment consistency - FOR MONTHLY DCA STRATEGIES
   * Measures how consistently you invest each month, not daily intervals
   */
  private static analyzeConsistency(
    transactions: BitcoinTransaction[]
  ): ConsistencyAnalysis {
    if (transactions.length <= 1) {
      return {
        avgDaysBetweenPurchases: 0,
        consistency: 0,
        longestGap: 0,
        longestGapStart: null,
        longestGapEnd: null,
        recentActivity: transactions.length,
        totalPurchases: transactions.length,
        missedMonths: 0
      };
    }

    const sortedTx = [...transactions].sort((a, b) => 
      a.transactionDate.getTime() - b.transactionDate.getTime()
    );

    // Calculate gaps between purchases (for longest gap tracking)
    const gaps: number[] = [];
    let longestGap = 0;
    let longestGapStart: Date | null = null;
    let longestGapEnd: Date | null = null;

    for (let i = 1; i < sortedTx.length; i++) {
      const gap = Math.floor(
        (sortedTx[i].transactionDate.getTime() - sortedTx[i - 1].transactionDate.getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      gaps.push(gap);
      
      if (gap > longestGap) {
        longestGap = gap;
        longestGapStart = sortedTx[i - 1].transactionDate;
        longestGapEnd = sortedTx[i].transactionDate;
      }
    }

    const avgGap = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;

    // MONTHLY CONSISTENCY SCORING (better for DCA strategies)
    // Group transactions by month
    const monthlyActivity = new Map<string, number>();
    sortedTx.forEach(tx => {
      const monthKey = `${tx.transactionDate.getFullYear()}-${String(tx.transactionDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyActivity.set(monthKey, (monthlyActivity.get(monthKey) || 0) + 1);
    });

    // Calculate total months in range
    const firstTx = sortedTx[0];
    const lastTx = sortedTx[sortedTx.length - 1];
    const firstMonth = new Date(firstTx.transactionDate.getFullYear(), firstTx.transactionDate.getMonth(), 1);
    const lastMonth = new Date(lastTx.transactionDate.getFullYear(), lastTx.transactionDate.getMonth(), 1);
    
    let totalMonths = 0;
    let currentMonth = new Date(firstMonth);
    const allMonths: string[] = [];
    
    while (currentMonth <= lastMonth) {
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      allMonths.push(monthKey);
      totalMonths++;
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Count months with activity
    const activeMonths = allMonths.filter(month => monthlyActivity.has(month)).length;
    const missedMonths = totalMonths - activeMonths;

    // BASE SCORE: Monthly activity (70% weight)
    // 100% = bought every single month
    // 90% = missed 1 month in 10
    // 80% = missed 2 months in 10, etc.
    const monthlyActivityScore = totalMonths > 0 ? (activeMonths / totalMonths) * 100 : 0;

    // GAP PENALTY: Punish very long gaps (30% weight)
    // A gap of 1-2 months (30-60 days) is acceptable
    // A gap of 3+ months (90+ days) should reduce score
    let gapPenalty = 0;
    if (longestGap <= 45) {
      gapPenalty = 0; // No penalty for gaps ≤ 1.5 months
    } else if (longestGap <= 90) {
      gapPenalty = ((longestGap - 45) / 45) * 15; // Linear penalty 0-15% for 1.5-3 months
    } else {
      gapPenalty = 15 + Math.min(15, (longestGap - 90) / 30 * 5); // Up to 30% penalty for 3+ months
    }

    // COMBINED CONSISTENCY SCORE
    // 70% based on monthly activity, 30% penalty for long gaps
    const consistencyScore = Math.max(0, monthlyActivityScore - gapPenalty);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivity = transactions.filter(tx => tx.transactionDate >= thirtyDaysAgo).length;

    return {
      avgDaysBetweenPurchases: avgGap,
      consistency: Math.min(100, consistencyScore),
      longestGap,
      longestGapStart,
      longestGapEnd,
      recentActivity,
      totalPurchases: transactions.length,
      missedMonths
    };
  }

  /**
   * Calculate price distribution - how much BTC bought at different price levels
   */
  private static calculatePriceDistribution(
    transactions: BitcoinTransaction[],
    currentPrice: number
  ): PriceDistribution[] {
    // Find min and max prices
    const prices = transactions.map(tx => tx.originalPricePerBtc);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Create price ranges
    const ranges = this.createPriceRanges(minPrice, maxPrice, currentPrice);
    
    const totalBtc = transactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
    
    return ranges.map(range => {
      const txInRange = transactions.filter(tx => 
        tx.originalPricePerBtc >= range.min && tx.originalPricePerBtc < range.max
      );
      
      const btcAmount = txInRange.reduce((sum, tx) => sum + tx.btcAmount, 0);
      
      return {
        range: range.label,
        btcAmount,
        percentage: (btcAmount / totalBtc) * 100,
        transactions: txInRange.length
      };
    }).filter(d => d.btcAmount > 0);
  }

  /**
   * Create price ranges for distribution
   */
  private static createPriceRanges(minPrice: number, maxPrice: number, currentPrice: number): Array<{min: number, max: number, label: string}> {
    const priceRange = maxPrice - minPrice;
    const step = priceRange / 4; // 4 ranges
    
    return [
      { min: minPrice, max: minPrice + step, label: `${this.formatPrice(minPrice)}-${this.formatPrice(minPrice + step)}` },
      { min: minPrice + step, max: minPrice + step * 2, label: `${this.formatPrice(minPrice + step)}-${this.formatPrice(minPrice + step * 2)}` },
      { min: minPrice + step * 2, max: minPrice + step * 3, label: `${this.formatPrice(minPrice + step * 2)}-${this.formatPrice(minPrice + step * 3)}` },
      { min: minPrice + step * 3, max: maxPrice + 1, label: `${this.formatPrice(minPrice + step * 3)}+` }
    ];
  }

  /**
   * Calculate What-If scenarios
   */
  private static calculateWhatIfScenarios(
    transactions: BitcoinTransaction[],
    currentPrice: number
  ): WhatIfScenario[] {
    const totalInvested = transactions.reduce((sum, tx) => sum + tx.originalTotalAmount, 0);
    const totalBtc = transactions.reduce((sum, tx) => sum + tx.btcAmount, 0);
    const currentValue = totalBtc * currentPrice;
    
    // Actual DCA
    const actualPnL = currentValue - totalInvested;
    const actualPnLPercent = (actualPnL / totalInvested) * 100;

    // Scenario 1: Lump Sum at first purchase date
    const firstTx = transactions[0];
    const lumpSumBtc = totalInvested / firstTx.originalPricePerBtc;
    const lumpSumValue = lumpSumBtc * currentPrice;
    const lumpSumPnL = lumpSumValue - totalInvested;
    const lumpSumPnLPercent = (lumpSumPnL / totalInvested) * 100;

    // Scenario 2: Perfect Timing (lowest 3 prices)
    const sortedByPrice = [...transactions].sort((a, b) => a.originalPricePerBtc - b.originalPricePerBtc);
    const perfectBtc = totalInvested / sortedByPrice[0].originalPricePerBtc;
    const perfectValue = perfectBtc * currentPrice;
    const perfectPnL = perfectValue - totalInvested;
    const perfectPnLPercent = (perfectPnL / totalInvested) * 100;

    return [
      {
        name: 'Your DCA Strategy',
        description: 'Actual performance with your purchases',
        totalInvested,
        btcHoldings: totalBtc,
        currentValue,
        pnl: actualPnL,
        pnlPercentage: actualPnLPercent,
        difference: 0
      },
      {
        name: 'Lump Sum',
        description: `All money invested on ${firstTx.transactionDate.toLocaleDateString()}`,
        totalInvested,
        btcHoldings: lumpSumBtc,
        currentValue: lumpSumValue,
        pnl: lumpSumPnL,
        pnlPercentage: lumpSumPnLPercent,
        difference: lumpSumValue - currentValue
      },
      {
        name: 'Perfect Timing',
        description: 'All money invested at lowest price',
        totalInvested,
        btcHoldings: perfectBtc,
        currentValue: perfectValue,
        pnl: perfectPnL,
        pnlPercentage: perfectPnLPercent,
        difference: perfectValue - currentValue
      }
    ];
  }

  /**
   * Calculate monthly breakdown
   */
  private static calculateMonthlyBreakdown(
    transactions: BitcoinTransaction[]
  ): MonthlyBreakdown[] {
    const monthlyMap = new Map<string, {invested: number, btc: number, count: number, prices: number[]}>();
    
    transactions.forEach(tx => {
      const monthKey = `${tx.transactionDate.getFullYear()}-${String(tx.transactionDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {invested: 0, btc: 0, count: 0, prices: []});
      }
      
      const month = monthlyMap.get(monthKey)!;
      month.invested += tx.originalTotalAmount;
      month.btc += tx.btcAmount;
      month.count++;
      month.prices.push(tx.originalPricePerBtc);
    });

    // Fill in missing months
    if (transactions.length > 0) {
      const firstTx = transactions[0];
      const lastTx = transactions[transactions.length - 1];
      const current = new Date(firstTx.transactionDate);
      const end = new Date(lastTx.transactionDate);
      
      while (current <= end) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {invested: 0, btc: 0, count: 0, prices: []});
        }
        current.setMonth(current.getMonth() + 1);
      }
    }

    const breakdown = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        totalInvested: data.invested,
        btcPurchased: data.btc,
        avgPrice: data.btc > 0 ? data.invested / data.btc : 0,
        transactions: data.count,
        missed: data.count === 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return breakdown;
  }

  /**
   * Calculate overall DCA score
   */
  private static calculateDCAScore(
    timing: TimingAnalysis,
    consistency: ConsistencyAnalysis,
    transactions: BitcoinTransaction[],
    currentPrice: number
  ): DCAScore {
    // Timing score (0-10): Based on % bought below local average
    // This is MUCH more forgiving since it's comparing to rolling averages, not perfect timing
    // 50%+ below local avg = Perfect 10/10 (amazing timing)
    // 40% = 8.5/10 (excellent)
    // 30% = 7/10 (very good)
    // 20% = 5.5/10 (good)
    // 10% = 4/10 (okay)
    // 0% = 2.5/10 (neutral - buying at average)
    const belowPercent = timing.btcBoughtBelowCurrent;
    let timingScore: number;
    if (belowPercent >= 50) {
      timingScore = 10;
    } else if (belowPercent >= 40) {
      timingScore = 8.5 + ((belowPercent - 40) / 10) * 1.5; // 8.5 to 10
    } else if (belowPercent >= 30) {
      timingScore = 7 + ((belowPercent - 30) / 10) * 1.5; // 7 to 8.5
    } else if (belowPercent >= 20) {
      timingScore = 5.5 + ((belowPercent - 20) / 10) * 1.5; // 5.5 to 7
    } else if (belowPercent >= 10) {
      timingScore = 4 + ((belowPercent - 10) / 10) * 1.5; // 4 to 5.5
    } else {
      timingScore = 2.5 + (belowPercent / 10) * 1.5; // 2.5 to 4
    }

    // Consistency score (0-10): Based on consistency metric
    const consistencyScore = (consistency.consistency / 100) * 10;

    // Performance score (0-10): For HODLers - Cost Basis Quality
    // How much better is your avg buy price compared to current price
    // If you bought 50% below current: great (score ~8-10)
    // If you bought at current price: okay (score ~5)
    // If you bought above current: not ideal (score 0-4)
    const avgBuyPrice = timing.avgPurchasePrice;
    const discount = ((currentPrice - avgBuyPrice) / currentPrice) * 100; // % below current
    
    // Score formula for HODLers:
    // 50%+ discount = 10/10 (bought in major dip)
    // 25% discount = 7.5/10 (bought well)
    // 0% discount (at current) = 5/10 (neutral)
    // -25% premium = 2.5/10 (bought high)
    // -50%+ premium = 0/10 (bought at peak)
    let performanceScore: number;
    if (discount >= 50) {
      performanceScore = 10;
    } else if (discount >= 0) {
      // Linear from 5 (at current) to 10 (at 50% discount)
      performanceScore = 5 + (discount / 50) * 5;
    } else {
      // Linear from 5 (at current) to 0 (at -50% premium)
      performanceScore = Math.max(0, 5 + (discount / 50) * 5);
    }

    // Overall score: weighted average
    const overall = (
      timingScore * 0.4 +
      consistencyScore * 0.3 +
      performanceScore * 0.3
    );

    return {
      overall: Math.round(overall * 10) / 10,
      timing: Math.round(timingScore * 10) / 10,
      consistency: Math.round(consistencyScore * 10) / 10,
      performance: Math.round(performanceScore * 10) / 10
    };
  }

  /**
   * Generate personalized recommendations
   */
  private static generateRecommendations(
    score: DCAScore,
    timing: TimingAnalysis,
    consistency: ConsistencyAnalysis,
    transactions: BitcoinTransaction[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Overall performance
    if (score.overall >= 8) {
      recommendations.push({
        type: 'success',
        icon: '🎉',
        message: `Excellent DCA strategy! You're in the top tier with a ${score.overall}/10 score.`
      });
    } else if (score.overall >= 6) {
      recommendations.push({
        type: 'success',
        icon: '✅',
        message: `Good DCA strategy! Score: ${score.overall}/10. Keep it up!`
      });
    } else {
      recommendations.push({
        type: 'info',
        icon: '💡',
        message: `Your DCA score is ${score.overall}/10. There's room for improvement!`
      });
    }

    // Timing feedback (vs rolling average, not current price)
    if (timing.btcBoughtBelowCurrent >= 60) {
      recommendations.push({
        type: 'success',
        icon: '🎯',
        message: `Excellent timing! You bought ${timing.btcBoughtBelowCurrent.toFixed(0)}% of your BTC on dips (below 7-day average).`
      });
    } else if (timing.btcBoughtBelowCurrent >= 45) {
      recommendations.push({
        type: 'info',
        icon: '✅',
        message: `Good timing! ${timing.btcBoughtBelowCurrent.toFixed(0)}% bought on dips vs ${timing.btcBoughtAboveCurrent.toFixed(0)}% on pumps.`
      });
    } else if (timing.btcBoughtBelowCurrent < 35) {
      recommendations.push({
        type: 'tip',
        icon: '💡',
        message: `Try to buy dips! You bought ${timing.btcBoughtAboveCurrent.toFixed(0)}% during local pumps. Consider limit orders.`
      });
    }

    // Consistency feedback
    if (consistency.missedMonths > 3) {
      recommendations.push({
        type: 'warning',
        icon: '📅',
        message: `You missed ${consistency.missedMonths} months. Consider setting up automatic purchases!`
      });
    } else if (consistency.consistency >= 80) {
      recommendations.push({
        type: 'success',
        icon: '📊',
        message: `Excellent consistency! You're investing regularly with ${consistency.consistency.toFixed(0)}% regularity.`
      });
    }

    // Gap analysis
    if (consistency.longestGap > 60) {
      recommendations.push({
        type: 'warning',
        icon: '⏰',
        message: `Your longest gap was ${consistency.longestGap} days. Try to maintain regular investments.`
      });
    }

    // Cost basis quality (HODLer metric)
    const costBasisDiscount = ((timing.currentPrice - timing.avgPurchasePrice) / timing.currentPrice) * 100;
    if (costBasisDiscount > 30) {
      recommendations.push({
        type: 'success',
        icon: '💰',
        message: `Excellent cost basis! Your avg buy price is ${costBasisDiscount.toFixed(1)}% below current price.`
      });
    } else if (costBasisDiscount < -10) {
      recommendations.push({
        type: 'tip',
        icon: '📈',
        message: `Your avg buy price is ${Math.abs(costBasisDiscount).toFixed(1)}% above current. Keep HODLing and DCA-ing down!`
      });
    } else if (costBasisDiscount >= 0) {
      recommendations.push({
        type: 'success',
        icon: '✨',
        message: `You're in profit! Avg buy price is ${costBasisDiscount.toFixed(1)}% below current price.`
      });
    }
    
    // Performance score feedback
    if (score.performance >= 8) {
      recommendations.push({
        type: 'success',
        icon: '🏆',
        message: `Outstanding accumulation! Your cost basis quality is top-tier (${score.performance}/10).`
      });
    } else if (score.performance < 4) {
      recommendations.push({
        type: 'info',
        icon: '⏳',
        message: `Your average buy is above current price. Keep accumulating - time in market matters!`
      });
    }

    // Recent activity
    if (consistency.recentActivity === 0) {
      recommendations.push({
        type: 'tip',
        icon: '💡',
        message: `No purchases in the last 30 days. Consider resuming your DCA strategy!`
      });
    } else if (consistency.recentActivity >= 3) {
      recommendations.push({
        type: 'success',
        icon: '🔥',
        message: `Strong recent activity! ${consistency.recentActivity} purchases in the last 30 days.`
      });
    }

    return recommendations.slice(0, 5); // Max 5 recommendations
  }

  /**
   * Helper: Format price for display
   */
  private static formatPrice(price: number): string {
    if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}k`;
    }
    return `$${price.toFixed(0)}`;
  }

  /**
   * Empty analysis for users with no transactions
   */
  private static getEmptyAnalysis(currentPrice: number): DCAAnalysisResult {
    return {
      score: { overall: 0, timing: 0, consistency: 0, performance: 0 },
      timing: {
        btcBoughtBelowCurrent: 0,
        btcBoughtAboveCurrent: 0,
        bestPurchasePrice: 0,
        worstPurchasePrice: 0,
        bestPurchaseDate: new Date(),
        worstPurchaseDate: new Date(),
        avgPurchasePrice: 0,
        currentPrice,
        priceImprovement: 0
      },
      consistency: {
        avgDaysBetweenPurchases: 0,
        consistency: 0,
        longestGap: 0,
        longestGapStart: null,
        longestGapEnd: null,
        recentActivity: 0,
        totalPurchases: 0,
        missedMonths: 0
      },
      priceDistribution: [],
      whatIfScenarios: [],
      monthlyBreakdown: [],
      recommendations: [{
        type: 'info',
        icon: '💡',
        message: 'Start your DCA journey by making your first Bitcoin purchase!'
      }],
      summary: {
        totalInvested: 0,
        totalBtc: 0,
        avgBuyPrice: 0,
        currentPrice,
        currentValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0
      }
    };
  }
}

