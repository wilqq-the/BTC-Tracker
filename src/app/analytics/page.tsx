'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import currencies from '@/data/currencies.json';

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

interface Transaction {
  id: number;
  type: 'BUY' | 'SELL';
  transaction_date: string;
  btc_amount: number;
  original_price_per_btc: number;
  original_total_amount: number;
  original_currency: string;
  main_currency_total_amount?: number;
  main_currency_price_per_btc?: number;
  notes?: string;
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('ALL');
  const [mainCurrency, setMainCurrency] = useState('USD');
  const [exporting, setExporting] = useState(false);

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
          setMainCurrency(result.data.mainCurrency || 'USD');
        }
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | undefined, currency: string = mainCurrency) => {
    if (value === undefined || value === null) return `${getCurrencySymbol(currency)}0`;
    return `${getCurrencySymbol(currency)}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getCurrencySymbol = (currency: string) => {
    const currencyData = currencies.find(c => c.alpha === currency);
    return currencyData ? currencyData.symbol : currency + ' ';
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      // Fetch all transactions
      const response = await fetch('/api/transactions');
      const result = await response.json();
      
      if (!result.success || !result.data) {
        alert('Failed to load transactions for export');
        return;
      }

      const transactions: Transaction[] = result.data;
      
      // Filter for SELL transactions only (taxable events)
      const sellTransactions = transactions.filter(tx => tx.type === 'SELL');
      
      // Also get BUY transactions to calculate cost basis
      const buyTransactions = transactions.filter(tx => tx.type === 'BUY');
      
      // Calculate average buy price for cost basis
      const totalBtcBought = buyTransactions.reduce((sum, tx) => sum + tx.btc_amount, 0);
      const totalInvested = buyTransactions.reduce((sum, tx) => sum + (tx.main_currency_total_amount || tx.original_total_amount), 0);
      const avgCostBasis = totalBtcBought > 0 ? totalInvested / totalBtcBought : 0;
      
      // Create CSV header for tax report
      const csvHeader = 'Date Sold,BTC Amount Sold,Sale Price per BTC,Sale Proceeds,Cost Basis per BTC,Total Cost Basis,Capital Gain/Loss,Currency,Notes\n';
      
      // Create CSV rows for SELL transactions with capital gains
      const csvRows = sellTransactions.map(tx => {
        const date = new Date(tx.transaction_date).toLocaleDateString('en-US');
        const btcAmount = tx.btc_amount.toFixed(8);
        const salePrice = (tx.main_currency_price_per_btc || tx.original_price_per_btc).toFixed(2);
        const saleProceeds = (tx.main_currency_total_amount || tx.original_total_amount).toFixed(2);
        
        // Use average cost basis (FIFO/LIFO would require more complex tracking)
        const costBasisPerBtc = avgCostBasis.toFixed(2);
        const totalCostBasis = (tx.btc_amount * avgCostBasis).toFixed(2);
        const capitalGain = ((tx.main_currency_total_amount || tx.original_total_amount) - (tx.btc_amount * avgCostBasis)).toFixed(2);
        
        const currency = mainCurrency;
        const notes = (tx.notes || '').replace(/"/g, '""'); // Escape quotes
        
        return `"${date}","${btcAmount}","${salePrice}","${saleProceeds}","${costBasisPerBtc}","${totalCostBasis}","${capitalGain}","${currency}","${notes}"`;
      }).join('\n');
      
      // Add summary row
      const totalSaleProceeds = sellTransactions.reduce((sum, tx) => sum + (tx.main_currency_total_amount || tx.original_total_amount), 0);
      const totalBtcSold = sellTransactions.reduce((sum, tx) => sum + tx.btc_amount, 0);
      const totalCostBasis = totalBtcSold * avgCostBasis;
      const totalCapitalGain = totalSaleProceeds - totalCostBasis;
      
      const summaryRow = `\n"TOTAL","${totalBtcSold.toFixed(8)}","","${totalSaleProceeds.toFixed(2)}","","${totalCostBasis.toFixed(2)}","${totalCapitalGain.toFixed(2)}","${mainCurrency}","Summary of all sales"`;
      
      // Add metadata
      const metadata = `"Tax Report for ${new Date().getFullYear()}"\n"Generated on: ${new Date().toLocaleString('en-US')}"\n"Cost Basis Method: Average Cost"\n"Currency: ${mainCurrency}"\n\n`;
      
      const csvContent = metadata + csvHeader + csvRows + summaryRow;
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `btc-capital-gains-tax-report-${new Date().getFullYear()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
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
          
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium flex items-center space-x-2"
            >
              <span>{exporting ? '⏳' : '📊'}</span>
              <span>{exporting ? 'Exporting...' : 'Sell Report'}</span>
            </button>
          </div>
        </div>

        {/* Performance Overview - Top Row */}
        <div>
          <h2 className="text-lg font-semibold text-btc-text-primary mb-3">Performance Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ThemedCard>
              <div className="p-4">
                <ThemedText variant="muted" size="sm">Total P&L</ThemedText>
                <div className={`text-2xl font-bold ${analyticsData?.totalPnL && analyticsData.totalPnL >= 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                  {analyticsData?.totalPnL ? `${analyticsData.totalPnL >= 0 ? '+' : '-'}${formatCurrency(Math.abs(analyticsData.totalPnL))}` : formatCurrency(0)}
                </div>
                <ThemedText variant="muted" size="xs" className={`mt-1 font-medium ${analyticsData?.roi && analyticsData.roi > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {analyticsData?.roi ? `${analyticsData.roi > 0 ? '+' : ''}${analyticsData.roi.toFixed(2)}% ROI` : '0% ROI'}
                </ThemedText>
              </div>
            </ThemedCard>

            <ThemedCard>
              <div className="p-4">
                <ThemedText variant="muted" size="sm">Unrealized P&L</ThemedText>
                <div className={`text-2xl font-bold ${analyticsData?.unrealizedPnL && analyticsData.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                  {analyticsData?.unrealizedPnL ? `${analyticsData.unrealizedPnL >= 0 ? '+' : '-'}${formatCurrency(Math.abs(analyticsData.unrealizedPnL))}` : formatCurrency(0)}
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
                  {analyticsData?.realizedPnL ? `${analyticsData.realizedPnL >= 0 ? '+' : '-'}${formatCurrency(Math.abs(analyticsData.realizedPnL))}` : formatCurrency(0)}
                </div>
                <ThemedText variant="muted" size="xs" className="mt-1">
                  Closed positions
                </ThemedText>
              </div>
            </ThemedCard>

            <ThemedCard>
              <div className="p-4">
                <ThemedText variant="muted" size="sm">Annualized Return</ThemedText>
                <div className={`text-2xl font-bold ${analyticsData?.annualizedReturn && analyticsData.annualizedReturn > 0 ? 'text-profit' : 'text-loss'} mt-1`}>
                  {analyticsData?.annualizedReturn ? `${analyticsData.annualizedReturn >= 0 ? '+' : ''}${analyticsData.annualizedReturn.toFixed(2)}%` : '0%'}
                </div>
                <ThemedText variant="muted" size="xs" className="mt-1">
                  Yearly average
                </ThemedText>
              </div>
            </ThemedCard>
          </div>
        </div>

        {/* Portfolio Metrics - Second Row */}
        <div>
          <h2 className="text-lg font-semibold text-btc-text-primary mb-3">Portfolio Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ThemedCard>
              <div className="p-4">
                <ThemedText variant="muted" size="sm">Average Buy Price</ThemedText>
                <div className="text-xl font-bold text-btc-text-primary mt-1">
                  {formatCurrency(analyticsData?.avgBuyPrice)}
                </div>
                <ThemedText variant="muted" size="xs" className="mt-1">
                  Cost basis
                </ThemedText>
              </div>
            </ThemedCard>

            <ThemedCard>
              <div className="p-4">
                <ThemedText variant="muted" size="sm">Current BTC Price</ThemedText>
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {formatCurrency(analyticsData?.currentBtcPrice)}
                </div>
                <ThemedText variant="muted" size="xs" className="mt-1">
                  Live price
                </ThemedText>
              </div>
            </ThemedCard>

            <ThemedCard>
              <div className="p-4">
                <ThemedText variant="muted" size="sm">Current Holdings</ThemedText>
                <div className="text-xl font-bold text-btc-text-primary mt-1">
                  {analyticsData?.statistics.currentHoldings ? `${analyticsData.statistics.currentHoldings.toFixed(8)} ₿` : '0 ₿'}
                </div>
                <ThemedText variant="muted" size="xs" className="mt-1">
                  Total BTC owned
                </ThemedText>
              </div>
            </ThemedCard>

            <ThemedCard>
              <div className="p-4">
                <ThemedText variant="muted" size="sm">Win Rate</ThemedText>
                <div className="text-xl font-bold text-btc-text-primary mt-1">
                  {analyticsData?.winRate ? `${analyticsData.winRate.toFixed(0)}%` : '0%'}
                </div>
                <ThemedText variant="muted" size="xs" className="mt-1">
                  {analyticsData?.statistics ? `${analyticsData.statistics.totalSells} trades` : 'No trades'}
                </ThemedText>
              </div>
            </ThemedCard>
          </div>
        </div>

        {/* Charts Section - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Purchase Impact Chart */}
          <ThemedCard>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-btc-text-primary mb-2">
                Monthly Purchase Performance
              </h2>
              <ThemedText variant="muted" size="xs" className="mb-4">
                How each month's purchases perform at current BTC price
              </ThemedText>
              
              {/* Dynamic bar chart */}
              <div className="h-64 flex items-end justify-between gap-1">
                {(() => {
                  const currentBtcPrice = analyticsData?.currentBtcPrice || 0;
                  const monthlyImpact = analyticsData?.monthlyBreakdown?.map(month => {
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
                      avgBuyPrice: monthAvgPrice || month?.avgBuyPrice || 0,
                      monthName: month?.monthName || 'Unknown'
                    };
                  }).filter(m => m && m.buys > 0);
                  
                  if (!monthlyImpact || monthlyImpact.length === 0) {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <ThemedText variant="muted">No purchase data available</ThemedText>
                      </div>
                    );
                  }
                  
                  const last12Months = monthlyImpact.slice(-12);
                  const impacts = last12Months.map(m => Math.abs(m.impact || 0));
                  const maxImpact = Math.max(...impacts);
                  const minImpact = Math.min(...impacts.filter(i => i > 0));
                  
                  return last12Months.map((month, i) => {
                    const impactValue = Math.abs(month.impact || 0);
                    let heightPixels = 20;
                    
                    if (maxImpact > 0 && impactValue > 0) {
                      const range = maxImpact - minImpact;
                      if (range > 0) {
                        const normalized = (impactValue - minImpact) / range;
                        heightPixels = 20 + (normalized * 160);
                      } else {
                        heightPixels = 100;
                      }
                    }
                    
                    const isProfit = month.impact >= 0;
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end">
                        <div className="text-center mb-2 h-12 flex flex-col justify-end">
                          <ThemedText variant="muted" size="xs" className={`font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'} block`}>
                            {month.percentGain ? `${month.percentGain >= 0 ? '+' : ''}${month.percentGain.toFixed(1)}%` : ''}
                          </ThemedText>
                        </div>
                        <div 
                          className={`w-full rounded-t transition-all hover:opacity-80 ${
                            isProfit ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{ height: `${heightPixels}px`, minHeight: '10px' }}
                          title={`${month.monthName}: ${month.btcAmount?.toFixed(8) || '0'} BTC @ ${formatCurrency(month.avgBuyPrice)}`}
                        />
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
                  <ThemedText variant="muted" size="xs">Profitable</ThemedText>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <ThemedText variant="muted" size="xs">Underwater</ThemedText>
                </div>
              </div>
            </div>
          </ThemedCard>

          {/* Trading Statistics */}
          <ThemedCard>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-btc-text-primary mb-4">
                Trading Statistics
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <ThemedText variant="muted">Total Transactions</ThemedText>
                  <ThemedText variant="primary" className="font-semibold">
                    {analyticsData?.statistics.totalTransactions || 0}
                  </ThemedText>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <ThemedText variant="muted">Total Buys</ThemedText>
                  <ThemedText variant="primary" className="font-semibold text-green-600 dark:text-green-400">
                    {analyticsData?.statistics.totalBuys || 0}
                  </ThemedText>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <ThemedText variant="muted">Total Sells</ThemedText>
                  <ThemedText variant="primary" className="font-semibold text-red-600 dark:text-red-400">
                    {analyticsData?.statistics.totalSells || 0}
                  </ThemedText>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <ThemedText variant="muted">Holding Period</ThemedText>
                  <ThemedText variant="primary" className="font-semibold">
                    {analyticsData?.statistics.avgHoldTime ? `${analyticsData.statistics.avgHoldTime} days` : 'N/A'}
                  </ThemedText>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <ThemedText variant="muted">Largest Purchase</ThemedText>
                  <ThemedText variant="primary" className="font-semibold">
                    {analyticsData?.statistics.largestPurchase ? `${analyticsData.statistics.largestPurchase.toFixed(8)} ₿` : '0 ₿'}
                  </ThemedText>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <ThemedText variant="muted">Average Buy Amount</ThemedText>
                  <ThemedText variant="primary" className="font-semibold">
                    {analyticsData?.statistics.avgBuyAmount ? `${analyticsData.statistics.avgBuyAmount.toFixed(8)} ₿` : '0 ₿'}
                  </ThemedText>
                </div>
                <div className="flex justify-between items-center py-2">
                  <ThemedText variant="muted">Total BTC Bought</ThemedText>
                  <ThemedText variant="primary" className="font-semibold">
                    {analyticsData?.statistics.totalBtcBought ? `${analyticsData.statistics.totalBtcBought.toFixed(8)} ₿` : '0 ₿'}
                  </ThemedText>
                </div>
              </div>
            </div>
          </ThemedCard>
        </div>

        {/* HODLing Milestones - Full Width */}
        <ThemedCard>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-btc-text-primary mb-4">
              HODLing Milestones
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
              
              let currentMilestoneIndex = -1;
              let nextMilestone = milestones[0];
              
              for (let i = milestones.length - 1; i >= 0; i--) {
                if (currentHoldings >= milestones[i].amount) {
                  currentMilestoneIndex = i;
                  nextMilestone = milestones[i + 1] || milestones[milestones.length - 1];
                  break;
                }
              }
              
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
                    <ThemedText variant="primary" className="text-xl font-bold block">
                      {currentMilestone ? currentMilestone.label : 'Starting Your Journey'}
                    </ThemedText>
                    <ThemedText variant="primary" className="text-lg font-semibold block mt-2">
                      {currentHoldings.toFixed(8)} BTC
                    </ThemedText>
                  </div>
                  
                  {/* Progress to Next */}
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
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${nextMilestone.color}`}
                          style={{ width: `${progressToNext}%` }}
                        />
                      </div>
                      <ThemedText variant="muted" size="xs" className="text-center">
                        {(nextMilestone.amount - currentHoldings).toFixed(8)} BTC to go!
                      </ThemedText>
                    </div>
                  )}
                  
                  {/* All Milestones */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {milestones.map((milestone, index) => {
                      const isAchieved = currentHoldings >= milestone.amount;
                      const isCurrent = index === currentMilestoneIndex;
                      
                      return (
                        <div 
                          key={milestone.amount}
                          className={`
                            relative p-3 rounded-lg text-center transition-all flex flex-col justify-center
                            ${isAchieved 
                              ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                              : 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 opacity-50'
                            }
                            ${isCurrent ? 'ring-2 ring-orange-400' : ''}
                          `}
                        >
                          {isAchieved && (
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                              ✓
                            </div>
                          )}
                          <div className="text-2xl mb-1">{milestone.icon}</div>
                          <ThemedText 
                            variant={isAchieved ? "primary" : "muted"} 
                            size="xs" 
                            className="font-semibold"
                          >
                            {milestone.amount} BTC
                          </ThemedText>
                          <ThemedText 
                            variant={isAchieved ? "primary" : "muted"} 
                            size="xs"
                          >
                            {milestone.label}
                          </ThemedText>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </ThemedCard>
      </div>
    </AppLayout>
  );
}
