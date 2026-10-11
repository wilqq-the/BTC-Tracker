'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  CartesianGrid,
} from 'recharts';
import { DownloadIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCountUp } from '@/hooks/use-count-up';
import { formatCurrency as formatMoney } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import MilestonesWidget from '@/components/widgets/MilestonesWidget';
import { useBtcUnit } from '@/hooks/use-btc-unit';

interface MonthBreakdown {
  month: string;        // YYYY-MM
  monthName: string;    // "Jan 2025"
  buys: number;
  sells: number;
  totalBought: number;
  totalSold: number;
  avgBuyPrice: number;  // main currency
  netBtc: number;
}

interface AnalyticsData {
  totalBtc: number;
  totalInvested: number;
  avgBuyPrice: number;
  currentBtcPrice: number;
  totalPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  roi: number;
  annualizedReturn: number;
  winRate: number;
  holdingDays: number;
  totalBuys: number;
  totalSells: number;
  totalBtcBought: number;
  totalBtcSold: number;
  largestPurchase: number;
  avgBuyAmount: number;
  monthlyBreakdown: MonthBreakdown[];
  mainCurrency: string;
  secondaryCurrency?: string;
  mainToSecondaryRate?: number;
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

// Green for gains, red for losses, quiet grey for exactly zero
const tone = (n: number) => (n > 0 ? 'text-tint-green-fg' : n < 0 ? 'text-tint-red-fg' : 'text-muted-foreground');
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '');
// Axis labels in sats get big fast: 45,000,000 → "45M"
const compactSats = (btcAmount: number) => {
  const sats = Math.round(btcAmount * 100_000_000);
  if (sats >= 1_000_000) return `${parseFloat((sats / 1_000_000).toFixed(1))}M`;
  if (sats >= 1_000) return `${parseFloat((sats / 1_000).toFixed(1))}k`;
  return String(sats);
};
const btc = (n: number) => (n >= 1 ? n.toFixed(2) : n.toFixed(8)).replace(/\.?0+$/, '') || '0';

export default function AnalyticsPage() {
  const { unit, formatBtc } = useBtcUnit();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/portfolio-metrics?detailed=true');
        const result = await response.json();
        if (result.success && result.data) setData(result.data);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mainCurrency = data?.mainCurrency || 'USD';
  const currency = data?.secondaryCurrency || mainCurrency;
  const rate = data?.secondaryCurrency ? data?.mainToSecondaryRate || 1 : 1;
  // Whole units for big figures; values arrive in the main currency
  const money = (main: number, decimals = 0) => {
    const text = formatMoney(Math.abs(main) * rate, currency);
    return decimals === 0 ? text.replace(/\.\d{2}(?=\D*$)/, '') : text;
  };

  const totalReturn = useCountUp(data ? data.totalPnL * rate : 0);

  // Each month's buys valued at today's price
  const monthly = useMemo(() => {
    if (!data) return [];
    return data.monthlyBreakdown
      .filter((m) => m.buys > 0 && m.avgBuyPrice > 0)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-18)
      .map((m) => ({
        label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        gain: ((data.currentBtcPrice - m.avgBuyPrice) / m.avgBuyPrice) * 100,
        bought: m.totalBought,
        avgPrice: m.avgBuyPrice,
      }));
  }, [data]);

  // Running total of BTC held for every month from the first buy to now
  const accumulation = useMemo(() => {
    if (!data || data.monthlyBreakdown.length === 0) return [];
    const netByMonth = new Map(data.monthlyBreakdown.map((m) => [m.month, m.netBtc]));
    const first = Array.from(netByMonth.keys()).sort()[0];
    const cursor = new Date(`${first}-01T00:00:00`);
    const end = new Date();
    const points: { label: string; btc: number }[] = [];
    let running = 0;
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      running += netByMonth.get(key) ?? 0;
      points.push({
        label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        btc: running,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return points;
  }, [data]);

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/transactions?limit=10000');
      const result = await response.json();
      
      if (!result.success || !result.data) {
        toast({ title: 'Failed to load transactions for export', variant: 'destructive' });
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
      toast({ title: 'Failed to export CSV', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading analytics" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Analytics couldn&apos;t load.</p>
        <p className="text-sm text-muted-foreground">Check that the server is running, then reload the page.</p>
      </div>
    );
  }

  const firstBuy = new Date(Date.now() - data.holdingDays * 86_400_000)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const priceVsAvg = data.avgBuyPrice > 0 ? ((data.currentBtcPrice - data.avgBuyPrice) / data.avgBuyPrice) * 100 : 0;
  const hasSells = data.totalSells > 0;

  // Price ladder: place average buy and today's price on one scale
  const ladderMin = Math.min(data.avgBuyPrice, data.currentBtcPrice) * 0.9;
  const ladderMax = Math.max(data.avgBuyPrice, data.currentBtcPrice) * 1.05;
  const pos = (p: number) => `${((p - ladderMin) / (ladderMax - ladderMin || 1)) * 100}%`;

  const activity = [
    { label: 'Buys', value: String(data.totalBuys) },
    { label: 'Sells', value: String(data.totalSells) },
    { label: 'Holding for', value: `${data.holdingDays} days` },
    { label: 'First buy', value: firstBuy },
    { label: 'Largest buy', value: formatBtc(data.largestPurchase, { trim: true }) },
    { label: 'Average buy size', value: formatBtc(data.avgBuyAmount, { trim: true }) },
    { label: 'Bought in total', value: formatBtc(data.totalBtcBought, { trim: true }) },
    { label: 'Sold in total', value: formatBtc(data.totalBtcSold, { trim: true }) },
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Performance */}
      <Card className="rounded-2xl">
        <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-muted-foreground">Total return</span>
              <Button variant="outline" size="sm" className="rounded-full font-semibold" onClick={exportToCSV} disabled={exporting}>
                <DownloadIcon className="mr-1.5 size-4" />
                {exporting ? 'Exporting...' : 'Export tax report'}
              </Button>
            </div>
            <span className={cn('text-4xl font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-5xl', tone(data.totalPnL))}>
              {signed(data.totalPnL)}{formatMoney(Math.abs(totalReturn), currency).replace(/\.\d{2}(?=\D*$)/, '')}
            </span>
            <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
              <span className={cn('font-bold', tone(data.roi))}>{signed(data.roi)}{Math.abs(data.roi).toFixed(2)}%</span> on {money(data.totalInvested)} invested.
              {data.holdingDays >= 30 && (
                <> That&apos;s <span className={cn('font-bold', tone(data.annualizedReturn))}>{signed(data.annualizedReturn)}{Math.abs(data.annualizedReturn).toFixed(1)}% a year</span> since your first buy on {firstBuy}.</>
              )}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-secondary p-4">
                <div className="text-[13px] font-semibold text-muted-foreground">Unrealized</div>
                <div className={cn('mt-1 text-lg font-extrabold tabular-nums', tone(data.unrealizedPnL))}>
                  {signed(data.unrealizedPnL)}{money(data.unrealizedPnL)}
                </div>
                <div className="text-xs text-muted-foreground">On the bitcoin you still hold</div>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <div className="text-[13px] font-semibold text-muted-foreground">Realized</div>
                {hasSells ? (
                  <>
                    <div className={cn('mt-1 text-lg font-extrabold tabular-nums', tone(data.realizedPnL))}>
                      {signed(data.realizedPnL)}{money(data.realizedPnL)}
                    </div>
                    <div className="text-xs text-muted-foreground">{data.winRate.toFixed(0)}% of your sales made a profit</div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-lg font-extrabold text-muted-foreground">Nothing yet</div>
                    <div className="text-xs text-muted-foreground">Appears after your first sale</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Price ladder: average buy vs today */}
          <div className="flex flex-col justify-center gap-5 rounded-2xl bg-secondary p-5">
            <p className="text-[15px] font-semibold">
              Bitcoin is{' '}
              <span className={cn('font-extrabold', tone(priceVsAvg))}>
                {Math.abs(priceVsAvg).toFixed(1)}% {priceVsAvg >= 0 ? 'above' : 'below'}
              </span>{' '}
              your average buy price.
            </p>
            <div className="relative mx-2 h-16">
              <div className="absolute inset-x-0 top-7 h-1.5 rounded-full bg-card" />
              <div
                className={cn('absolute top-7 h-1.5 rounded-full', priceVsAvg >= 0 ? 'bg-tint-green-fg/60' : 'bg-tint-red-fg/60')}
                style={{
                  left: pos(Math.min(data.avgBuyPrice, data.currentBtcPrice)),
                  width: `calc(${pos(Math.max(data.avgBuyPrice, data.currentBtcPrice))} - ${pos(Math.min(data.avgBuyPrice, data.currentBtcPrice))})`,
                }}
              />
              <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: pos(data.avgBuyPrice) }}>
                <div className="mx-auto mt-[22px] size-4 rounded-full border-[3px] border-card bg-foreground" />
              </div>
              <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: pos(data.currentBtcPrice) }}>
                <div className="mx-auto mt-[22px] size-4 rounded-full border-[3px] border-card bg-primary" />
              </div>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <div>
                <div className="font-semibold text-muted-foreground">Your average</div>
                <div className="text-base font-extrabold tabular-nums">{money(data.avgBuyPrice)}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-muted-foreground">Bitcoin today</div>
                <div className="text-base font-extrabold tabular-nums">{money(data.currentBtcPrice)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly buys at today's price */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">Each month&apos;s buys at today&apos;s price</CardTitle>
            <CardDescription className="text-[13px]">How far above or below today&apos;s price you bought, month by month.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Your monthly buys will show here once you add a purchase.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`} />
                    <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeOpacity={0.35} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--secondary))' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const m = payload[0].payload as (typeof monthly)[number];
                        return (
                          <div className="rounded-2xl bg-popover p-3 text-sm shadow-lg">
                            <div className="font-bold">{m.label}</div>
                            <div className="text-muted-foreground">Bought {formatBtc(m.bought, { trim: true })} at {money(m.avgPrice)}</div>
                            <div className={cn('font-bold', tone(m.gain))}>{signed(m.gain)}{Math.abs(m.gain).toFixed(1)}% today</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="gain" radius={[8, 8, 8, 8]} maxBarSize={56} animationDuration={700}>
                      {monthly.map((m, i) => (
                        <Cell key={i} fill={m.gain >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              {activity.map((item) => (
                <div key={item.label}>
                  <dt className="text-[13px] font-semibold text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 text-[15px] font-bold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Stack over time */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">Your stack over time</CardTitle>
            <CardDescription className="text-[13px]">Total bitcoin held at the end of each month since your first buy.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={accumulation} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="stackFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => (unit === 'sats' ? compactSats(v) : btc(v))} />
                  <Tooltip
                    cursor={{ stroke: 'hsl(var(--border))' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof accumulation)[number];
                      return (
                        <div className="rounded-2xl bg-popover p-3 text-sm shadow-lg">
                          <div className="font-bold">{p.label}</div>
                          <div className="text-muted-foreground">{formatBtc(p.btc, { trim: true })} held</div>
                        </div>
                      );
                    }}
                  />
                  <Area type="stepAfter" dataKey="btc" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#stackFill)" animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="min-h-[300px]">
          <MilestonesWidget id="analytics-milestones" />
        </div>
      </div>
    </div>
  );
}
