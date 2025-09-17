'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';

interface AnalyticsData {
  avgBuyPrice: number;
  avgSellPrice: number;
  totalPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  roi: number;
  annualizedReturn: number;
  sharpeRatio: number;
  winRate: number;
  bestTrade: any;
  worstTrade: any;
  currentBtcPrice: number;
  monthlyBreakdown: any[];
  statistics: {
    totalTransactions: number;
    totalBuys: number;
    totalSells: number;
    avgHoldTime: number;
    totalDaysHolding: number;
    mostActiveMonth: string;
    largestPurchase: number;
    avgBuyAmount: number;
    currentHoldings: number;
    totalBtcBought: number;
    totalBtcSold: number;
  };
  taxReport: {
    shortTermGains: number;
    longTermGains: number;
    totalTaxable: number;
    totalFeesPaid: number;
  };
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      // Use the unified portfolio metrics endpoint with detailed flag
      const response = await fetch('/api/portfolio-metrics?detailed=true');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Transform the unified data to match analytics format
          const transformedData = {
            avgBuyPrice: result.data.avgBuyPrice,
            avgSellPrice: result.data.avgSellPrice,
            totalPnL: result.data.totalPnL,
            unrealizedPnL: result.data.unrealizedPnL,
            realizedPnL: result.data.realizedPnL,
            roi: result.data.roi,
            annualizedReturn: result.data.annualizedReturn,
            sharpeRatio: 0, // Not calculated in unified endpoint yet
            winRate: result.data.winRate,
            bestTrade: null, // Not calculated in unified endpoint yet
            worstTrade: null, // Not calculated in unified endpoint yet
            currentBtcPrice: result.data.currentBtcPrice,
            monthlyBreakdown: result.data.monthlyBreakdown || [],
            statistics: {
              totalTransactions: result.data.totalTransactions,
              totalBuys: result.data.totalBuys,
              totalSells: result.data.totalSells,
              avgHoldTime: result.data.holdingDays,
              totalDaysHolding: result.data.holdingDays,
              mostActiveMonth: 'N/A', // Would need calculation
              largestPurchase: result.data.largestPurchase,
              avgBuyAmount: result.data.avgBuyAmount,
              currentHoldings: result.data.totalBtc,
              totalBtcBought: result.data.totalBtcBought,
              totalBtcSold: result.data.totalBtcSold
            },
            taxReport: {
              shortTermGains: 0, // Would need calculation
              longTermGains: 0, // Would need calculation
              totalTaxable: 0, // Would need calculation
              totalFeesPaid: 0 // Would need calculation
            }
          };
          setAnalyticsData(transformedData);
        }
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    // Simple CSV export for tax purposes
    const csvContent = "Date,Type,Amount,Price,Total,Currency\n";
    // Add transaction data...
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `btc-tax-report-${new Date().getFullYear()}.csv`;
    a.click();
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-btc-text-primary">
              Analytics & Reports
            </h1>
            <ThemedText variant="muted">
              Detailed analysis of your Bitcoin portfolio
            </ThemedText>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-bitcoin text-white'
                    : 'bg-btc-bg-tertiary text-btc-text-secondary hover:bg-btc-bg-secondary'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Average Buy Price</ThemedText>
              <div className="text-2xl font-bold text-btc-text-primary mt-1">
                ${analyticsData?.avgBuyPrice.toLocaleString() || '0'}
              </div>
              <ThemedText variant="muted" size="xs" className={`mt-1 ${analyticsData?.roi && analyticsData.roi > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {analyticsData?.roi ? `${analyticsData.roi > 0 ? '+' : ''}${analyticsData.roi.toFixed(2)}% ROI` : 'Loading...'}
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Total P&L</ThemedText>
              <div className={`text-2xl font-bold ${analyticsData?.totalPnL && analyticsData.totalPnL >= 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                {analyticsData?.totalPnL ? `${analyticsData.totalPnL >= 0 ? '+' : ''}$${Math.abs(analyticsData.totalPnL).toLocaleString()}` : '$0'}
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Realized + Unrealized
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Win Rate</ThemedText>
              <div className="text-2xl font-bold text-btc-text-primary mt-1">
                {analyticsData?.winRate ? `${analyticsData.winRate.toFixed(0)}%` : '0%'}
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                {analyticsData?.statistics ? `${analyticsData.statistics.totalSells} trades` : 'No trades'}
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Best Trade</ThemedText>
              <div className="text-2xl font-bold text-profit mt-1">
                {analyticsData?.bestTrade ? `+$${analyticsData.bestTrade.profit.toLocaleString()}` : '$0'}
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                {analyticsData?.bestTrade ? new Date(analyticsData.bestTrade.date).toLocaleDateString() : 'N/A'}
              </ThemedText>
            </div>
          </ThemedCard>
        </div>

        {/* Professional Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Annualized Return</ThemedText>
              <div className={`text-2xl font-bold ${analyticsData?.annualizedReturn && analyticsData.annualizedReturn > 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                {analyticsData?.annualizedReturn ? `${analyticsData.annualizedReturn.toFixed(2)}%` : '0%'}
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Rate of Return (RoR)
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Sharpe Ratio</ThemedText>
              <div className="text-2xl font-bold text-btc-text-primary mt-1">
                {analyticsData?.sharpeRatio ? analyticsData.sharpeRatio.toFixed(2) : '0.00'}
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Risk-adjusted returns
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Unrealized P&L</ThemedText>
              <div className={`text-2xl font-bold ${analyticsData?.unrealizedPnL && analyticsData.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                {analyticsData?.unrealizedPnL ? `${analyticsData.unrealizedPnL >= 0 ? '+' : ''}$${Math.abs(analyticsData.unrealizedPnL).toLocaleString()}` : '$0'}
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Current holdings
              </ThemedText>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-4">
              <ThemedText variant="muted" size="sm">Realized P&L</ThemedText>
              <div className={`text-2xl font-bold ${analyticsData?.realizedPnL && analyticsData.realizedPnL >= 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                {analyticsData?.realizedPnL ? `${analyticsData.realizedPnL >= 0 ? '+' : ''}$${Math.abs(analyticsData.realizedPnL).toLocaleString()}` : '$0'}
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Closed positions
              </ThemedText>
            </div>
          </ThemedCard>
        </div>

        {/* HODLing Milestones - Gamification */}
        <ThemedCard>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-btc-text-primary mb-4">
              🏆 HODLing Milestones
            </h2>
            
            {(() => {
              const currentHoldings = analyticsData?.statistics.currentHoldings || 0;
              const milestones = [
                { amount: 0.001, label: 'Satoshi Starter', icon: '🌱', color: 'bg-gray-500' },
                { amount: 0.01, label: 'Bitcoin Believer', icon: '⚡', color: 'bg-blue-500' },
                { amount: 0.1, label: 'HODLer', icon: '💎', color: 'bg-purple-500' },
                { amount: 0.5, label: 'Half-Coiner', icon: '🚀', color: 'bg-orange-500' },
                { amount: 1, label: 'Whole Coiner', icon: '👑', color: 'bg-yellow-500' },
                { amount: 10, label: 'Bitcoin Whale', icon: '🐋', color: 'bg-green-500' },
                { amount: 100, label: 'Satoshi Nakamoto?', icon: '🧘', color: 'bg-red-500' }
              ];
              
              // Find current milestone and next milestone
              let currentMilestoneIndex = -1;
              let nextMilestone = milestones[0];
              
              for (let i = milestones.length - 1; i >= 0; i--) {
                if (currentHoldings >= milestones[i].amount) {
                  currentMilestoneIndex = i;
                  nextMilestone = milestones[i + 1] || milestones[milestones.length - 1];
                  break;
                }
              }
              
              // Calculate progress to next milestone
              const currentMilestone = currentMilestoneIndex >= 0 ? milestones[currentMilestoneIndex] : null;
              const progressToNext = currentMilestone 
                ? Math.min(100, ((currentHoldings - currentMilestone.amount) / (nextMilestone.amount - currentMilestone.amount)) * 100)
                : (currentHoldings / milestones[0].amount) * 100;
              
              return (
                <div className="space-y-6">
                  {/* Current Status */}
                  <div className="text-center">
                    <div className="text-5xl mb-3">
                      {currentMilestone ? currentMilestone.icon : '🎯'}
                    </div>
                    <div className="space-y-2">
                      <ThemedText variant="primary" className="text-xl font-bold block">
                        {currentMilestone ? currentMilestone.label : 'Starting Your Journey'}
                      </ThemedText>
                      <ThemedText variant="muted" size="sm" className="block">
                        Current Holdings
                      </ThemedText>
                      <ThemedText variant="primary" className="text-lg font-semibold block">
                        {currentHoldings.toFixed(8)} BTC
                      </ThemedText>
                    </div>
                  </div>
                  
                  {/* Progress to Next Milestone */}
                  {nextMilestone && currentMilestoneIndex < milestones.length - 1 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <ThemedText variant="muted" size="sm">
                          Progress to {nextMilestone.label}
                        </ThemedText>
                        <ThemedText variant="primary" size="sm" className="font-medium">
                          {progressToNext.toFixed(1)}%
                        </ThemedText>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${nextMilestone.color}`}
                          style={{ width: `${progressToNext}%` }}
                        />
                      </div>
                      <ThemedText variant="muted" size="xs" className="text-center">
                        {(nextMilestone.amount - currentHoldings).toFixed(8)} BTC to go!
                      </ThemedText>
                    </div>
                  )}
                  
                  {/* All Milestones */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    {milestones.map((milestone, index) => {
                      const isAchieved = currentHoldings >= milestone.amount;
                      const isCurrent = index === currentMilestoneIndex;
                      
                      return (
                        <div 
                          key={milestone.amount}
                          className={`
                            relative p-4 rounded-lg text-center transition-all min-h-[140px] flex flex-col justify-center
                            ${isAchieved 
                              ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                              : 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 opacity-50'
                            }
                            ${isCurrent ? 'ring-2 ring-orange-400 ring-offset-2 dark:ring-offset-gray-900' : ''}
                          `}
                        >
                          {isAchieved && (
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                              ✓
                            </div>
                          )}
                          <div className="text-3xl mb-2">{milestone.icon}</div>
                          <div className="space-y-1">
                            <ThemedText 
                              variant={isAchieved ? "primary" : "muted"} 
                              size="xs" 
                              className="font-semibold block"
                            >
                              {milestone.amount} BTC
                            </ThemedText>
                            <ThemedText 
                              variant={isAchieved ? "primary" : "muted"} 
                              size="xs" 
                              className="block text-xs"
                            >
                              {milestone.label}
                            </ThemedText>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Achievement Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center space-y-1">
                      <ThemedText variant="muted" size="xs" className="block">
                        Milestones Achieved
                      </ThemedText>
                      <ThemedText variant="primary" className="text-2xl font-bold block">
                        {milestones.filter(m => currentHoldings >= m.amount).length}
                      </ThemedText>
                    </div>
                    <div className="text-center space-y-1">
                      <ThemedText variant="muted" size="xs" className="block">
                        Completion
                      </ThemedText>
                      <ThemedText variant="primary" className="text-2xl font-bold block">
                        {((milestones.filter(m => currentHoldings >= m.amount).length / milestones.length) * 100).toFixed(0)}%
                      </ThemedText>
                    </div>
                    <div className="text-center space-y-1">
                      <ThemedText variant="muted" size="xs" className="block">
                        Current Level
                      </ThemedText>
                      <ThemedText variant="primary" className="text-2xl font-bold block">
                        {currentMilestoneIndex >= 0 ? currentMilestoneIndex + 1 : 0}
                      </ThemedText>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </ThemedCard>

        {/* Monthly Purchase Impact Chart */}
        <ThemedCard>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-btc-text-primary mb-2">
              Monthly Purchase Impact
            </h2>
            <ThemedText variant="muted" size="xs" className="mb-4">
              How your monthly purchases are performing at current BTC price
            </ThemedText>
            
            {/* Dynamic bar chart showing purchase performance */}
            <div className="h-64 flex items-end justify-between gap-1 px-2">
              {(() => {
                // Calculate monthly purchase impact
                const currentBtcPrice = analyticsData?.currentBtcPrice || 0;
                const monthlyImpact = analyticsData?.monthlyBreakdown?.map(month => {
                  // For each month, calculate if purchases are in profit
                  const monthAvgPrice = month?.avgBuyPrice || 0;
                  const monthBtcBought = month?.netBtc || 0;
                  const currentValue = monthBtcBought * currentBtcPrice;
                  const costBasis = monthBtcBought * monthAvgPrice;
                  const impact = currentValue - costBasis;
                  
                  
                  return {
                    ...month,
                    impact: (month?.buys || 0) > 0 ? impact : 0,
                    percentGain: monthAvgPrice > 0 ? ((currentBtcPrice - monthAvgPrice) / monthAvgPrice) * 100 : 0,
                    btcAmount: monthBtcBought,
                    avgBuyPrice: monthAvgPrice || month?.avgBuyPrice || 0, // Ensure this field exists
                    monthName: month?.monthName || 'Unknown'
                  };
                }).filter(m => m && m.buys > 0); // Only show months with purchases
                
                if (!monthlyImpact || monthlyImpact.length === 0) {
                  return (
                    <div className="w-full h-full flex items-center justify-center">
                      <ThemedText variant="muted">No purchase data available for selected period</ThemedText>
                    </div>
                  );
                }
                
                const last12Months = monthlyImpact.slice(-12);
                
                // Find the max and min impact for proper scaling
                const impacts = last12Months.map(m => Math.abs(m.impact || 0));
                const maxImpact = Math.max(...impacts);
                const minImpact = Math.min(...impacts.filter(i => i > 0));
                
                return last12Months.map((month, i) => {
                  // Scale height based on relative impact
                  const impactValue = Math.abs(month.impact || 0);
                  let heightPixels = 20; // minimum height
                  
                  if (maxImpact > 0 && impactValue > 0) {
                    // Normalize between min and max for better visual distribution
                    // Use logarithmic scale if the range is too large
                    const range = maxImpact - minImpact;
                    if (range > 0) {
                      const normalized = (impactValue - minImpact) / range;
                      // Scale from 20px (minimum) to 180px (maximum)
                      heightPixels = 20 + (normalized * 160);
                    } else {
                      // All values are the same, use medium height
                      heightPixels = 100;
                    }
                  }
                  
                  const isProfit = month.impact >= 0;
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end">
                      {/* Single label above bar with all info */}
                      <div className="text-center mb-2 h-12 flex flex-col justify-end">
                        <ThemedText variant="muted" size="xs" className={`font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'} block`}>
                          {month.percentGain ? `${month.percentGain >= 0 ? '+' : ''}${month.percentGain.toFixed(1)}%` : ''}
                        </ThemedText>
                        <ThemedText variant="muted" size="xs" className="block">
                          {month.impact ? `$${Math.abs(month.impact).toFixed(0)}` : ''}
                        </ThemedText>
                      </div>
                      <div 
                        className={`w-full rounded-t transition-all hover:opacity-80 relative ${
                          isProfit ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ height: `${heightPixels}px`, minHeight: '10px' }}
                        title={`${month.monthName}: Bought ${month.btcAmount?.toFixed(8) || '0'} BTC at avg $${month.avgBuyPrice && month.avgBuyPrice > 0 ? month.avgBuyPrice.toFixed(0) : 'calculating...'}`}
                      >
                      </div>
                      <ThemedText variant="muted" size="xs" className="mt-1">
                        {month.monthName ? month.monthName.substring(0, 3) : ''}
                      </ThemedText>
                    </div>
                  );
                });
              })()}
            </div>
            
            <div className="mt-4 flex justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <ThemedText variant="muted" size="xs">Profitable purchases</ThemedText>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <ThemedText variant="muted" size="xs">Underwater purchases</ThemedText>
              </div>
            </div>
          </div>
        </ThemedCard>

        {/* Tax Report Section */}
        <ThemedCard>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-btc-text-primary">
                Tax Report
              </h2>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-bitcoin text-white rounded hover:bg-bitcoin-dark transition-colors text-sm font-medium"
              >
                Export CSV
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <ThemedText variant="muted" size="sm">Short-term Gains</ThemedText>
                <div className={`text-xl font-semibold ${analyticsData?.taxReport.shortTermGains && analyticsData.taxReport.shortTermGains > 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                  ${analyticsData?.taxReport.shortTermGains ? Math.abs(analyticsData.taxReport.shortTermGains).toLocaleString() : '0'}
                </div>
              </div>
              <div>
                <ThemedText variant="muted" size="sm">Long-term Gains</ThemedText>
                <div className={`text-xl font-semibold ${analyticsData?.taxReport.longTermGains && analyticsData.taxReport.longTermGains > 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                  ${analyticsData?.taxReport.longTermGains ? Math.abs(analyticsData.taxReport.longTermGains).toLocaleString() : '0'}
                </div>
              </div>
              <div>
                <ThemedText variant="muted" size="sm">Total Taxable</ThemedText>
                <div className="text-xl font-semibold text-btc-text-primary mt-1">
                  ${analyticsData?.taxReport.totalTaxable ? Math.abs(analyticsData.taxReport.totalTaxable).toLocaleString() : '0'}
                </div>
              </div>
            </div>
            
            <ThemedText variant="muted" size="xs" className="mt-4">
              * Consult with a tax professional. This is for informational purposes only.
            </ThemedText>
          </div>
        </ThemedCard>

        {/* Transaction Statistics */}
        <ThemedCard>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-btc-text-primary mb-4">
              Trading Statistics
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <ThemedText variant="muted">Total Transactions</ThemedText>
                <ThemedText variant="primary" className="font-medium">
                  {analyticsData?.statistics.totalTransactions || 0}
                </ThemedText>
              </div>
              <div className="flex justify-between">
                <ThemedText variant="muted">Average Hold Time</ThemedText>
                <ThemedText variant="primary" className="font-medium">
                  {analyticsData?.statistics.avgHoldTime ? `${analyticsData.statistics.avgHoldTime} days` : 'N/A'}
                </ThemedText>
              </div>
              <div className="flex justify-between">
                <ThemedText variant="muted">Most Active Month</ThemedText>
                <ThemedText variant="primary" className="font-medium">
                  {analyticsData?.statistics.mostActiveMonth || 'N/A'}
                </ThemedText>
              </div>
              <div className="flex justify-between">
                <ThemedText variant="muted">Largest Purchase</ThemedText>
                <ThemedText variant="primary" className="font-medium">
                  {analyticsData?.statistics.largestPurchase ? `${analyticsData.statistics.largestPurchase.toFixed(8)} BTC` : '0 BTC'}
                </ThemedText>
              </div>
              <div className="flex justify-between">
                <ThemedText variant="muted">Average Buy Amount</ThemedText>
                <ThemedText variant="primary" className="font-medium">
                  {analyticsData?.statistics.avgBuyAmount ? `${analyticsData.statistics.avgBuyAmount.toFixed(8)} BTC` : '0 BTC'}
                </ThemedText>
              </div>
              <div className="flex justify-between">
                <ThemedText variant="muted">Current Holdings</ThemedText>
                <ThemedText variant="primary" className="font-medium">
                  {analyticsData?.statistics.currentHoldings ? `${analyticsData.statistics.currentHoldings.toFixed(8)} BTC` : '0 BTC'}
                </ThemedText>
              </div>
            </div>
          </div>
        </ThemedCard>
      </div>
    </AppLayout>
  );
}
