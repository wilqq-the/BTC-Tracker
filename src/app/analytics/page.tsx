'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import currencies from '@/data/currencies.json';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Icons
import {
  TrendingUpIcon,
  TrendingDownIcon,
  BarChart3Icon,
  WalletIcon,
  TargetIcon,
  CalendarIcon,
  CoinsIcon,
  DownloadIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrophyIcon,
  SparklesIcon,
  CheckCircleIcon,
  CircleIcon,
} from 'lucide-react';

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
  const [mainCurrency, setMainCurrency] = useState('USD');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics?detailed=true');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const transformedData = {
            avgBuyPrice: result.data.avgBuyPrice,
            avgSellPrice: result.data.avgSellPrice,
            totalPnL: result.data.totalPnL,
            unrealizedPnL: result.data.unrealizedPnL,
            realizedPnL: result.data.realizedPnL,
            roi: result.data.roi,
            annualizedReturn: result.data.annualizedReturn,
            sharpeRatio: 0,
            winRate: result.data.winRate,
            bestTrade: null,
            worstTrade: null,
            currentBtcPrice: result.data.currentBtcPrice,
            monthlyBreakdown: result.data.monthlyBreakdown || [],
            statistics: {
              totalTransactions: result.data.totalTransactions,
              totalBuys: result.data.totalBuys,
              totalSells: result.data.totalSells,
              avgHoldTime: result.data.holdingDays,
              totalDaysHolding: result.data.holdingDays,
              mostActiveMonth: 'N/A',
              largestPurchase: result.data.largestPurchase,
              avgBuyAmount: result.data.avgBuyAmount,
              currentHoldings: result.data.totalBtc,
              totalBtcBought: result.data.totalBtcBought,
              totalBtcSold: result.data.totalBtcSold
            },
            taxReport: {
              shortTermGains: 0,
              longTermGains: 0,
              totalTaxable: 0,
              totalFeesPaid: 0
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
      const response = await fetch('/api/transactions?limit=10000');
      const result = await response.json();
      
      if (!result.success || !result.data) {
        alert('Failed to load transactions for export');
        return;
      }

      const transactions: Transaction[] = result.data;
      const sellTransactions = transactions.filter(tx => tx.type === 'SELL');
      const buyTransactions = transactions.filter(tx => tx.type === 'BUY');
      
      const totalBtcBought = buyTransactions.reduce((sum, tx) => sum + tx.btc_amount, 0);
      const totalInvested = buyTransactions.reduce((sum, tx) => sum + (tx.main_currency_total_amount || tx.original_total_amount), 0);
      const avgCostBasis = totalBtcBought > 0 ? totalInvested / totalBtcBought : 0;
      
      const csvHeader = 'Date Sold,BTC Amount Sold,Sale Price per BTC,Sale Proceeds,Cost Basis per BTC,Total Cost Basis,Capital Gain/Loss,Currency,Notes\n';
      
      const csvRows = sellTransactions.map(tx => {
        const date = new Date(tx.transaction_date).toLocaleDateString('en-US');
        const btcAmount = tx.btc_amount.toFixed(8);
        const salePrice = (tx.main_currency_price_per_btc || tx.original_price_per_btc).toFixed(2);
        const saleProceeds = (tx.main_currency_total_amount || tx.original_total_amount).toFixed(2);
        const costBasisPerBtc = avgCostBasis.toFixed(2);
        const totalCostBasis = (tx.btc_amount * avgCostBasis).toFixed(2);
        const capitalGain = ((tx.main_currency_total_amount || tx.original_total_amount) - (tx.btc_amount * avgCostBasis)).toFixed(2);
        const notes = (tx.notes || '').replace(/"/g, '""');
        
        return `"${date}","${btcAmount}","${salePrice}","${saleProceeds}","${costBasisPerBtc}","${totalCostBasis}","${capitalGain}","${mainCurrency}","${notes}"`;
      }).join('\n');
      
      const totalSaleProceeds = sellTransactions.reduce((sum, tx) => sum + (tx.main_currency_total_amount || tx.original_total_amount), 0);
      const totalBtcSold = sellTransactions.reduce((sum, tx) => sum + tx.btc_amount, 0);
      const totalCostBasis = totalBtcSold * avgCostBasis;
      const totalCapitalGain = totalSaleProceeds - totalCostBasis;
      
      const summaryRow = `\n"TOTAL","${totalBtcSold.toFixed(8)}","","${totalSaleProceeds.toFixed(2)}","","${totalCostBasis.toFixed(2)}","${totalCapitalGain.toFixed(2)}","${mainCurrency}","Summary of all sales"`;
      const metadata = `"Tax Report for ${new Date().getFullYear()}"\n"Generated on: ${new Date().toLocaleString('en-US')}"\n"Cost Basis Method: Average Cost"\n"Currency: ${mainCurrency}"\n\n`;
      
      const csvContent = metadata + csvHeader + csvRows + summaryRow;
      
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const currentHoldings = analyticsData?.statistics.currentHoldings || 0;
  const milestones = [
    { amount: 0.001, label: 'Satoshi Starter', icon: '🌱' },
    { amount: 0.01, label: 'Bitcoin Believer', icon: '⚡' },
    { amount: 0.1, label: 'HODLer', icon: '💎' },
    { amount: 0.5, label: 'Half-Coiner', icon: '🚀' },
    { amount: 1, label: 'Whole Coiner', icon: '👑' },
    { amount: 10, label: 'Bitcoin Whale', icon: '🐋' },
  ];

  const currentMilestoneIndex = milestones.findIndex((m, i) => {
    const next = milestones[i + 1];
    return currentHoldings >= m.amount && (!next || currentHoldings < next.amount);
  });
  
  const nextMilestone = milestones[currentMilestoneIndex + 1];
  const currentMilestone = milestones[currentMilestoneIndex] || null;
  
  const progressToNext = currentMilestone && nextMilestone
    ? Math.min(100, ((currentHoldings - currentMilestone.amount) / (nextMilestone.amount - currentMilestone.amount)) * 100)
    : currentHoldings < milestones[0].amount
    ? (currentHoldings / milestones[0].amount) * 100
    : 100;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BarChart3Icon className="size-6 text-primary" />
              Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Portfolio performance and insights
            </p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={exporting}
          >
            <DownloadIcon className="size-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Tax Report'}
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total P&L */}
          <Card className={cn(
            "relative overflow-hidden",
            analyticsData?.totalPnL && analyticsData.totalPnL >= 0
              ? "bg-gradient-to-br from-profit/10 to-profit/5 border-profit/20"
              : "bg-gradient-to-br from-loss/10 to-loss/5 border-loss/20"
          )}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total P&L</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    analyticsData?.totalPnL && analyticsData.totalPnL >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {analyticsData?.totalPnL 
                      ? `${analyticsData.totalPnL >= 0 ? '+' : '-'}${formatCurrency(Math.abs(analyticsData.totalPnL))}`
                      : formatCurrency(0)}
                  </p>
                  <p className={cn(
                    "text-sm font-medium mt-1",
                    analyticsData?.roi && analyticsData.roi >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {analyticsData?.roi ? `${analyticsData.roi >= 0 ? '+' : ''}${analyticsData.roi.toFixed(2)}% ROI` : '0% ROI'}
                  </p>
                </div>
                <div className={cn(
                  "p-2.5 rounded-lg",
                  analyticsData?.totalPnL && analyticsData.totalPnL >= 0 ? 'bg-profit/10' : 'bg-loss/10'
                )}>
                  {analyticsData?.totalPnL && analyticsData.totalPnL >= 0 
                    ? <TrendingUpIcon className="size-5 text-profit" />
                    : <TrendingDownIcon className="size-5 text-loss" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unrealized P&L */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unrealized P&L</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    analyticsData?.unrealizedPnL && analyticsData.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {analyticsData?.unrealizedPnL 
                      ? `${analyticsData.unrealizedPnL >= 0 ? '+' : '-'}${formatCurrency(Math.abs(analyticsData.unrealizedPnL))}`
                      : formatCurrency(0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Current holdings</p>
                </div>
                <div className="p-2.5 bg-muted rounded-lg">
                  <WalletIcon className="size-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Realized P&L */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Realized P&L</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    analyticsData?.realizedPnL && analyticsData.realizedPnL >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {analyticsData?.realizedPnL 
                      ? `${analyticsData.realizedPnL >= 0 ? '+' : '-'}${formatCurrency(Math.abs(analyticsData.realizedPnL))}`
                      : formatCurrency(0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Closed positions</p>
                </div>
                <div className="p-2.5 bg-muted rounded-lg">
                  <TargetIcon className="size-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Annualized Return */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Annualized Return</p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    analyticsData?.annualizedReturn && analyticsData.annualizedReturn >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {analyticsData?.annualizedReturn 
                      ? `${analyticsData.annualizedReturn >= 0 ? '+' : ''}${analyticsData.annualizedReturn.toFixed(1)}%`
                      : '0%'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Yearly average</p>
                </div>
                <div className="p-2.5 bg-muted rounded-lg">
                  <CalendarIcon className="size-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Average Buy Price</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(analyticsData?.avgBuyPrice)}</p>
              <p className="text-xs text-muted-foreground mt-1">Cost basis</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-btc-500/10 to-btc-600/5 border-btc-500/20">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Current BTC Price</p>
              <p className="text-xl font-bold text-btc-500 mt-1">{formatCurrency(analyticsData?.currentBtcPrice)}</p>
              <p className="text-xs text-muted-foreground mt-1">Live market price</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Current Holdings</p>
              <p className="text-xl font-bold mt-1">{currentHoldings.toFixed(8)} BTC</p>
              <p className="text-xs text-muted-foreground mt-1">Total owned</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
              <p className="text-xl font-bold mt-1">{analyticsData?.winRate ? `${analyticsData.winRate.toFixed(0)}%` : '0%'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analyticsData?.statistics.totalSells || 0} sell trades
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Performance Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Purchase Performance</CardTitle>
              <CardDescription>How each month&apos;s purchases perform at current price</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 flex items-end justify-between gap-1">
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
                      avgBuyPrice: monthAvgPrice,
                      monthName: month?.monthName || 'Unknown'
                    };
                  }).filter(m => m && m.buys > 0);
                  
                  if (!monthlyImpact || monthlyImpact.length === 0) {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No purchase data available</p>
                      </div>
                    );
                  }
                  
                  const last12Months = monthlyImpact.slice(-12);
                  const impacts = last12Months.map(m => Math.abs(m.impact || 0));
                  const maxImpact = Math.max(...impacts);
                  
                  return last12Months.map((month, i) => {
                    const impactValue = Math.abs(month.impact || 0);
                    const heightPercent = maxImpact > 0 ? Math.max(10, (impactValue / maxImpact) * 100) : 10;
                    const isProfit = month.impact >= 0;
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end group">
                        <div className="text-center mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className={cn(
                            "text-xs font-semibold",
                            isProfit ? 'text-profit' : 'text-loss'
                          )}>
                            {month.percentGain >= 0 ? '+' : ''}{month.percentGain.toFixed(0)}%
                          </p>
                        </div>
                        <div 
                          className={cn(
                            "w-full rounded-t transition-all cursor-pointer",
                            isProfit ? 'bg-profit hover:bg-profit/80' : 'bg-loss hover:bg-loss/80'
                          )}
                          style={{ height: `${heightPercent}%`, minHeight: '8px' }}
                          title={`${month.monthName}: ${month.btcAmount?.toFixed(6)} BTC @ ${formatCurrency(month.avgBuyPrice)}`}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">
                          {month.monthName?.substring(0, 3)}
                        </p>
                      </div>
                    );
                  });
                })()}
              </div>
              
              <div className="mt-4 pt-4 border-t flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="size-3 bg-profit rounded" />
                  <span className="text-xs text-muted-foreground">Profitable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 bg-loss rounded" />
                  <span className="text-xs text-muted-foreground">Underwater</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trading Statistics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Trading Statistics</CardTitle>
              <CardDescription>Detailed breakdown of your activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {[
                  { label: 'Total Transactions', value: analyticsData?.statistics.totalTransactions || 0 },
                  { label: 'Buy Orders', value: analyticsData?.statistics.totalBuys || 0, color: 'text-profit' },
                  { label: 'Sell Orders', value: analyticsData?.statistics.totalSells || 0, color: 'text-loss' },
                  { label: 'Holding Period', value: analyticsData?.statistics.avgHoldTime ? `${analyticsData.statistics.avgHoldTime} days` : 'N/A' },
                  { label: 'Largest Purchase', value: analyticsData?.statistics.largestPurchase ? `${analyticsData.statistics.largestPurchase.toFixed(8)} BTC` : '0 BTC' },
                  { label: 'Average Buy Amount', value: analyticsData?.statistics.avgBuyAmount ? `${analyticsData.statistics.avgBuyAmount.toFixed(8)} BTC` : '0 BTC' },
                  { label: 'Total BTC Bought', value: analyticsData?.statistics.totalBtcBought ? `${analyticsData.statistics.totalBtcBought.toFixed(8)} BTC` : '0 BTC' },
                  { label: 'Total BTC Sold', value: analyticsData?.statistics.totalBtcSold ? `${analyticsData.statistics.totalBtcSold.toFixed(8)} BTC` : '0 BTC' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={cn("text-sm font-semibold", item.color)}>{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* HODLing Milestones */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrophyIcon className="size-5 text-btc-500" />
              <CardTitle className="text-base">HODLing Journey</CardTitle>
            </div>
            <CardDescription>Track your progress towards Bitcoin milestones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Current Status */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-btc-500/10 via-btc-500/5 to-transparent rounded-xl border border-btc-500/20">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">
                    {currentMilestone?.icon || '🎯'}
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {currentMilestone?.label || 'Starting Your Journey'}
                    </p>
                    <p className="text-2xl font-bold text-btc-500">
                      {currentHoldings.toFixed(8)} BTC
                    </p>
                  </div>
                </div>
                {nextMilestone && (
                  <div className="text-right hidden sm:block">
                    <p className="text-sm text-muted-foreground">Next milestone</p>
                    <p className="font-semibold">{nextMilestone.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {(nextMilestone.amount - currentHoldings).toFixed(8)} BTC to go
                    </p>
                  </div>
                )}
              </div>
              
              {/* Progress Bar */}
              {nextMilestone && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress to {nextMilestone.label}</span>
                    <span className="font-medium">{progressToNext.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-btc-500 to-btc-400 rounded-full transition-all duration-500"
                      style={{ width: `${progressToNext}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Milestone Grid */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {milestones.map((milestone, index) => {
                  const isAchieved = currentHoldings >= milestone.amount;
                  const isCurrent = index === currentMilestoneIndex;
                  
                  return (
                    <div 
                      key={milestone.amount}
                      className={cn(
                        "relative p-3 rounded-xl text-center transition-all",
                        isAchieved 
                          ? "bg-btc-500/10 border-2 border-btc-500/50" 
                          : "bg-muted/50 border border-border opacity-50",
                        isCurrent && "ring-2 ring-btc-500 ring-offset-2 ring-offset-background"
                      )}
                    >
                      {isAchieved && (
                        <div className="absolute -top-1.5 -right-1.5">
                          <CheckCircleIcon className="size-5 text-profit fill-profit/20" />
                        </div>
                      )}
                      <div className="text-2xl mb-1">{milestone.icon}</div>
                      <p className={cn(
                        "text-xs font-bold",
                        isAchieved ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {milestone.amount} BTC
                      </p>
                      <p className={cn(
                        "text-[10px] mt-0.5",
                        isAchieved ? "text-muted-foreground" : "text-muted-foreground/70"
                      )}>
                        {milestone.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
