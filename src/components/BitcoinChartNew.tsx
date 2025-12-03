'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon } from 'lucide-react';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';

interface BitcoinChartProps {
  height?: number;
  showTitle?: boolean;
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';
type ChartType = 'area' | 'line';

interface ChartData {
  date: string;
  price: number;
  timestamp: number;
}

// Chart configuration for shadcn
const chartConfig = {
  price: {
    label: "Bitcoin Price",
    color: "hsl(24, 94%, 53%)", // Bitcoin Orange
  },
} satisfies ChartConfig;

export default function BitcoinChartNew({ height = 400, showTitle = true }: BitcoinChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [priceChangePercent24h, setPriceChangePercent24h] = useState<number>(0);
  const [stats, setStats] = useState<{ high: number; low: number; range: number } | null>(null);
  const [avgBuyPrice, setAvgBuyPrice] = useState<number>(0);

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

    // Subscribe to real-time updates
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

  // Load chart data when time range changes
  useEffect(() => {
    loadChartData();
  }, [timeRange]);

  // Calculate stats when data changes
  useEffect(() => {
    if (chartData.length > 0) {
      const prices = chartData.map(d => d.price);
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const range = ((high - low) / low) * 100;
      setStats({ high, low, range });
    }
  }, [chartData]);

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
        const formatted: ChartData[] = result.data.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: timeRange === '1Y' || timeRange === '3Y' || timeRange === '5Y' || timeRange === 'ALL' ? 'numeric' : undefined 
          }),
          price: item.close_usd,
          timestamp: new Date(item.date).getTime(),
        }));

        setChartData(formatted);
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

      <CardContent className="flex-1 min-h-0 pb-4 flex flex-col overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading chart...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                {chartType === 'area' ? (
                  <AreaChart data={chartData}>
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
                        label={{ value: 'Avg Buy', position: 'right', fill: 'hsl(142, 71%, 45%)' }}
                      />
                    )}
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          className="w-48"
                          labelFormatter={(value) => {
                            return new Date(chartData.find(d => d.date === value)?.timestamp || Date.now()).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            });
                          }}
                          formatter={(value) => [
                            `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            'Price'
                          ]}
                        />
                      }
                    />
                    <Area
                      dataKey="price"
                      type="monotone"
                      fill="url(#fillPrice)"
                      fillOpacity={0.4}
                      stroke="var(--color-price)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={chartData}>
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
                        label={{ value: 'Avg Buy', position: 'right', fill: 'hsl(142, 71%, 45%)' }}
                      />
                    )}
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          className="w-48"
                          labelFormatter={(value) => {
                            return new Date(chartData.find(d => d.date === value)?.timestamp || Date.now()).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            });
                          }}
                          formatter={(value) => [
                            `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            'Price'
                          ]}
                        />
                      }
                    />
                    <Line
                      dataKey="price"
                      type="monotone"
                      stroke="var(--color-price)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ChartContainer>
            </div>

            {/* Stats Footer */}
            {stats && (
              <div className="grid grid-cols-3 gap-4 pt-3 border-t shrink-0">
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

