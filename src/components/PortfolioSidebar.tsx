'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from './ui/ThemeProvider';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { BitcoinPriceClient, BitcoinPriceData } from '@/lib/bitcoin-price-client';
import { PortfolioSummaryData } from '@/lib/bitcoin-price-service';
import { AppSettings } from '@/lib/types';
import AddTransactionModal from './AddTransactionModal';

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
  currentPortfolioValueSecondary: number;
}

interface PortfolioSidebarProps {
  onClose?: () => void;
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
      setLastUpdated(new Date()); // Update timestamp on live price updates
      // Reload portfolio data when price updates (since portfolio gets recalculated)
      loadPortfolioData();
    });

    return unsubscribe;
  }, []);

  const loadData = async () => {
    console.log('[START] Starting data load...');
    try {
    await Promise.all([
      loadSettings(),
      loadCurrentPrice(),
        loadPortfolioData(),
        loadExchangeRates()
    ]);
      console.log('[OK] All data loaded successfully');
    } catch (error) {
      console.error('[ERROR] Error loading data:', error);
    }
    setLoading(false);
  };

  const loadExchangeRates = async () => {
    console.log('[SYNC] loadExchangeRates called, checking cache...');
    
    // Cache for 5 minutes
    const CACHE_DURATION = 5 * 60 * 1000;
    if (ratesLastFetched && Date.now() - ratesLastFetched.getTime() < CACHE_DURATION) {
      console.log('💾 Using cached exchange rates, skipping fetch');
      return;
    }

    console.log('[WEB] Fetching fresh exchange rates...');

    try {
      const response = await fetch('/api/exchange-rates');
      console.log('📡 Exchange rates API response status:', response.status);
      
      const result = await response.json();
      console.log('[DATA] Exchange rates API result:', result);
      
      if (result.rates && Array.isArray(result.rates) && result.rates.length > 0) {
        console.log('[OK] Processing', result.rates.length, 'exchange rates...');
        
        // Convert to easy lookup format: USD_PLN: 3.71, EUR_USD: 1.15, etc.
        const ratesMap: Record<string, number> = {};
        
        result.rates.forEach((rate: any) => {
          const key = `${rate.from_currency}_${rate.to_currency}`;
          ratesMap[key] = rate.rate;
          console.log(`[EXCHANGE] Added rate: ${key} = ${rate.rate}`);
        });
        
        console.log('[EXCHANGE] Final exchange rates map:', ratesMap);
        setExchangeRates(ratesMap);
        setRatesLastFetched(new Date());
        console.log('[OK] Exchange rates loaded and cached');
      } else {
        console.error('[ERROR] Exchange rates API returned invalid data format:', result);
      }
    } catch (error) {
      console.error('[ERROR] Error loading exchange rates:', error);
      // Keep existing rates if any
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
      console.log('[MONEY] Bitcoin price data:', {
        price: price?.price,
        source: price?.source,
        timestamp: price?.timestamp
      });
      setPriceData(price);
      setLastUpdated(new Date()); // Update timestamp when price is refreshed
    } catch (error) {
      console.error('Error loading current Bitcoin price:', error);
    }
  };

  const loadPortfolioData = async () => {
    try {
      console.log('[DATA] Loading portfolio data...');
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      console.log('[DATA] Portfolio API response:', result);
      
      if (result.success && result.data) {
        console.log('[DATA] Portfolio data loaded:', result.data);
        // Store the raw data from API
        setPortfolioData(result.data);
      } else {
        console.error('[DATA] Portfolio API returned no data or failed:', result);
      }
    } catch (error) {
      console.error('Error loading portfolio data:', error);
    }
  };

  // Convert portfolio data using cached exchange rates
  useEffect(() => {
    console.log('[SYNC] Conversion useEffect triggered:', {
      hasPortfolioData: !!portfolioData,
      hasSettings: !!settings,
      exchangeRatesCount: Object.keys(exchangeRates).length,
      portfolioData: portfolioData ? 'loaded' : 'null',
      settings: settings ? 'loaded' : 'null'
    });
    
    if (portfolioData && settings) {
      if (Object.keys(exchangeRates).length > 0) {
        console.log('[OK] All conditions met, converting portfolio data...');
        convertPortfolioData();
      } else {
        console.log('[WARN] No exchange rates yet, converting with fallback rates...');
        // Fallback: convert with basic rates (USD=1, others=1)
      convertPortfolioData();
    }
    } else {
      console.log('[WAIT] Waiting for portfolio data and settings to load...');
    }
  }, [portfolioData, settings, exchangeRates]);

  const getExchangeRate = (from: string, to: string): number => {
    if (from === to) return 1;
    
    const directKey = `${from}_${to}`;
    if (exchangeRates[directKey]) {
      return exchangeRates[directKey];
    }
    
    // Try reverse rate
    const reverseKey = `${to}_${from}`;
    if (exchangeRates[reverseKey]) {
      return 1 / exchangeRates[reverseKey];
    }
    
    console.warn(`No exchange rate found for ${from} → ${to}`);
    return 1; // Fallback
  };

  const convertPortfolioData = () => {
    if (!portfolioData || !settings) return;

      const mainCurrency = settings.currency.mainCurrency;
      const secondaryCurrency = settings.currency.secondaryCurrency;

    const usdToMainRate = getExchangeRate('USD', mainCurrency);
    const usdToSecondaryRate = getExchangeRate('USD', secondaryCurrency);

    console.log('[EXCHANGE] Using exchange rates:', { 
      usdToMainRate, 
      usdToSecondaryRate,
      mainCurrency,
      secondaryCurrency,
      availableRates: Object.keys(exchangeRates)
    });

      // Note: The API now returns all values already converted to mainCurrency,
      // so we don't need to convert them again here. We only pass them through.
      const converted: ConvertedPortfolioData = {
        totalBTC: portfolioData.totalBtc || 0,
        totalSatoshis: portfolioData.totalSatoshis || 0,
        totalTransactions: portfolioData.totalTransactions || 0,
        
        // Main currency values (already in mainCurrency from API)
        mainCurrency,
        averageBuyPriceMain: portfolioData.avgBuyPrice || 0,
        currentBTCPriceMain: portfolioData.currentBtcPrice || 0,
        currentPortfolioValueMain: portfolioData.portfolioValue || 0,
        unrealizedPnLMain: portfolioData.unrealizedPnL || 0,
        unrealizedPnLPercentage: portfolioData.roi || 0,
        portfolioChange24hMain: portfolioData.portfolioChange24h || 0,
        portfolioChange24hPercentage: portfolioData.portfolioChange24hPercent || 0,
        totalInvestedMain: portfolioData.totalInvested || 0,
        totalFeesMain: 0, // Not provided by the API, default to 0
        
        // Secondary currency values (need to convert from main to secondary)
        secondaryCurrency,
        currentPortfolioValueSecondary: (portfolioData.portfolioValue || 0) * (getExchangeRate(mainCurrency, secondaryCurrency)),
      };

    console.log('[OK] Converted portfolio values:', {
      originalUSD: portfolioData.portfolioValue,
      convertedMain: converted.currentPortfolioValueMain,
      convertedSecondary: converted.currentPortfolioValueSecondary
    });

      setConvertedData(converted);
  };

  const handleRefresh = () => {
    setLoading(true);
    // Force fresh exchange rates
    setRatesLastFetched(null);
    loadData();
  };

  // Helper function to format the last updated timestamp
  const formatLastUpdated = () => {
    if (!lastUpdated) return null;
    
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));
    
    // Use 12/24 hour format based on settings
    const timeFormat = settings?.display?.timeFormat || '24h';
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: timeFormat === '12h'
    };
    
    const timeString = lastUpdated.toLocaleTimeString([], timeOptions);
    
    // Determine status: green if fresh (<5 min), yellow if stale (5-15 min), gray if old (>15 min)
    let statusColor = 'text-gray-400'; // Default gray
    if (diffMinutes < 5) {
      statusColor = 'text-green-500'; // Fresh - green
    } else if (diffMinutes < 15) {
      statusColor = 'text-yellow-500'; // Stale - yellow
    }
    
    return { timeString, statusColor, diffMinutes };
  };

  if (loading) {
    return (
      <div className="w-full lg:w-80 h-full bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!portfolioData || !convertedData) {
    return (
      <div className="w-full lg:w-80 h-full bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">₿</div>
          <ThemedText variant="secondary">No portfolio data</ThemedText>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-80 h-full bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 p-4 overflow-y-auto">
      {/* Portfolio Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Portfolio
          </h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleRefresh}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="Refresh portfolio data"
            >
              ↻
            </button>
            {/* Close button for mobile */}
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                title="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <ThemedText variant="muted" size="sm">
          {convertedData.totalTransactions} transactions
        </ThemedText>
      </div>

      {/* Holdings Section */}
      <ThemedCard className="mb-3 p-4">
        <div className="mb-4">
          <ThemedText variant="secondary" size="sm" className="uppercase tracking-wide font-medium">
            Holdings
          </ThemedText>
        </div>
        
        <div className="space-y-4">
          {/* Bitcoin Amount */}
          <div className="flex items-end justify-between">
          <div>
              <ThemedText variant="muted" size="xs" className="uppercase tracking-wide mb-1">
                Total BTC
              </ThemedText>
              <div className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">
                {convertedData.totalBTC.toFixed(8)}
              </div>
              <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {convertedData.totalSatoshis.toLocaleString()} sats
              </div>
            </div>
            <div className="text-2xl text-gray-400 dark:text-gray-500">
              ₿
            </div>
          </div>
          
          {/* Cold/Hot Wallet Distribution */}
          {(portfolioData.coldWalletBtc > 0 || portfolioData.hotWalletBtc > 0) && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <ThemedText variant="muted" size="xs" className="uppercase tracking-wide mb-2">
                Wallet Distribution
              </ThemedText>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <ThemedText variant="muted" size="xs">Cold Wallet</ThemedText>
                </div>
                <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                  {portfolioData.coldWalletBtc.toFixed(8)} ₿
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <ThemedText variant="muted" size="xs">Hot Wallet</ThemedText>
                </div>
                <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                  {Math.abs(portfolioData.hotWalletBtc).toFixed(8)} ₿
                </div>
              </div>
              {portfolioData.coldWalletBtc > 0 && (
                <div className="pt-1">
                  <ThemedText variant="muted" size="xs">
                    {((portfolioData.coldWalletBtc / convertedData.totalBTC) * 100).toFixed(1)}% in cold storage
                  </ThemedText>
                </div>
              )}
            </div>
          )}
          
          {/* Average Price */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <ThemedText variant="muted" size="xs" className="uppercase tracking-wide">
                Avg. Buy Price
              </ThemedText>
              <div className="font-mono text-lg font-medium text-gray-900 dark:text-gray-100">
              {formatCurrency(convertedData.averageBuyPriceMain, convertedData.mainCurrency)}
              </div>
            </div>
          </div>
        </div>
      </ThemedCard>

      {/* Valuation Section */}
      <ThemedCard className="mb-3 p-3">
        <div className="mb-2">
          <ThemedText variant="secondary" size="sm" className="uppercase tracking-wide font-medium">
            Valuation
          </ThemedText>
        </div>
        
        <div className="space-y-2">
          <div>
            <ThemedText variant="muted" size="sm">Current Price</ThemedText>
            <div className="flex items-baseline justify-between">
              <ThemedText variant="primary" className="font-mono text-lg font-bold">
                {formatCurrency(convertedData.currentBTCPriceMain, convertedData.mainCurrency)}
              </ThemedText>
              <div className="flex flex-col items-end">
                {priceData?.priceChangePercent24h !== undefined ? (
                  <ThemedText 
                    size="sm"
                    className={priceData.priceChangePercent24h >= 0 ? "text-profit" : "text-loss"}
                  >
                    {priceData.priceChangePercent24h >= 0 ? '+' : ''}{priceData.priceChangePercent24h.toFixed(1)}%
                  </ThemedText>
                ) : (
                  <ThemedText variant="muted" size="sm">
                    --
                  </ThemedText>
                )}
                {priceData && (
                  <ThemedText variant="muted" size="xs">
                    {priceData.source === 'fallback' ? 'Fallback' : 'Live'}
                  </ThemedText>
                )}
              </div>
            </div>
            
            {/* Last Updated Timestamp */}
            {(() => {
              const updateInfo = formatLastUpdated();
              return updateInfo ? (
                <div className="flex items-center mt-1 space-x-1">
                  <span className={`text-xs ${updateInfo.statusColor}`}>●</span>
                  <ThemedText variant="muted" size="xs">
                    {updateInfo.timeString}
                  </ThemedText>
                </div>
              ) : null;
            })()}
          </div>
          
          <div>
            <ThemedText variant="muted" size="sm">Portfolio Value</ThemedText>
            <div className="space-y-1">
              <div className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(convertedData.currentPortfolioValueMain, convertedData.mainCurrency)}
              </div>
              <div className="font-mono text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(convertedData.currentPortfolioValueSecondary, convertedData.secondaryCurrency)}
              </div>
            </div>
          </div>
        </div>
      </ThemedCard>

      {/* Performance Section */}
      <ThemedCard className="mb-3 p-3">
        <div className="mb-2">
          <ThemedText variant="secondary" size="sm" className="uppercase tracking-wide font-medium">
            Performance
          </ThemedText>
        </div>
        
        <div className="space-y-2">
          <div>
            <ThemedText variant="muted" size="sm">Unrealized P&L</ThemedText>
            <div className={`font-mono text-lg font-bold ${
              convertedData.unrealizedPnLMain >= 0 ? 'text-profit' : 'text-loss'
            }`}>
              {convertedData.unrealizedPnLMain >= 0 ? '+' : ''}{formatCurrency(convertedData.unrealizedPnLMain, convertedData.mainCurrency)}
            </div>
            <div className={`text-sm ${
              convertedData.unrealizedPnLPercentage >= 0 ? 'text-profit' : 'text-loss'
            }`}>
              {formatPercentage(convertedData.unrealizedPnLPercentage)}
            </div>
          </div>
          
          <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <ThemedText variant="muted" size="sm">24h Change</ThemedText>
              <ThemedText 
                size="sm"
                className={convertedData.portfolioChange24hMain >= 0 ? "text-profit" : "text-loss"}
              >
                {convertedData.portfolioChange24hMain >= 0 ? '+' : '-'}{formatCurrency(Math.abs(convertedData.portfolioChange24hMain), convertedData.mainCurrency)}
              </ThemedText>
            </div>
          </div>
        </div>
      </ThemedCard>

      {/* Investment Section */}
      <ThemedCard className="mb-4 p-3">
        <div className="mb-2">
          <ThemedText variant="secondary" size="sm" className="uppercase tracking-wide font-medium">
            Investment
          </ThemedText>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <ThemedText variant="muted" size="sm">Total Invested</ThemedText>
            <ThemedText variant="primary" className="font-mono">
              {formatCurrency(convertedData.totalInvestedMain, convertedData.mainCurrency)}
            </ThemedText>
          </div>
          
          <div className="flex justify-between">
            <ThemedText variant="muted" size="sm">Total Fees</ThemedText>
            <ThemedText variant="primary" className="font-mono">
              {formatCurrency(convertedData.totalFeesMain, convertedData.mainCurrency)}
            </ThemedText>
          </div>
          
          <div className="flex justify-between pt-2 border-t border-btc-border-secondary">
            <ThemedText variant="muted" size="sm">Total Cost</ThemedText>
            <ThemedText variant="primary" className="font-mono font-semibold">
              {formatCurrency(convertedData.totalInvestedMain + convertedData.totalFeesMain, convertedData.mainCurrency)}
            </ThemedText>
          </div>
        </div>
      </ThemedCard>

      {/* Quick Actions */}
      <div className="space-y-2">
        <ThemedButton 
          variant="primary" 
          size="sm" 
          className="w-full bg-bitcoin hover:bg-bitcoin-dark"
          onClick={() => setShowAddModal(true)}
        >
          + Add Transaction
        </ThemedButton>
      </div>
      
      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          // Refresh portfolio data after adding transaction
          loadPortfolioData();
        }}
      />
    </div>
  );
} 