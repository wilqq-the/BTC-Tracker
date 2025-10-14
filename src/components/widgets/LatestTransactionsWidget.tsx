'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import { WidgetProps } from '@/lib/dashboard-types';
import { BitcoinPriceClient } from '@/lib/bitcoin-price-client';

interface Transaction {
  id: number;
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_total_amount: number;
  main_currency_total_amount: number;
  main_currency_price_per_btc?: number;
  current_value_main?: number;
  pnl_main?: number;
  main_currency?: string;
  transaction_date: string;
  notes?: string;
}

/**
 * Latest Transactions Widget
 * Shows recent transactions with P&L (dynamically adjusts count based on height)
 */
export default function LatestTransactionsWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [latestTransactions, setLatestTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [mainCurrency, setMainCurrency] = useState<string>('USD');
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number>(0);
  const [maxTransactions, setMaxTransactions] = useState<number>(5);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Calculate how many transactions can fit based on container height
  useEffect(() => {
    const calculateMaxTransactions = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        // More conservative calculation to avoid overflow
        // Header: ~48px, card padding + bottom margin: ~40px
        // Each transaction with divider: ~75px (slightly more than visual height)
        const headerHeight = 48;
        const cardOverhead = 40;
        const transactionHeight = 75; // Increased to be more conservative
        const availableHeight = containerHeight - headerHeight - cardOverhead;
        const count = Math.max(3, Math.floor(availableHeight / transactionHeight));
        setMaxTransactions(Math.min(count, 50)); // Cap at 50 max
      }
    };

    calculateMaxTransactions();

    // Recalculate on resize with slight delay to ensure proper measurement
    const observer = new ResizeObserver(() => {
      setTimeout(calculateMaxTransactions, 50);
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Reload transactions when max count changes
  useEffect(() => {
    loadLatestTransactions();
  }, [maxTransactions]);

  useEffect(() => {
    loadCurrentPrice();

    // Subscribe to price updates
    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice) => {
      setCurrentBtcPrice(newPrice.price);
    });

    return unsubscribe;
  }, []);

  const loadCurrentPrice = async () => {
    try {
      const price = await BitcoinPriceClient.getCurrentPrice();
      setCurrentBtcPrice(price.price);
    } catch (error) {
      console.error('Error loading Bitcoin price:', error);
    }
  };

  const loadLatestTransactions = React.useCallback(async () => {
    try {
      const response = await fetch('/api/transactions');
      const result = await response.json();
      
      if (result.success && result.data) {
        const latest = result.data
          .sort((a: Transaction, b: Transaction) => 
            new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
          )
          .slice(0, maxTransactions);
        setLatestTransactions(latest);
        
        if (latest.length > 0 && latest[0].main_currency) {
          setMainCurrency(latest[0].main_currency);
        }
      }
    } catch (error) {
      console.error('Error loading latest transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, [maxTransactions]);

  const handleRefresh = async () => {
    setLoadingTransactions(true);
    await loadLatestTransactions();
    if (onRefresh) onRefresh();
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Latest Transactions {maxTransactions > 5 && <span className="text-xs text-gray-500 dark:text-gray-400">({latestTransactions.length})</span>}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
            disabled={loadingTransactions}
          >
            ↻
          </button>
          <a
            href="/transactions"
            className="text-orange-600 hover:text-orange-700 text-xs font-medium"
          >
            View All →
          </a>
        </div>
      </div>

      <ThemedCard padding={false} className="flex-1 overflow-hidden">
        {loadingTransactions ? (
          <div className="p-4 text-center">
            <div className="animate-pulse">
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ) : latestTransactions.length === 0 ? (
          <div className="p-4 text-center">
            <ThemedText variant="muted" className="text-sm">
              No transactions found
            </ThemedText>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto max-h-full">
            {latestTransactions.map((transaction) => {
              const pricePerBtc = transaction.main_currency_price_per_btc || transaction.original_price_per_btc;
              const currentValue = transaction.current_value_main || 0;
              const pnl = transaction.pnl_main || 0;
              const originalValue = transaction.main_currency_total_amount || transaction.original_total_amount;
              const pnlPercent = originalValue > 0 ? (pnl / originalValue) * 100 : 0;

              return (
                <div key={transaction.id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                        transaction.type === 'BUY' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {transaction.type}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(transaction.transaction_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                        {transaction.btc_amount.toFixed(6)} ₿
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        @ {formatCurrency(pricePerBtc, mainCurrency)}
                      </div>
                    </div>
                  </div>
                  
                  {currentValue > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        P&L:
                      </div>
                      <div className={`text-xs font-medium ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, mainCurrency)} ({formatPercentage(pnlPercent)})
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ThemedCard>
    </div>
  );
}

