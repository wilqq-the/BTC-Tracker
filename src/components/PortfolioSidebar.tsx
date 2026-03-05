'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCwIcon, XIcon, PlusIcon, TrendingUpIcon, WalletIcon, CoinsIcon, ChevronDownIcon } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { BitcoinPriceClient, BitcoinPriceData } from '@/lib/bitcoin-price-client';
import { PortfolioSummaryData } from '@/lib/bitcoin-price-service';
import { AppSettings } from '@/lib/types';
import AddTransactionModal from './AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  'bg-blue-500', 'bg-btc-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-pink-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500',
];

type WalletEntry = { id: number; name: string; emoji: string | null; type: string; btcBalance: number; includeInPortfolio: boolean };

function WalletSection({ portfolioData, totalBTC }: { portfolioData: any; totalBTC: number }) {
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
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Wallets{hasNamed ? ` (${wallets.length})` : ''}
          </p>
          <ChevronDownIcon className={`size-3 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
        {/* Mini distribution bar — always visible */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden flex gap-px">
          {segments.map((w, i) => (
            <div
              key={w.id}
              className={`${WALLET_COLORS[i % WALLET_COLORS.length]} transition-all duration-300`}
              style={{ width: `${(w.btcBalance / barTotal) * 100}%` }}
              title={`${w.name}: ${w.btcBalance.toFixed(8)} ₿`}
            />
          ))}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-1.5">
        {hasNamed ? (
          wallets.map((w, i) => (
            <div key={w.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`size-2 rounded-full shrink-0 ${WALLET_COLORS[i % WALLET_COLORS.length]}`} />
                <span className="text-sm shrink-0">{w.emoji || (w.type === 'cold' ? '❄️' : '🔥')}</span>
                <span className="text-xs text-muted-foreground truncate">{w.name}</span>
                {!w.includeInPortfolio && <span className="text-xs text-muted-foreground/40 shrink-0">(excl.)</span>}
              </div>
              <div className="font-mono text-xs font-medium shrink-0 ml-2">
                {w.btcBalance.toFixed(8)} ₿
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground">Cold Wallet</span>
              </div>
              <span className="font-mono text-xs font-medium">{portfolioData.coldWalletBtc.toFixed(8)} ₿</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-btc-500" />
                <span className="text-xs text-muted-foreground">Hot Wallet</span>
              </div>
              <span className="font-mono text-xs font-medium">{Math.abs(portfolioData.hotWalletBtc).toFixed(8)} ₿</span>
            </div>
          </>
        )}
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

  if (loading) {
    return (
      <div className="w-full lg:w-80 h-full bg-card border-r border-border p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded"></div>
          <div className="space-y-3">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-24 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!portfolioData || !convertedData) {
    return (
      <div className="w-full lg:w-80 h-full bg-card border-r border-border p-4">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="text-6xl mb-4 text-primary">₿</div>
          <p className="text-muted-foreground">No portfolio data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-80 h-full bg-card border-r border-border p-4 overflow-y-auto">
      {/* Portfolio Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <WalletIcon className="h-5 w-5 text-primary" />
            Portfolio
          </h2>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost"
              size="icon-sm"
              onClick={handleRefresh}
              title="Refresh portfolio data"
            >
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                className="lg:hidden"
                title="Close sidebar"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {convertedData.totalTransactions} transactions
        </p>
      </div>

      {/* Holdings Card */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Holdings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bitcoin Amount */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Total BTC
              </p>
              <div className="font-mono text-xl font-semibold">
                {convertedData.totalBTC.toFixed(8)}
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-0.5">
                {convertedData.totalSatoshis.toLocaleString()} sats
              </div>
            </div>
            <div className="text-3xl text-primary opacity-20">
              ₿
            </div>
          </div>
          
          {/* Wallet Distribution — collapsible */}
          {(portfolioData.walletBreakdown?.length > 0 || portfolioData.coldWalletBtc > 0 || portfolioData.hotWalletBtc > 0) && (
            <>
              <Separator />
              <WalletSection portfolioData={portfolioData} totalBTC={convertedData.totalBTC} />
            </>
          )}
          
          {/* Average Price */}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Avg. Buy Price
            </span>
            <div className="font-mono text-lg font-medium">
              {formatCurrency(convertedData.averageBuyPriceSecondary, convertedData.secondaryCurrency)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Valuation Card */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <CoinsIcon className="h-4 w-4" />
            Valuation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Current Price</p>
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-lg font-bold text-primary">
                {formatCurrency(convertedData.currentBTCPriceSecondary, convertedData.secondaryCurrency)}
              </div>
              <div className="flex flex-col items-end">
                {priceData?.priceChangePercent24h !== undefined ? (
                  <span className={`text-sm font-medium ${
                    priceData.priceChangePercent24h >= 0 ? 'text-profit' : 'text-loss'
                  }`}>
                    {priceData.priceChangePercent24h >= 0 ? '+' : ''}{priceData.priceChangePercent24h.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">--</span>
                )}
                {priceData && (
                  <span className="text-xs text-muted-foreground">
                    {priceData.source === 'fallback' ? 'Fallback' : 'Live'}
                  </span>
                )}
              </div>
            </div>
            
            {/* Last Updated Timestamp */}
            {(() => {
              const updateInfo = formatLastUpdated();
              return updateInfo ? (
                <div className="flex items-center mt-1 space-x-1">
                  <span className={`text-xs ${updateInfo.statusColor}`}>●</span>
                  <span className="text-xs text-muted-foreground">
                    {updateInfo.timeString}
                  </span>
                </div>
              ) : null;
            })()}
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Portfolio Value</p>
            <div className="space-y-1">
              <div className="font-mono text-lg font-bold">
                {formatCurrency(convertedData.currentPortfolioValueSecondary, convertedData.secondaryCurrency)}
              </div>
              <div className="font-mono text-sm text-muted-foreground">
                {formatCurrency(convertedData.currentPortfolioValueMain, convertedData.mainCurrency)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Card */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <TrendingUpIcon className="h-4 w-4" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Unrealized P&L</p>
            <div className={`font-mono text-lg font-bold ${
              convertedData.unrealizedPnLSecondary >= 0 ? 'text-profit' : 'text-loss'
            }`}>
              {convertedData.unrealizedPnLSecondary >= 0 ? '+' : ''}{formatCurrency(convertedData.unrealizedPnLSecondary, convertedData.secondaryCurrency)}
            </div>
            <div className={`text-sm ${
              convertedData.unrealizedPnLPercentage >= 0 ? 'text-profit' : 'text-loss'
            }`}>
              {formatPercentage(convertedData.unrealizedPnLPercentage)}
            </div>
          </div>
          
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">24h Change</span>
            <span className={`font-mono text-sm font-medium ${
              convertedData.portfolioChange24hSecondary >= 0 ? 'text-profit' : 'text-loss'
            }`}>
              {convertedData.portfolioChange24hSecondary >= 0 ? '+' : '-'}{formatCurrency(Math.abs(convertedData.portfolioChange24hSecondary), convertedData.secondaryCurrency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Investment Card */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Investment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Invested</span>
            <span className="font-mono text-sm font-medium">
              {formatCurrency(convertedData.totalInvestedSecondary, convertedData.secondaryCurrency)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Fees</span>
            <span className="font-mono text-sm font-medium">
              {formatCurrency(convertedData.totalFeesSecondary, convertedData.secondaryCurrency)}
            </span>
          </div>

          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Cost</span>
            <span className="font-mono text-base font-bold">
              {formatCurrency(convertedData.totalInvestedSecondary + convertedData.totalFeesSecondary, convertedData.secondaryCurrency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Button 
        variant="default"
        className="w-full"
        onClick={() => setShowAddModal(true)}
      >
        <PlusIcon className="h-4 w-4" />
        Add Transaction
      </Button>
      
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
