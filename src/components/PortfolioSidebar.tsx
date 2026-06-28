'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCwIcon, XIcon, PlusIcon, TrendingUpIcon, CoinsIcon, ChevronDownIcon,
  ArrowUpRightIcon, ArrowDownRightIcon,
} from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { BitcoinPriceClient, BitcoinPriceData } from '@/lib/bitcoin-price-client';
import { PortfolioSummaryData } from '@/lib/bitcoin-price-service';
import { AppSettings } from '@/lib/types';
import AddTransactionModal from './AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface ConvertedPortfolioData {
  totalBTC: number;
  totalSatoshis: number;
  totalTransactions: number;

  // Main currency values
  mainCurrency: string;
  averageBuyPriceMain: number;
  currentBTCPriceMain: number;
  currentPortfolioValueMain: number;
  unrealizedPnLMain: number;
  unrealizedPnLPercentage: number;
  portfolioChange24hMain: number;
  portfolioChange24hPercentage: number;
  totalInvestedMain: number;
  totalFeesMain: number;

  // Secondary currency values
  secondaryCurrency: string;
  averageBuyPriceSecondary: number;
  currentBTCPriceSecondary: number;
  currentPortfolioValueSecondary: number;
  unrealizedPnLSecondary: number;
  portfolioChange24hSecondary: number;
  totalInvestedSecondary: number;
  totalFeesSecondary: number;
}

interface PortfolioSidebarProps {
  onClose?: () => void;
}

const WALLET_COLORS = [
  'bg-blue-500', 'bg-primary', 'bg-emerald-500', 'bg-violet-500',
  'bg-pink-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500',
];

type WalletEntry = { id: number; name: string; emoji: string | null; type: string; btcBalance: number; includeInPortfolio: boolean };

/** Animate a number toward its target value (respects prefers-reduced-motion). */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = prevRef.current;
    const to = target;
    if (reduce || from === to) {
      prevRef.current = to;
      setValue(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function WalletSection({ portfolioData }: { portfolioData: any }) {
  const [open, setOpen] = useState(false);
  const wallets: WalletEntry[] = portfolioData.walletBreakdown ?? [];
  const hasNamed = wallets.length > 0;

  // Build segments for the mini bar
  type Segment = { id: number; name: string; btcBalance: number };
  const segments: Segment[] = hasNamed
    ? wallets.filter(w => w.includeInPortfolio && w.btcBalance > 0).map(w => ({ id: w.id, name: w.name, btcBalance: w.btcBalance }))
    : [
        { id: -1, name: 'Cold', btcBalance: portfolioData.coldWalletBtc as number },
        { id: -2, name: 'Hot',  btcBalance: Math.abs(portfolioData.hotWalletBtc as number) },
      ];
  const barTotal = segments.reduce((s, w) => s + w.btcBalance, 0) || 1;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full group">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Wallets{hasNamed ? ` · ${wallets.length}` : ''}
          </p>
          <ChevronDownIcon className={`size-3 text-muted-foreground transition-transform duration-300 group-hover:text-foreground ${open ? 'rotate-180' : ''}`} />
        </div>
        {/* Mini distribution bar — always visible */}
        <div className="h-2 bg-muted rounded-full overflow-hidden flex gap-0.5">
          {segments.map((w, i) => (
            <div
              key={w.id}
              className={`${WALLET_COLORS[i % WALLET_COLORS.length]} rounded-full transition-all duration-500 ease-out hover:opacity-80`}
              style={{ width: `${(w.btcBalance / barTotal) * 100}%` }}
              title={`${w.name}: ${w.btcBalance.toFixed(8)} ₿`}
            />
          ))}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-fadeIn">
        <div className="mt-2 space-y-1.5">
          {hasNamed ? (
            wallets.map((w, i) => (
              <div key={w.id} className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`size-2 rounded-full shrink-0 ${WALLET_COLORS[i % WALLET_COLORS.length]}`} />
                  <span className="text-sm shrink-0">{w.emoji || (w.type === 'cold' ? '❄️' : '🔥')}</span>
                  <span className="text-xs text-muted-foreground truncate">{w.name}</span>
                  {!w.includeInPortfolio && <span className="text-xs text-muted-foreground/40 shrink-0">(excl.)</span>}
                </div>
                <div className="text-xs font-medium shrink-0 ml-2 tabular-nums">
                  {w.btcBalance.toFixed(8)} ₿
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">Cold Wallet</span>
                </div>
                <span className="text-xs font-medium tabular-nums">{portfolioData.coldWalletBtc.toFixed(8)} ₿</span>
              </div>
              <div className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Hot Wallet</span>
                </div>
                <span className="text-xs font-medium tabular-nums">{Math.abs(portfolioData.hotWalletBtc).toFixed(8)} ₿</span>
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PortfolioSidebar({ onClose }: PortfolioSidebarProps) {
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [convertedData, setConvertedData] = useState<ConvertedPortfolioData | null>(null);
  const [priceData, setPriceData] = useState<BitcoinPriceData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [ratesLastFetched, setRatesLastFetched] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadData();

    // Subscribe to price updates (which also update portfolio)
    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice) => {
      setPriceData(newPrice);
      setLastUpdated(new Date());
      loadPortfolioData();
    });

    return unsubscribe;
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadSettings(),
        loadCurrentPrice(),
        loadPortfolioData(),
        loadExchangeRates()
      ]);
    } catch (error) {
      console.error('[ERROR] Error loading data:', error);
    }
    setLoading(false);
  };

  const loadExchangeRates = async () => {
    const CACHE_DURATION = 5 * 60 * 1000;
    if (ratesLastFetched && Date.now() - ratesLastFetched.getTime() < CACHE_DURATION) {
      return;
    }

    try {
      const response = await fetch('/api/exchange-rates');
      const result = await response.json();

      if (result.rates && Array.isArray(result.rates) && result.rates.length > 0) {
        const ratesMap: Record<string, number> = {};

        result.rates.forEach((rate: any) => {
          const key = `${rate.from_currency}_${rate.to_currency}`;
          ratesMap[key] = rate.rate;
        });

        setExchangeRates(ratesMap);
        setRatesLastFetched(new Date());
      }
    } catch (error) {
      console.error('[ERROR] Error loading exchange rates:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const result = await response.json();
      if (result.success && result.data) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadCurrentPrice = async () => {
    try {
      const price = await BitcoinPriceClient.getCurrentPrice();
      setPriceData(price);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading current Bitcoin price:', error);
    }
  };

  const loadPortfolioData = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();

      if (result.success && result.data) {
        setPortfolioData(result.data);
      }
    } catch (error) {
      console.error('Error loading portfolio data:', error);
    }
  };

  useEffect(() => {
    if (portfolioData && settings && Object.keys(exchangeRates).length > 0) {
      convertPortfolioData();
    }
  }, [portfolioData, settings, exchangeRates]);

  const getExchangeRate = (from: string, to: string): number => {
    if (from === to) return 1;

    const key = `${from}_${to}`;
    if (exchangeRates[key]) {
      return exchangeRates[key];
    }

    const reverseKey = `${to}_${from}`;
    if (exchangeRates[reverseKey]) {
      return 1 / exchangeRates[reverseKey];
    }

    return 1;
  };

  const convertPortfolioData = () => {
    if (!portfolioData || !settings) return;

    const mainCurrency = settings.currency.mainCurrency;
    const secondaryCurrency = settings.currency.secondaryCurrency;

    const converted: ConvertedPortfolioData = {
      totalBTC: portfolioData.totalBtc || 0,
      totalSatoshis: portfolioData.totalSatoshis || 0,
      totalTransactions: portfolioData.totalTransactions || 0,

      mainCurrency,
      averageBuyPriceMain: portfolioData.avgBuyPrice || 0,
      currentBTCPriceMain: portfolioData.currentBtcPrice || 0,
      currentPortfolioValueMain: portfolioData.portfolioValue || 0,
      unrealizedPnLMain: portfolioData.unrealizedPnL || 0,
      unrealizedPnLPercentage: portfolioData.roi || 0,
      portfolioChange24hMain: portfolioData.portfolioChange24h || 0,
      portfolioChange24hPercentage: portfolioData.portfolioChange24hPercent || 0,
      totalInvestedMain: portfolioData.totalInvested || 0,
      totalFeesMain: portfolioData.totalFeesMain || 0,

      secondaryCurrency,
      averageBuyPriceSecondary: (portfolioData.avgBuyPrice || 0) * getExchangeRate(mainCurrency, secondaryCurrency),
      currentBTCPriceSecondary: (portfolioData.currentBtcPrice || 0) * getExchangeRate(mainCurrency, secondaryCurrency),
      currentPortfolioValueSecondary: (portfolioData.portfolioValue || 0) * getExchangeRate(mainCurrency, secondaryCurrency),
      unrealizedPnLSecondary: (portfolioData.unrealizedPnL || 0) * getExchangeRate(mainCurrency, secondaryCurrency),
      portfolioChange24hSecondary: (portfolioData.portfolioChange24h || 0) * getExchangeRate(mainCurrency, secondaryCurrency),
      totalInvestedSecondary: (portfolioData.totalInvested || 0) * getExchangeRate(mainCurrency, secondaryCurrency),
      totalFeesSecondary: (portfolioData.totalFeesMain || 0) * getExchangeRate(mainCurrency, secondaryCurrency),
    };

    setConvertedData(converted);
  };

  const handleRefresh = () => {
    setLoading(true);
    setRatesLastFetched(null);
    loadData();
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return null;

    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));

    const timeFormat = settings?.display?.timeFormat || '24h';
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: timeFormat === '12h'
    };

    const timeString = lastUpdated.toLocaleTimeString([], timeOptions);

    let statusColor = 'text-muted-foreground';
    if (diffMinutes < 5) {
      statusColor = 'text-green-500';
    } else if (diffMinutes < 15) {
      statusColor = 'text-yellow-500';
    }

    return { timeString, statusColor, diffMinutes };
  };

  // Hooks must run unconditionally (before any early return).
  const animatedValue = useCountUp(convertedData?.currentPortfolioValueSecondary ?? 0);

  if (loading) {
    return (
      <div className="w-full lg:w-80 h-full glass-float lg:rounded-2xl overflow-hidden p-3">
        <div className="animate-pulse space-y-3">
          <div className="h-7 w-1/2 bg-muted rounded-lg"></div>
          <div className="h-28 bg-muted rounded-2xl"></div>
          <div className="h-12 bg-muted rounded-xl"></div>
          <div className="h-32 bg-muted rounded-xl"></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 bg-muted rounded-xl"></div>
            <div className="h-16 bg-muted rounded-xl"></div>
            <div className="h-16 bg-muted rounded-xl"></div>
            <div className="h-16 bg-muted rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!portfolioData || !convertedData) {
    return (
      <div className="w-full lg:w-80 h-full glass-float lg:rounded-2xl overflow-hidden p-4">
        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-4xl text-primary animate-fadeIn">₿</div>
          <p className="text-muted-foreground">No portfolio data yet</p>
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <PlusIcon className="size-4" /> Add Transaction
          </Button>
        </div>
        <AddTransactionModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={() => loadPortfolioData()} />
      </div>
    );
  }

  const pnlUp = convertedData.unrealizedPnLSecondary >= 0;
  const change24hUp = convertedData.portfolioChange24hPercentage >= 0;
  const updateInfo = formatLastUpdated();

  return (
    <div className="w-full lg:w-80 h-full glass-float lg:rounded-2xl overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
      {/* HERO — portfolio value */}
      <div
        className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/[0.06] to-transparent p-4 backdrop-blur-md animate-fadeInUp"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-2 -mt-1 -mr-1">
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Portfolio Value</p>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" onClick={handleRefresh} title="Refresh portfolio data" className="size-7 text-muted-foreground hover:text-foreground">
                <RefreshCwIcon className="size-3.5" />
              </Button>
              {onClose && (
                <Button variant="ghost" size="icon-sm" onClick={onClose} className="size-7 text-muted-foreground hover:text-foreground lg:hidden" title="Close sidebar">
                  <XIcon className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums">
            {formatCurrency(animatedValue, convertedData.secondaryCurrency)}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
            {formatCurrency(convertedData.currentPortfolioValueMain, convertedData.mainCurrency)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              pnlUp ? 'border-profit/30 bg-profit/10 text-profit' : 'border-loss/30 bg-loss/10 text-loss'
            }`}>
              {pnlUp ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
              {formatPercentage(convertedData.unrealizedPnLPercentage)}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${
              change24hUp ? 'border-profit/30 bg-profit/5 text-profit' : 'border-loss/30 bg-loss/5 text-loss'
            }`}>
              24h {change24hUp ? '+' : ''}{convertedData.portfolioChange24hPercentage.toFixed(2)}%
            </span>
            <span className="ml-auto self-center text-[10px] font-medium tabular-nums text-muted-foreground">{convertedData.totalTransactions} tx</span>
          </div>
        </div>
      </div>

      {/* Live BTC price ticker */}
      <div className="flex items-center justify-between glass rounded-xl px-3 py-2.5 shadow-sm animate-fadeInUp" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-medium">BTC Price</p>
            {updateInfo && <p className={`text-[10px] ${updateInfo.statusColor}`}>{priceData?.source === 'fallback' ? 'Fallback' : 'Live'} · {updateInfo.timeString}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-primary leading-none">
            {formatCurrency(convertedData.currentBTCPriceSecondary, convertedData.secondaryCurrency)}
          </div>
          {priceData?.priceChangePercent24h !== undefined && (
            <div className={`text-[11px] font-medium tabular-nums mt-0.5 ${priceData.priceChangePercent24h >= 0 ? 'text-profit' : 'text-loss'}`}>
              {priceData.priceChangePercent24h >= 0 ? '+' : ''}{priceData.priceChangePercent24h.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Holdings */}
      <div className="glass rounded-xl p-3 shadow-sm space-y-3 animate-fadeInUp" style={{ animationDelay: '120ms' }}>
        <div className="flex items-end justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Holdings</p>
            <div className="text-xl font-semibold tabular-nums truncate">
              {convertedData.totalBTC.toFixed(8)} <span className="text-primary">₿</span>
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {convertedData.totalSatoshis.toLocaleString()} sats
            </div>
          </div>
        </div>

        {/* Wallet Distribution — collapsible (multi-level) */}
        {(portfolioData.walletBreakdown?.length > 0 || portfolioData.coldWalletBtc > 0 || portfolioData.hotWalletBtc > 0) && (
          <>
            <Separator />
            <WalletSection portfolioData={portfolioData} />
          </>
        )}

        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Avg. Buy Price</span>
          <span className="text-sm font-medium tabular-nums">
            {formatCurrency(convertedData.averageBuyPriceSecondary, convertedData.secondaryCurrency)}
          </span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2 animate-fadeInUp" style={{ animationDelay: '180ms' }}>
        <div className="glass rounded-xl p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <TrendingUpIcon className="size-3" /> Unrealized
          </p>
          <div className={`text-sm font-semibold tabular-nums truncate ${pnlUp ? 'text-profit' : 'text-loss'}`}>
            {pnlUp ? '+' : ''}{formatCurrency(convertedData.unrealizedPnLSecondary, convertedData.secondaryCurrency)}
          </div>
          <div className={`text-[11px] tabular-nums ${pnlUp ? 'text-profit' : 'text-loss'}`}>
            {formatPercentage(convertedData.unrealizedPnLPercentage)}
          </div>
        </div>

        <div className="glass rounded-xl p-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">24h Change</p>
          <div className={`text-sm font-semibold tabular-nums truncate ${change24hUp ? 'text-profit' : 'text-loss'}`}>
            {change24hUp ? '+' : '-'}{formatCurrency(Math.abs(convertedData.portfolioChange24hSecondary), convertedData.secondaryCurrency)}
          </div>
          <div className={`text-[11px] tabular-nums ${change24hUp ? 'text-profit' : 'text-loss'}`}>
            {change24hUp ? '+' : ''}{convertedData.portfolioChange24hPercentage.toFixed(2)}%
          </div>
        </div>

        <div className="glass rounded-xl p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <CoinsIcon className="size-3" /> Invested
          </p>
          <div className="text-sm font-semibold tabular-nums truncate">
            {formatCurrency(convertedData.totalInvestedSecondary, convertedData.secondaryCurrency)}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {formatCurrency(convertedData.totalFeesSecondary, convertedData.secondaryCurrency)} fees
          </div>
        </div>

        <div className="glass rounded-xl p-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Cost</p>
          <div className="text-sm font-semibold tabular-nums truncate">
            {formatCurrency(convertedData.totalInvestedSecondary + convertedData.totalFeesSecondary, convertedData.secondaryCurrency)}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">incl. fees</div>
        </div>
      </div>

      </div>

      {/* Quick Actions — pinned footer, always visible */}
      <div className="shrink-0 border-t border-border/40 p-3">
        <Button
          onClick={() => setShowAddModal(true)}
          className="group w-full h-11 gap-2 rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0"
        >
          <PlusIcon className="size-4 transition-transform duration-200 group-hover:rotate-90" />
          Add Transaction
        </Button>
      </div>

      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          loadPortfolioData();
        }}
      />
    </div>
  );
}
