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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { onTransactionsChanged } from '@/lib/app-events';
import { WalletTypeIcon } from '@/components/ui/wallet-type-icon';
import { useBtcUnit } from '@/hooks/use-btc-unit';

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

// Same palette as the dashboard Wallets donut: cold reads blue, hot reads orange
const COLD_WALLET_COLORS = ['bg-tint-blue-fg', 'bg-chart-5', 'bg-cyan-600'];
const HOT_WALLET_COLORS = ['bg-primary', 'bg-chart-2', 'bg-pink-500'];
function walletColors(wallets: { type: string }[]): string[] {
  let cold = 0;
  let hot = 0;
  return wallets.map((w) => w.type === 'cold'
    ? COLD_WALLET_COLORS[cold++ % COLD_WALLET_COLORS.length]
    : HOT_WALLET_COLORS[hot++ % HOT_WALLET_COLORS.length]);
}

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
  const { formatBtc } = useBtcUnit();
  const [open, setOpen] = useState(false);
  const wallets: WalletEntry[] = portfolioData.walletBreakdown ?? [];
  const hasNamed = wallets.length > 0;

  // One row per wallet (named) or the legacy cold/hot totals
  type Row = { id: number; name: string; btcBalance: number; type: string; excluded?: boolean };
  const rows: Row[] = hasNamed
    ? wallets.map(w => ({ id: w.id, name: w.name, btcBalance: w.btcBalance, type: w.type, excluded: !w.includeInPortfolio }))
    : [
        { id: -2, name: 'Hot Wallet', btcBalance: Math.abs(portfolioData.hotWalletBtc as number), type: 'hot' },
        { id: -1, name: 'Cold Wallet', btcBalance: portfolioData.coldWalletBtc as number, type: 'cold' },
      ];
  const colors = walletColors(rows);
  const segments = rows.map((r, i) => ({ ...r, color: colors[i] })).filter(r => !r.excluded && r.btcBalance > 0);
  const barTotal = portfolioData.totalBtc || segments.reduce((sum, w) => sum + w.btcBalance, 0) || 1;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full group">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-muted-foreground">
            {hasNamed ? `${wallets.length} wallets` : 'Wallets'}
          </p>
          <ChevronDownIcon className={`size-4 text-muted-foreground transition-transform duration-300 group-hover:text-foreground ${open ? 'rotate-180' : ''}`} />
        </div>
        {/* Mini distribution bar — always visible; the remainder is unassigned BTC */}
        <div className="h-2.5 bg-card rounded-full overflow-hidden flex gap-0.5">
          {segments.map((w) => (
            <div
              key={w.id}
              className={`${w.color} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${(w.btcBalance / barTotal) * 100}%` }}
              title={`${w.name}: ${formatBtc(w.btcBalance)}`}
            />
          ))}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-fadeIn">
        <div className="mt-3 space-y-2">
          {rows.map((w, i) => (
            <div key={w.id} className="flex items-center justify-between gap-2 text-[13px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`size-2.5 rounded-[4px] shrink-0 ${colors[i]}`} />
                <WalletTypeIcon type={w.type} className="size-3.5" />
                <span className={`truncate font-semibold ${w.btcBalance <= 0 ? 'text-muted-foreground' : ''}`}>{w.name}</span>
                {w.excluded && <span className="shrink-0 text-muted-foreground">(excl.)</span>}
              </div>
              <span className={`shrink-0 font-bold tabular-nums ${w.btcBalance <= 0 ? 'text-muted-foreground' : ''}`}>
                {formatBtc(w.btcBalance, { withUnit: false })}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PortfolioSidebar({ onClose }: PortfolioSidebarProps) {
  const { unit, formatBtc, formatBtcAlt } = useBtcUnit();
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
    // Transactions added elsewhere (header, quick actions) change holdings
    const unsubscribeTx = onTransactionsChanged(() => loadPortfolioData());

    return () => {
      unsubscribe();
      unsubscribeTx();
    };
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
      <div className="w-full lg:w-80 h-full surface rounded-3xl overflow-hidden p-3">
        <div className="animate-pulse space-y-3">
          <div className="h-36 bg-secondary rounded-2xl"></div>
          <div className="h-20 bg-secondary rounded-2xl"></div>
          <div className="h-32 bg-secondary rounded-2xl"></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-20 bg-secondary rounded-2xl"></div>
            <div className="h-20 bg-secondary rounded-2xl"></div>
            <div className="h-20 bg-secondary rounded-2xl"></div>
            <div className="h-20 bg-secondary rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!portfolioData || !convertedData) {
    return (
      <div className="w-full lg:w-80 h-full surface rounded-3xl overflow-hidden p-4">
        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-tint-orange text-4xl font-extrabold text-primary-strong">₿</div>
          <p className="font-semibold text-muted-foreground">No portfolio data yet</p>
          <Button onClick={() => setShowAddModal(true)} className="gap-2 rounded-full font-bold">
            <PlusIcon className="size-4" /> Add transaction
          </Button>
        </div>
        <AddTransactionModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={() => loadPortfolioData()} />
      </div>
    );
  }

  const pnlUp = convertedData.unrealizedPnLSecondary >= 0;
  const change24hUp = convertedData.portfolioChange24hPercentage >= 0;
  const updateInfo = formatLastUpdated();
  const btcChange = priceData?.priceChangePercent24h;
  const upTone = 'text-tint-green-fg';
  const downTone = 'text-tint-red-fg';

  return (
    <div className="w-full lg:w-80 h-full surface rounded-3xl overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
      {/* Portfolio value — warm orange tile */}
      <div className="rounded-2xl bg-tint-orange p-5">
        <div className="flex items-start justify-between gap-2 -mt-1 -mr-2">
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Your portfolio</p>
          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" onClick={handleRefresh} title="Refresh portfolio data" className="size-8 rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
              <RefreshCwIcon className="size-4" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon-sm" onClick={onClose} className="size-8 rounded-full text-muted-foreground hover:bg-card hover:text-foreground lg:hidden" title="Close sidebar">
                <XIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
          {formatCurrency(animatedValue, convertedData.secondaryCurrency)}
        </div>
        <div className="mt-1.5 text-[13px] text-muted-foreground tabular-nums">
          {formatCurrency(convertedData.currentPortfolioValueMain, convertedData.mainCurrency)}
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
            pnlUp ? 'bg-tint-green text-tint-green-fg' : 'bg-tint-red text-tint-red-fg'
          }`}>
            {pnlUp ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
            {formatPercentage(convertedData.unrealizedPnLPercentage)}
          </span>
          <span className={`rounded-full bg-card px-2.5 py-1 text-xs font-bold tabular-nums ${change24hUp ? upTone : downTone}`}>
            24h {change24hUp ? '+' : ''}{convertedData.portfolioChange24hPercentage.toFixed(2)}%
          </span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">{convertedData.totalTransactions} tx</span>
        </div>
      </div>

      {/* Live BTC price — the dark card from the dashboard */}
      <div className="flex items-center gap-3 rounded-2xl bg-[hsl(24_10%_10%)] dark:bg-[hsl(24_8%_14%)] px-4 py-3.5 text-white">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">₿</div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
            Bitcoin price
            <span className="size-1.5 rounded-full bg-green-500 animate-live-pulse" />
          </div>
          <div className="truncate text-lg font-extrabold tracking-tight tabular-nums">
            {formatCurrency(convertedData.currentBTCPriceSecondary, convertedData.secondaryCurrency)}
          </div>
          {updateInfo && (
            <div className="text-[11px] text-white/50">
              {priceData?.source === 'fallback' ? 'Fallback price' : 'Live'} at {updateInfo.timeString}
            </div>
          )}
        </div>
        {btcChange !== undefined && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${btcChange >= 0 ? 'bg-green-900/80 text-green-200' : 'bg-red-900/80 text-red-200'}`}>
            {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Holdings + wallets */}
      <div className="rounded-2xl bg-secondary p-4 space-y-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted-foreground">Total holdings</p>
          <div className="mt-0.5 truncate text-xl font-extrabold tabular-nums">
            {formatBtc(convertedData.totalBTC, { withUnit: false })}{' '}
            <span className="text-primary-strong">{unit === 'btc' ? '₿' : 'sats'}</span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatBtcAlt(convertedData.totalBTC)}
          </div>
        </div>

        {(portfolioData.walletBreakdown?.length > 0 || portfolioData.coldWalletBtc > 0 || portfolioData.hotWalletBtc > 0) && (
          <WalletSection portfolioData={portfolioData} />
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-[13px] font-semibold text-muted-foreground">Avg. buy price</span>
          <span className="text-sm font-bold tabular-nums">
            {formatCurrency(convertedData.averageBuyPriceSecondary, convertedData.secondaryCurrency)}
          </span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-secondary p-3.5">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <TrendingUpIcon className="size-3.5" /> Unrealized
          </p>
          <div className={`truncate text-sm font-extrabold tabular-nums ${pnlUp ? upTone : downTone}`}>
            {pnlUp ? '+' : '-'}{formatCurrency(Math.abs(convertedData.unrealizedPnLSecondary), convertedData.secondaryCurrency)}
          </div>
          <div className={`text-xs font-semibold tabular-nums ${pnlUp ? upTone : downTone}`}>
            {formatPercentage(convertedData.unrealizedPnLPercentage)}
          </div>
        </div>

        <div className="rounded-2xl bg-secondary p-3.5">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">24h change</p>
          <div className={`truncate text-sm font-extrabold tabular-nums ${change24hUp ? upTone : downTone}`}>
            {change24hUp ? '+' : '-'}{formatCurrency(Math.abs(convertedData.portfolioChange24hSecondary), convertedData.secondaryCurrency)}
          </div>
          <div className={`text-xs font-semibold tabular-nums ${change24hUp ? upTone : downTone}`}>
            {change24hUp ? '+' : ''}{convertedData.portfolioChange24hPercentage.toFixed(2)}%
          </div>
        </div>

        <div className="rounded-2xl bg-secondary p-3.5">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <CoinsIcon className="size-3.5" /> Invested
          </p>
          <div className="truncate text-sm font-extrabold tabular-nums">
            {formatCurrency(convertedData.totalInvestedSecondary, convertedData.secondaryCurrency)}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(convertedData.totalFeesSecondary, convertedData.secondaryCurrency)} fees
          </div>
        </div>

        <div className="rounded-2xl bg-secondary p-3.5">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Total cost</p>
          <div className="truncate text-sm font-extrabold tabular-nums">
            {formatCurrency(convertedData.totalInvestedSecondary + convertedData.totalFeesSecondary, convertedData.secondaryCurrency)}
          </div>
          <div className="text-xs text-muted-foreground">incl. fees</div>
        </div>
      </div>
      </div>
    </div>
  );
}
