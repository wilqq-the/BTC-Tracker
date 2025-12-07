'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon } from 'lucide-react';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';
import { cn } from '@/lib/utils';

interface BitcoinChartProps {
  height?: number;
  showTitle?: boolean;
  showTransactions?: boolean;
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
    color: "hsl(24, 94%, 53%)", // Bitcoin Orange
  },
} satisfies ChartConfig;

export default function BitcoinChart({ height = 400, showTitle = true, showTransactions = true }: BitcoinChartProps) {
  const [rawChartData, setRawChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [priceChangePercent24h, setPriceChangePercent24h] = useState<number>(0);
  const [avgBuyPrice, setAvgBuyPrice] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);

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

  // Load average buy price
  useEffect(() => {
  const loadAvgBuyPrice = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
        if (result.success && result.data?.avgBuyPrice) {
          setAvgBuyPrice(result.data.avgBuyPrice);
      }
    } catch (error) {
        console.error('Error loading avg buy price:', error);
    }
  };

    loadAvgBuyPrice();
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
    loadChartData();
  }, [timeRange]);

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
        const buys = dayTxs.filter(t => t.type === 'BUY');
        const sells = dayTxs.filter(t => t.type === 'SELL');
        
        const totalBtc = dayTxs.reduce((sum, t) => sum + t.btc_amount, 0);
        const totalValue = dayTxs.reduce((sum, t) => sum + (t.main_currency_total_amount || t.original_total_amount), 0);
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
    const isProfitable = tx && tx.avgPrice < currentPrice;
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
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
            ${data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <span className="font-medium text-foreground">{tx.totalBtc.toFixed(8)}</span>
           </div>
              <div className="flex justify-between gap-4">
                <span>Avg Price:</span>
                <span className="font-medium text-foreground">
                  ${tx.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
             </div>
              <div className="flex justify-between gap-4">
                <span>Total Value:</span>
                <span className="font-medium text-foreground">
                  ${tx.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
             </div>
              {tx.type !== 'SELL' && currentPrice > 0 && (
                <div className="flex justify-between gap-4 pt-1 border-t mt-1">
                  <span>P&L:</span>
                  <span className={cn("font-medium", isProfitable ? "text-green-500" : "text-red-500")}>
                    {isProfitable ? '+' : ''}{(((currentPrice - tx.avgPrice) / tx.avgPrice) * 100).toFixed(2)}%
                  </span>
             </div>
              )}
             </div>
             </div>
        )}
           </div>
    );
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
        {showTitle && (
        <CardHeader className="pb-2 space-y-0 shrink-0">
          {/* Price and 24h Change */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <ActivityIcon className="size-4 text-btc-500 shrink-0" />
                <h3 className="text-sm font-semibold truncate">Bitcoin Price</h3>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <Badge variant={isPositive ? "default" : "destructive"} className="gap-1 shrink-0">
                  {isPositive ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
                  {isPositive ? '+' : ''}{priceChangePercent24h.toFixed(2)}%
                </Badge>
                </div>
              <p className="text-xs text-muted-foreground">
                {isPositive ? '+' : ''}${Math.abs(priceChange24h).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (24h)
              </p>
              </div>
            </div>
            
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {/* Time Range */}
            <div className="flex flex-wrap gap-1">
              {timeRangeButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={timeRange === btn.value ? "default" : "outline"}
                size="sm"
                  onClick={() => setTimeRange(btn.value)}
                  className={timeRange === btn.value ? "bg-btc-500 hover:bg-btc-600" : "text-xs px-2 h-7"}
              >
                  {btn.label}
                </Button>
            ))}
          </div>

            {/* Chart Type */}
            <div className="flex gap-1 ml-auto shrink-0">
              <Button
                variant={chartType === 'area' ? "default" : "outline"}
                  size="sm"
                onClick={() => setChartType('area')}
                className={chartType === 'area' ? "bg-btc-500 hover:bg-btc-600 text-xs h-7" : "text-xs h-7"}
              >
                Area
              </Button>
              <Button
                variant={chartType === 'line' ? "default" : "outline"}
                size="sm"
                onClick={() => setChartType('line')}
                className={chartType === 'line' ? "bg-btc-500 hover:bg-btc-600 text-xs h-7" : "text-xs h-7"}
              >
                Line
              </Button>
          </div>
        </div>
        </CardHeader>
      )}

      <CardContent className="flex-1 min-h-0 pb-4 flex flex-col overflow-hidden relative">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading chart...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-price)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-price)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    domain={stats ? [
                      Math.floor(stats.low * 0.98 / 1000) * 1000,
                      Math.ceil(stats.high * 1.02 / 1000) * 1000
                    ] : ['auto', 'auto']}
                  />
                  {avgBuyPrice > 0 && (
                    <ReferenceLine 
                      y={avgBuyPrice} 
                      stroke="hsl(142, 71%, 45%)" 
                      strokeDasharray="3 3"
                      label={{ value: 'Avg Buy', position: 'right', fill: 'hsl(142, 71%, 45%)', fontSize: 12 }}
                    />
                  )}
                  <ChartTooltip content={<CustomTooltip />} />
                  {chartType === 'area' ? (
                    <Area
                      dataKey="price"
                      type="monotone"
                      fill="url(#fillPrice)"
                      fillOpacity={0.4}
                      stroke="var(--color-price)"
                      strokeWidth={2}
                      dot={showTransactions ? renderTransactionDot : false}
                      activeDot={showTransactions ? { r: 4, fill: 'var(--color-price)' } : { r: 4 }}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Line
                      dataKey="price"
                      type="monotone"
                      stroke="var(--color-price)"
                      strokeWidth={2}
                      dot={showTransactions ? renderTransactionDot : false}
                      activeDot={showTransactions ? { r: 4, fill: 'var(--color-price)' } : { r: 4 }}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ChartContainer>
      </div>

            {/* Transaction Legend */}
            {hasTransactions && (
              <div className="flex items-center justify-center gap-4 py-3 text-xs text-muted-foreground shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Buy</span>
            </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Sell</span>
            </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span>Mixed</span>
              </div>
          </div>
            )}

            {/* Stats Footer */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 pt-4 border-t shrink-0">
          <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">{timeRange} High</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">
                    ${stats.high.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
          </div>
          <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">{timeRange} Low</p>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">
                    ${stats.low.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
          </div>
          <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Range</p>
                  <p className="text-sm font-bold text-btc-500">
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
