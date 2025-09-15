'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from './ui/ThemeProvider';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import BitcoinChart from './BitcoinChart';
import { BitcoinPriceClient, BitcoinPriceData } from '@/lib/bitcoin-price-client';

// Note: Real transaction data is managed via the /transactions page with full API integration

interface Transaction {
  id: number;
  type: 'BUY' | 'SELL';
  btc_amount: number;
  original_price_per_btc: number;
  original_total_amount: number;
  main_currency_total_amount: number;
  transaction_date: string;
  notes?: string;
}

export default function MainContent() {
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number>(0);
  const [priceData, setPriceData] = useState<BitcoinPriceData | null>(null);
  const [latestTransactions, setLatestTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingPrice, setLoadingPrice] = useState(true);

  useEffect(() => {
    // Load initial price
    const loadPrice = async () => {
      try {
        const price = await BitcoinPriceClient.getCurrentPrice();
        setCurrentBtcPrice(price.price);
        setPriceData(price);
      } catch (error) {
        console.error('Error loading Bitcoin price:', error);
        // Don't set a fallback value, let it stay at 0
      } finally {
        setLoadingPrice(false);
      }
    };

    // Load latest transactions
    const loadLatestTransactions = async () => {
      try {
        const response = await fetch('/api/transactions');
        const result = await response.json();
        
        if (result.success && result.data) {
          // Get the 5 most recent transactions
          const latest = result.data
            .sort((a: Transaction, b: Transaction) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
            .slice(0, 5);
          setLatestTransactions(latest);
        }
      } catch (error) {
        console.error('Error loading latest transactions:', error);
      } finally {
        setLoadingTransactions(false);
      }
    };

    loadPrice();
    loadLatestTransactions();

    // Subscribe to price updates
    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice: BitcoinPriceData) => {
      setCurrentBtcPrice(newPrice.price);
      setPriceData(newPrice);
      // P&L will automatically recalculate with new price
    });

    return unsubscribe;
  }, []);

  const refreshTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const response = await fetch('/api/transactions');
      const result = await response.json();
      
      if (result.success && result.data) {
        // Get the 5 most recent transactions
        const latest = result.data
          .sort((a: Transaction, b: Transaction) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
          .slice(0, 5);
        setLatestTransactions(latest);
      }
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Bitcoin Chart */}
      <div className="mb-6">
        <BitcoinChart height={400} showVolume={true} showTransactions={true} />
      </div>

      {/* Latest Activities */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
            Latest Activities
          </h2>
          <div className="flex items-center space-x-2 md:space-x-3">
            <button
              onClick={refreshTransactions}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="Refresh activities"
              disabled={loadingTransactions}
            >
              ↻
            </button>
            <a
              href="/transactions"
              className="text-orange-600 hover:text-orange-700 text-xs md:text-sm font-medium"
            >
              View All →
            </a>
          </div>
        </div>

        <ThemedCard padding={false}>
          {loadingTransactions ? (
            <div className="p-6 text-center">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ) : latestTransactions.length === 0 ? (
            <div className="p-6 text-center">
              <ThemedText variant="muted">No transactions found</ThemedText>
            </div>
          ) : (
            <div className="overflow-hidden">
              {/* Desktop Table Header */}
              <div className="hidden md:block bg-gray-200 dark:bg-gray-800 px-4 py-3 border-b border-gray-300 dark:border-gray-600">
                <div className="grid grid-cols-6 gap-4 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <div>Date</div>
                  <div>Type</div>
                  <div>Amount (BTC)</div>
                  <div>Price</div>
                  <div>Current Value</div>
                  <div>P&L</div>
                </div>
              </div>

              {/* Transaction Rows - Desktop and Mobile */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {latestTransactions.map((transaction) => {
                  // Only calculate values if we have a price
                  const currentValue = currentBtcPrice > 0 ? transaction.btc_amount * currentBtcPrice : 0;
                  const originalValue = transaction.main_currency_total_amount || transaction.original_total_amount;
                  
                  // Correct P&L calculation for both BUY and SELL
                  let pnl = 0;
                  if (currentBtcPrice > 0) {
                    if (transaction.type === 'BUY') {
                      // For BUY: P&L = current value - what we paid
                      pnl = currentValue - originalValue;
                    } else {
                      // For SELL: P&L = what we received - what it would be worth now
                      pnl = originalValue - currentValue;
                    }
                  }
                  
                  const pnlPercent = originalValue > 0 && currentBtcPrice > 0 ? (pnl / originalValue) * 100 : 0;

                  return (
                    <div key={transaction.id}>
                      {/* Desktop View */}
                      <div className="hidden md:block px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <div className="grid grid-cols-6 gap-4 items-center">
                          {/* Date */}
                          <div className="text-sm">
                            <div className="text-gray-900 dark:text-gray-100 font-medium">
                              {new Date(transaction.transaction_date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </div>
                            <div className="text-gray-500 dark:text-gray-500 text-xs">
                              {new Date(transaction.transaction_date).toLocaleDateString('en-US', { 
                                year: 'numeric' 
                              })}
                            </div>
                          </div>

                          {/* Type */}
                          <div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'BUY' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {transaction.type}
                            </span>
                          </div>

                          {/* BTC Amount */}
                          <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                            {transaction.btc_amount.toFixed(6)} ₿
                          </div>

                          {/* Price */}
                          <div className="text-sm text-btc-text-primary">
                            {formatCurrency(transaction.original_price_per_btc, 'USD')}
                          </div>

                          {/* Current Value */}
                          <div className="text-sm">
                            <div className="text-btc-text-primary font-medium">
                              {currentBtcPrice > 0 ? formatCurrency(currentValue, 'USD') : '--'}
                            </div>
                          </div>

                          {/* P&L */}
                          <div className="text-sm">
                            {currentBtcPrice > 0 ? (
                              <>
                                <div className={`font-medium ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                  {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, 'USD')}
                                </div>
                                <div className={`text-xs ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                  {formatPercentage(pnlPercent)}
                                </div>
                              </>
                            ) : (
                              <div className="text-btc-text-muted">--</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile View - Card Layout */}
                      <div className="md:hidden px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'BUY' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {transaction.type}
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {new Date(transaction.transaction_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                              {transaction.btc_amount.toFixed(6)} ₿
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              @ {formatCurrency(transaction.original_price_per_btc, 'USD')}
                            </div>
                          </div>
                        </div>
                        
                        {currentBtcPrice > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Current: {formatCurrency(currentValue, 'USD')}
                            </div>
                            <div className={`text-sm font-medium ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, 'USD')} ({formatPercentage(pnlPercent)})
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ThemedCard>
      </div>


    </div>
  );
} 