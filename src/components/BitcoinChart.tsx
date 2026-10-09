'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { 
  ChartContainer,
  ChartTooltip,
  ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { formatCurrency } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useBtcUnit } from '@/hooks/use-btc-unit';

interface BitcoinChartProps {
  height?: number;
  showTitle?: boolean;
  showTransactions?: boolean;
  /** Replaces the BTC price block in the header (the dashboard hero puts the portfolio value here) */
  headerLeft?: React.ReactNode;
  /** Hide the high/low/range footer for a cleaner hero */
  showStats?: boolean;
  /** Fewer range options and no Area/Line toggle (dashboard hero) */
  compact?: boolean;
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';
type ChartType = 'area' | 'line';

interface ChartDataPoint {
  date: string;
  price: number;
  timestamp: number;
}

interface TransactionMarker {
  type: 'BUY' | 'SELL' | 'MIXED';
  count: number;
  totalBtc: number;
  totalValue: number;
  avgPrice: number;
}

interface ChartDataWithTx extends ChartDataPoint {
  transaction?: TransactionMarker;
}

// Chart configuration for shadcn
const chartConfig = {
  price: {
    label: "Bitcoin Price",
    color: "hsl(var(--primary))", // Bitcoin Orange
  },
} satisfies ChartConfig;

export default function BitcoinChart({
  height = 400,
  showTitle = true,
  showTransactions = true,
  headerLeft,
  showStats = true,
  compact = false,
}: BitcoinChartProps) {
  const { formatBtc } = useBtcUnit();
  const [rawChartData, setRawChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [priceChangePercent24h, setPriceChangePercent24h] = useState<number>(0);
  const [avgBuyPrice, setAvgBuyPrice] = useState<number>(0);
  const [currentPriceMain, setCurrentPriceMain] = useState<number>(0); // BTC price in user's main currency
  const [mainCurrency, setMainCurrency] = useState<string>('USD');
  const [secondaryCurrency, setSecondaryCurrency] = useState<string>('');
  const [mainToSecondaryRate, setMainToSecondaryRate] = useState<number>(1);
  const [transactions, setTransactions] = useState<any[]>([]);
  // The line draws itself in left-to-right on load and on range change,
  // then animation switches off so live price ticks don't replay it.
  const [drawn, setDrawn] = useState(false);

  // Load current price and subscribe to updates
  useEffect(() => {
    const loadCurrentPrice = async () => {
      try {
        const priceData = await BitcoinPriceClient.getCurrentPrice();
        setCurrentPrice(priceData.price);
        setPriceChange24h(priceData.priceChange24h || 0);
        setPriceChangePercent24h(priceData.priceChangePercent24h || 0);
    } catch (error) {
        console.error('Error loading current price:', error);
      }
    };

    loadCurrentPrice();

    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice) => {
      setCurrentPrice(newPrice.price);
      setPriceChange24h(newPrice.priceChange24h || 0);
      setPriceChangePercent24h(newPrice.priceChangePercent24h || 0);
    });

    return unsubscribe;
  }, []);

  // Load average buy price and current price in main currency
  useEffect(() => {
  const loadPortfolioData = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
        if (result.success && result.data) {
          if (result.data.avgBuyPrice) {
            setAvgBuyPrice(result.data.avgBuyPrice);
          }
          // Get current BTC price in user's main currency for consistent P&L calculation
          if (result.data.currentBtcPrice) {
            setCurrentPriceMain(result.data.currentBtcPrice);
          }
          if (result.data.mainCurrency) {
            setMainCurrency(result.data.mainCurrency);
          }
          if (result.data.secondaryCurrency) {
            setSecondaryCurrency(result.data.secondaryCurrency);
          }
          if (result.data.mainToSecondaryRate) {
            setMainToSecondaryRate(result.data.mainToSecondaryRate);
          }
      }
    } catch (error) {
        console.error('Error loading portfolio data:', error);
    }
  };

    loadPortfolioData();
  }, []);

  // Load transactions
  useEffect(() => {
    if (showTransactions) {
      loadTransactions();
    }
  }, [showTransactions]);

  const loadTransactions = async () => {
    try {
      const response = await fetch('/api/transactions?limit=1000');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setTransactions(result.data.filter((t: any) => t.type === 'BUY' || t.type === 'SELL'));
      }
      } catch (error) {
      console.error('Error loading transactions:', error);
      }
  };

  // Load chart data when time range changes
  useEffect(() => {
    setDrawn(false);
    loadChartData();
  }, [timeRange]);

  useEffect(() => {
    if (loading || rawChartData.length === 0) return;
    const timer = setTimeout(() => setDrawn(true), 1600);
    return () => clearTimeout(timer);
  }, [loading, rawChartData]);

  // Compute chart data with transactions merged (derived state, no infinite loop)
  const chartData: ChartDataWithTx[] = useMemo(() => {
    if (rawChartData.length === 0) return [];
    if (!showTransactions || transactions.length === 0) {
      return rawChartData;
    }

    // Group transactions by date
    const txByDate = new Map<string, any[]>();
    transactions.forEach(tx => {
      const dateStr = new Date(tx.transaction_date).toISOString().split('T')[0];
      if (!txByDate.has(dateStr)) {
        txByDate.set(dateStr, []);
      }
      txByDate.get(dateStr)!.push(tx);
    });

    // Merge transactions with chart data
    return rawChartData.map(dataPoint => {
      const dateStr = new Date(dataPoint.timestamp).toISOString().split('T')[0];
      const dayTxs = txByDate.get(dateStr);
      
      if (dayTxs && dayTxs.length > 0) {
        const buys = dayTxs.filter((t: any) => t.type === 'BUY');
        const sells = dayTxs.filter((t: any) => t.type === 'SELL');
        
        const totalBtc = dayTxs.reduce((sum: number, t: any) => sum + t.btc_amount, 0);
        // Use main_currency_total_amount consistently (already converted to user's main currency by API)
        const totalValue = dayTxs.reduce((sum: number, t: any) => sum + (t.main_currency_total_amount || 0), 0);
        // Calculate average price per BTC in main currency
        const avgPrice = totalBtc > 0 ? totalValue / totalBtc : 0;
        
        let type: 'BUY' | 'SELL' | 'MIXED' = 'BUY';
        if (buys.length > 0 && sells.length > 0) {
          type = 'MIXED';
        } else if (sells.length > 0) {
          type = 'SELL';
        }
        
        return {
          ...dataPoint,
          transaction: {
            type,
            count: dayTxs.length,
            totalBtc,
            totalValue,
            avgPrice,
          },
        };
      }

      return dataPoint;
    });
  }, [rawChartData, transactions, showTransactions]);

  // Calculate stats from chart data
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const prices = chartData.map(d => d.price);
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const range = ((high - low) / low) * 100;
    return { high, low, range };
  }, [chartData]);

  // Check if there are any transactions in the visible data
  const hasTransactions = useMemo(() => {
    return showTransactions && chartData.some(d => d.transaction);
  }, [chartData, showTransactions]);

  const loadChartData = async () => {
    setLoading(true);
    try {
      const days = getTimeRangeInDays(timeRange);
      const endpoint = timeRange === '1D' 
        ? `/api/historical-data?days=1`
        : days >= 3650 
          ? `/api/historical-data?all=true`
          : `/api/historical-data?days=${days}`;

      const response = await fetch(endpoint);
      const result = await response.json();
        
      if (result.success && result.data.length > 0) {
        const formatted: ChartDataPoint[] = result.data.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: timeRange === '1Y' || timeRange === '3Y' || timeRange === '5Y' || timeRange === 'ALL' ? 'numeric' : undefined 
          }),
          price: item.close_usd,
          timestamp: new Date(item.date).getTime(),
        }));

        setRawChartData(formatted);
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRangeInDays = (range: TimeRange): number => {
    switch (range) {
      case '1D': return 1;
      case '1W': return 7;
      case '1M': return 30;
      case '3M': return 90;
      case '6M': return 180;
      case '1Y': return 365;
      case '3Y': return 365 * 3;
      case '5Y': return 365 * 5;
      case 'ALL': return 3650;
      default: return 180;
    }
  };

  const timeRangeButtons: { label: string; value: TimeRange }[] = [
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: '3Y', value: '3Y' },
    { label: '5Y', value: '5Y' },
    { label: 'ALL', value: 'ALL' },
  ];

  const isPositive = priceChangePercent24h >= 0;

  // Chart data is stored in USD; show axis/stats/tooltip in the display currency
  const displayCurrency = secondaryCurrency || mainCurrency;
  const usdToDisplay = (currentPrice > 0 && currentPriceMain > 0 ? currentPriceMain / currentPrice : 1) * mainToSecondaryRate;
  const currencySymbol = formatCurrency(0, displayCurrency).replace(/[\d.,\s]/g, '') || '$';
  const compactMoney = (usd: number) => `${currencySymbol}${Math.round((usd * usdToDisplay) / 1000)}k`;
  const wholeMoney = (usd: number) => formatCurrency(usd * usdToDisplay, displayCurrency).replace(/\.\d{2}(?=\D*$)/, '');
  // avgBuyPrice is in the main currency; the chart's y-axis is USD
  const avgBuyUsd = currentPriceMain > 0 && currentPrice > 0 ? avgBuyPrice * (currentPrice / currentPriceMain) : avgBuyPrice;

  const visibleRanges = compact
    ? timeRangeButtons.filter((b) => ['1W', '1M', '3M', '6M', '1Y', 'ALL'].includes(b.value))
    : timeRangeButtons;

  // Custom dot renderer for the line/area - only renders dots for transactions
  const renderTransactionDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload?.transaction || cx === undefined || cy === undefined) return null;

    const tx = payload.transaction as TransactionMarker;
    const size = 4; // Small, subtle dot
    
    let fill = '#22c55e'; // Green for BUY
    if (tx.type === 'SELL') {
      fill = '#ef4444'; // Red for SELL
    } else if (tx.type === 'MIXED') {
      fill = '#8b5cf6'; // Purple for MIXED
    }

    return (
      <circle
        key={`tx-${payload.timestamp}`}
        cx={cx}
        cy={cy}
        r={size}
        fill={fill}
        stroke="white"
        strokeWidth={1}
      />
    );
  };

  // Custom tooltip content
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload as ChartDataWithTx;
    const tx = data.transaction;
    // Use currentPriceMain (BTC price in user's main currency) for consistent P&L calculation
    // This ensures we compare EUR with EUR, USD with USD, etc.
    const priceForComparison = currentPriceMain || currentPrice;
    const isProfitable = tx && tx.avgPrice < priceForComparison;
    
    return (
      <div className="bg-popover rounded-2xl shadow-lg p-3.5 text-sm min-w-[200px]">
        {/* Date and Price */}
        <p className="font-medium mb-1">
          {new Date(data.timestamp).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <p className="text-muted-foreground mb-2">
          Price: <span className="font-medium text-foreground">
            {formatCurrency(data.price * usdToDisplay, displayCurrency)}
          </span>
        </p>
        
        {/* Transaction details if present */}
        {tx && (
          <div className="border-t pt-2 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                tx.type === 'BUY' ? "bg-green-500" : tx.type === 'SELL' ? "bg-red-500" : "bg-purple-500"
              )} />
              <span className="font-semibold">
                {tx.count} {tx.type}{tx.count > 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-1 text-muted-foreground text-xs">
              <div className="flex justify-between gap-4">
                <span>Total BTC:</span>
                <span className="font-medium text-foreground">{formatBtc(tx.totalBtc)}</span>
           </div>
              <div className="flex justify-between gap-4">
                <span>Avg Price ({mainCurrency}):</span>
                <span className="font-medium text-foreground">
                  {tx.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
             </div>
              <div className="flex justify-between gap-4">
                <span>Total ({mainCurrency}):</span>
                <span className="font-medium text-foreground">
                  {tx.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
             </div>
              {tx.type !== 'SELL' && priceForComparison > 0 && (
                <div className="flex justify-between gap-4 pt-1 border-t mt-1">
                  <span>P&L:</span>
                  <span className={cn("font-medium", isProfitable ? "text-green-500" : "text-red-500")}>
                    {isProfitable ? '+' : ''}{(((priceForComparison - tx.avgPrice) / tx.avgPrice) * 100).toFixed(2)}%
                  </span>
             </div>
              )}
             </div>
             </div>
        )}
           </div>
    );
  };

  const priceBlock = (
    <div className="space-y-1.5 min-w-0">
      <h3 className="text-[15px] font-semibold text-muted-foreground">Bitcoin price</h3>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-3xl font-extrabold tracking-tight">
          {formatCurrency(currentPriceMain * mainToSecondaryRate, secondaryCurrency || mainCurrency)}
        </span>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold",
          isPositive ? "bg-tint-green text-tint-green-fg" : "bg-tint-red text-tint-red-fg"
        )}>
          {isPositive ? <TrendingUpIcon className="size-3.5" /> : <TrendingDownIcon className="size-3.5" />}
          {isPositive ? '+' : ''}{priceChangePercent24h.toFixed(2)}%
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {isPositive ? '+' : '-'}{formatCurrency(Math.abs(priceChange24h) * (currentPrice > 0 ? currentPriceMain / currentPrice : 1) * mainToSecondaryRate, secondaryCurrency || mainCurrency)} in 24h
      </p>
    </div>
  );

  return (
    <Card className="rounded-2xl h-full flex flex-col gap-4 overflow-hidden">
      {showTitle && (
        <CardHeader className="space-y-0 shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 basis-[300px]">{headerLeft ?? priceBlock}</div>
            <div className="flex flex-col items-end gap-2">
              <SegmentedControl<TimeRange>
                aria-label="Time range"
                options={visibleRanges.map((b) => ({ ...b, label: b.value === 'ALL' ? 'All' : b.label }))}
                value={timeRange}
                onChange={setTimeRange}
              />
              {!compact && (
                <SegmentedControl<ChartType>
                  aria-label="Chart type"
                  size="sm"
                  options={[{ label: 'Area', value: 'area' }, { label: 'Line', value: 'line' }]}
                  value={chartType}
                  onChange={setChartType}
                />
              )}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading chart...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-[120px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => compactMoney(value)}
                    domain={stats ? [
                      Math.floor(stats.low * 0.98 / 1000) * 1000,
                      Math.ceil(stats.high * 1.02 / 1000) * 1000
                    ] : ['auto', 'auto']}
                  />
                  {avgBuyPrice > 0 && (
                    <ReferenceLine
                      y={avgBuyUsd}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      label={{ value: 'Your avg', position: 'insideTopLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                  )}
                  <ChartTooltip content={<CustomTooltip />} />
                  {chartType === 'area' ? (
                    <Area
                      dataKey="price"
                      type="monotone"
                      fill="url(#fillPrice)"
                      fillOpacity={1}
                      stroke="var(--color-price)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      dot={showTransactions ? renderTransactionDot : false}
                      activeDot={showTransactions ? { r: 5, fill: 'var(--color-price)' } : { r: 5 }}
                      isAnimationActive={!drawn}
                      animationDuration={1400}
                      animationEasing="ease-out"
                    />
                  ) : (
                    <Line
                      dataKey="price"
                      type="monotone"
                      stroke="var(--color-price)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      dot={showTransactions ? renderTransactionDot : false}
                      activeDot={showTransactions ? { r: 5, fill: 'var(--color-price)' } : { r: 5 }}
                      isAnimationActive={!drawn}
                      animationDuration={1400}
                      animationEasing="ease-out"
                    />
                  )}
                </ComposedChart>
              </ChartContainer>
      </div>

            {/* Transaction Legend — only the marker types actually on the chart */}
            {hasTransactions && (
              <div className="flex items-center justify-center gap-4 py-3 text-xs font-medium text-muted-foreground shrink-0">
                {[
                  { type: 'BUY', label: 'Buy', color: 'bg-green-500' },
                  { type: 'SELL', label: 'Sell', color: 'bg-red-500' },
                  { type: 'MIXED', label: 'Buy & sell', color: 'bg-violet-500' },
                ]
                  .filter((item) => chartData.some((d) => d.transaction?.type === item.type))
                  .map((item) => (
                    <div key={item.type} className="flex items-center gap-1.5">
                      <div className={cn('size-2.5 rounded-full', item.color)} />
                      <span>{item.label}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Stats Footer */}
            {stats && showStats && (
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-3 shrink-0">
          <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">{timeRange} High</p>
                  <p className="text-sm font-bold text-tint-green-fg">
                    {wholeMoney(stats.high)}
                  </p>
          </div>
          <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">{timeRange} Low</p>
                  <p className="text-sm font-bold text-tint-red-fg">
                    {wholeMoney(stats.low)}
                  </p>
          </div>
          <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Range</p>
                  <p className="text-sm font-bold text-primary-strong">
                    {stats.range.toFixed(1)}%
                  </p>
          </div>
        </div>
      )}
          </>
        )}
      </CardContent>
    </Card>
  );
} 
