import { prisma } from './prisma';

/**
 * Bitcoin Price Projection Service
 * 
 * Calculates growth rate scenarios based on:
 * 1. Industry standard projections
 * 2. Historical Bitcoin price data analysis
 * 3. Rolling averages (1yr, 2yr, 4yr cycles)
 */

export interface PriceScenario {
  id: string;
  name: string;
  icon: string;
  description: string;
  annualGrowthRate: number; // e.g., 0.40 = 40% growth
  color: string;
  basis: string; // How this rate was calculated
}

export interface MonthlyProjection {
  month: number;
  projectedPrice: number;
  btcToBuy: number;
  fiatNeeded: number;
}

export interface ScenarioCalculation {
  scenario: PriceScenario;
  monthlyProjections: MonthlyProjection[];
  totalFiatNeeded: number;
  averageMonthlyFiat: number;
  finalProjectedPrice: number;
  totalBtcNeeded: number;
}

export class BTCProjectionService {
  
  /**
   * Get all 5 price scenarios with hybrid calculation
   */
  static async getScenarios(): Promise<PriceScenario[]> {
    // Get historical growth rates
    const historicalRates = await this.calculateHistoricalGrowthRates();
    
    return [
      {
        id: 'bear',
        name: 'Bear Market',
        icon: '🐻',
        description: 'Pessimistic scenario with price decline',
        annualGrowthRate: -0.30, // -30% per year
        color: 'text-red-600 dark:text-red-400',
        basis: 'Historical bear markets: -30% to -80%'
      },
      {
        id: 'conservative',
        name: 'Conservative',
        icon: '📉',
        description: 'Modest growth, safe planning',
        annualGrowthRate: historicalRates.conservative || 0.10, // +10% per year
        color: 'text-orange-600 dark:text-orange-400',
        basis: historicalRates.conservative 
          ? `Lowest historical growth (capped at 15%)` 
          : 'Industry standard: +10%/yr'
      },
      {
        id: 'stable',
        name: 'Stable',
        icon: '📊',
        description: 'Current price holds steady',
        annualGrowthRate: 0.00, // 0% (flat)
        color: 'text-gray-600 dark:text-gray-400',
        basis: 'Current market price baseline'
      },
      {
        id: 'moderate',
        name: 'Moderate Growth',
        icon: '📈',
        description: 'Typical bull cycle growth',
        annualGrowthRate: historicalRates.moderate || 0.40, // +40% per year
        color: 'text-blue-600 dark:text-blue-400',
        basis: historicalRates.moderate 
          ? `2-year rolling average (capped at 60%)` 
          : 'Industry standard: +40%/yr'
      },
      {
        id: 'bull',
        name: 'Bull Market',
        icon: '🚀',
        description: 'Aggressive growth scenario',
        annualGrowthRate: historicalRates.bull || 1.00, // +100% per year
        color: 'text-green-600 dark:text-green-400',
        basis: historicalRates.bull 
          ? `4-year cycle average (capped at 150%)` 
          : 'Bull market average: +100%/yr'
      },
      {
        id: 'custom',
        name: 'Custom',
        icon: '⚙️',
        description: 'Set your own growth rate',
        annualGrowthRate: 0.00, // Will be set by user
        color: 'text-purple-600 dark:text-purple-400',
        basis: 'User-defined growth rate'
      }
    ];
  }
  
  /**
   * Calculate historical growth rates from our database
   */
  static async calculateHistoricalGrowthRates(): Promise<{
    conservative: number | null;
    moderate: number | null;
    bull: number | null;
  }> {
    try {
      // Get historical prices from 4 years ago to now
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
      
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const today = new Date();
      
      // Format dates as YYYY-MM-DD
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      // Get prices for these dates (or closest available)
      const prices = await prisma.bitcoinPriceHistory.findMany({
        where: {
          date: {
            in: [
              formatDate(fourYearsAgo),
              formatDate(twoYearsAgo),
              formatDate(oneYearAgo),
              formatDate(today)
            ]
          }
        },
        orderBy: {
          date: 'asc'
        }
      });
      
      // If we don't have enough historical data, return null
      if (prices.length < 2) {
        console.log('Insufficient historical data for growth rate calculation');
        return { conservative: null, moderate: null, bull: null };
      }
      
      // Get most recent price
      const currentPrice = await this.getMostRecentPrice();
      
      // Calculate growth rates
      const calculateAnnualGrowth = (oldPrice: number, newPrice: number, years: number): number => {
        if (oldPrice <= 0 || years <= 0) return 0;
        // Compound annual growth rate (CAGR): ((endValue/startValue)^(1/years)) - 1
        return Math.pow(newPrice / oldPrice, 1 / years) - 1;
      };
      
      // Find closest prices to our target dates
      const getClosestPrice = (targetDateStr: string): number | null => {
        const price = prices.find(p => p.date === targetDateStr);
        return price ? price.closeUsd : null;
      };
      
      const price4y = getClosestPrice(formatDate(fourYearsAgo));
      const price2y = getClosestPrice(formatDate(twoYearsAgo));
      const price1y = getClosestPrice(formatDate(oneYearAgo));
      
      // Calculate raw historical growth rates
      const growth1y = price1y ? calculateAnnualGrowth(price1y, currentPrice, 1) : null;
      const growth2y = price2y ? calculateAnnualGrowth(price2y, currentPrice, 2) : null;
      const growth4y = price4y ? calculateAnnualGrowth(price4y, currentPrice, 4) : null;
      
      // Apply reasonable caps and use most conservative available data
      // Conservative: Use the LOWEST available growth, capped at 15%
      let conservative: number | null = null;
      if (growth1y !== null || growth2y !== null || growth4y !== null) {
        const availableGrowths = [growth1y, growth2y, growth4y].filter(g => g !== null) as number[];
        conservative = Math.min(...availableGrowths, 0.15); // Cap at 15%
      }
      
      // Moderate: Use 2yr average (medium-term trend), capped at 60%
      let moderate: number | null = growth2y;
      if (moderate !== null) {
        moderate = Math.min(moderate, 0.60); // Cap at 60%
      } else if (growth4y !== null) {
        moderate = Math.min(growth4y, 0.60); // Fallback to 4yr if 2yr unavailable
      }
      
      // Bull: Use HIGHEST available growth (most optimistic), capped at 150%
      let bull: number | null = null;
      if (growth1y !== null || growth2y !== null || growth4y !== null) {
        const availableGrowths = [growth1y, growth2y, growth4y].filter(g => g !== null) as number[];
        bull = Math.min(Math.max(...availableGrowths), 1.50); // Use MAX, cap at 150%
      }
      
      return {
        conservative,
        moderate,
        bull
      };
      
    } catch (error) {
      console.error('Error calculating historical growth rates:', error);
      return { conservative: null, moderate: null, bull: null };
    }
  }
  
  /**
   * Get most recent BTC price from database
   */
  static async getMostRecentPrice(): Promise<number> {
    try {
      // Try to get from current price table
      const currentPrice = await prisma.bitcoinCurrentPrice.findFirst({
        orderBy: { updatedAt: 'desc' }
      });
      
      if (currentPrice) {
        return currentPrice.priceUsd;
      }
      
      // Fallback to historical data
      const historicalPrice = await prisma.bitcoinPriceHistory.findFirst({
        orderBy: { date: 'desc' }
      });
      
      return historicalPrice?.closeUsd || 100000; // Default fallback
    } catch (error) {
      console.error('Error getting most recent price:', error);
      return 100000;
    }
  }
  
  /**
   * Calculate DCA projections for a specific scenario
   */
  static calculateScenarioProjection(
    scenario: PriceScenario,
    currentBtcPrice: number,
    btcNeeded: number,
    totalMonths: number
  ): ScenarioCalculation {
    const monthlyProjections: MonthlyProjection[] = [];
    let totalFiatNeeded = 0;
    
    // Calculate monthly growth rate from annual rate
    // Formula: (1 + annualRate)^(1/12) - 1
    const monthlyGrowthRate = Math.pow(1 + scenario.annualGrowthRate, 1 / 12) - 1;
    
    // BTC to buy each month (equal DCA)
    const btcPerMonth = btcNeeded / totalMonths;
    
    // Calculate for each month
    for (let month = 1; month <= totalMonths; month++) {
      // Project BTC price for this month
      // Formula: currentPrice * (1 + monthlyRate)^month
      const projectedPrice = currentBtcPrice * Math.pow(1 + monthlyGrowthRate, month);
      
      // Fiat needed this month
      const fiatNeeded = btcPerMonth * projectedPrice;
      
      monthlyProjections.push({
        month,
        projectedPrice,
        btcToBuy: btcPerMonth,
        fiatNeeded
      });
      
      totalFiatNeeded += fiatNeeded;
    }
    
    const averageMonthlyFiat = totalFiatNeeded / totalMonths;
    const finalProjectedPrice = monthlyProjections[monthlyProjections.length - 1]?.projectedPrice || currentBtcPrice;
    
    return {
      scenario,
      monthlyProjections,
      totalFiatNeeded,
      averageMonthlyFiat,
      finalProjectedPrice,
      totalBtcNeeded: btcNeeded
    };
  }
  
  /**
   * Calculate all 5 scenarios at once for comparison
   */
  static async calculateAllScenarios(
    currentBtcPrice: number,
    btcNeeded: number,
    totalMonths: number
  ): Promise<ScenarioCalculation[]> {
    const scenarios = await this.getScenarios();
    
    return scenarios.map(scenario => 
      this.calculateScenarioProjection(scenario, currentBtcPrice, btcNeeded, totalMonths)
    );
  }
}

