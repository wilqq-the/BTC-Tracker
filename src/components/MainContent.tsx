'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, formatPercentage } from '@/lib/theme';
import BitcoinChart from './BitcoinChart';
import { BitcoinPriceClient, BitcoinPriceData } from '@/lib/bitcoin-price-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCwIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function MainContent() {
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number>(0);
  const [priceData, setPriceData] = useState<BitcoinPriceData | null>(null);
  const [latestTransactions, setLatestTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [mainCurrency, setMainCurrency] = useState<string>('USD');

  useEffect(() => {
    const loadPrice = async () => {
      try {
        const price = await BitcoinPriceClient.getCurrentPrice();
        setCurrentBtcPrice(price.price);
        setPriceData(price);
      } catch (error) {
        console.error('Error loading Bitcoin price:', error);
      } finally {
        setLoadingPrice(false);
      }
    };

    const loadLatestTransactions = async () => {
      try {
        const response = await fetch('/api/transactions?limit=10');
        const result = await response.json();
        
        if (result.success && result.data) {
          const latest = result.data
            .sort((a: Transaction, b: Transaction) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
            .slice(0, 5);
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
    };

    loadPrice();
    loadLatestTransactions();

    const unsubscribe = BitcoinPriceClient.onPriceUpdate((newPrice: BitcoinPriceData) => {
      setCurrentBtcPrice(newPrice.price);
      setPriceData(newPrice);
    });

    return unsubscribe;
  }, []);

  const refreshTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const response = await fetch('/api/transactions?limit=10');
      const result = await response.json();
      
      if (result.success && result.data) {
        const latest = result.data
          .sort((a: Transaction, b: Transaction) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
          .slice(0, 5);
        setLatestTransactions(latest);
        
        if (latest.length > 0 && latest[0].main_currency) {
          setMainCurrency(latest[0].main_currency);
        }
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
        <BitcoinChart showTitle={true} showTransactions={true} />
      </div>

      {/* Latest Activities */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold">
            Latest Activities
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshTransactions}
              disabled={loadingTransactions}
              className="size-8"
            >
              <RefreshCwIcon className={cn("size-4", loadingTransactions && "animate-spin")} />
            </Button>
            <Button variant="link" size="sm" asChild>
              <a href="/transactions">View All</a>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loadingTransactions ? (
              <div className="p-6 space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            ) : latestTransactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No transactions found
              </div>
            ) : (
              <div className="overflow-hidden">
                {/* Desktop Table Header */}
                <div className="hidden md:block bg-muted/50 px-4 py-3 border-b">
                  <div className="grid grid-cols-6 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div>Date</div>
                    <div>Type</div>
                    <div>Amount (BTC)</div>
                    <div>Price</div>
                    <div>Current Value</div>
                    <div>P&L</div>
                  </div>
                </div>

                {/* Transaction Rows */}
                <div className="divide-y">
                  {latestTransactions.map((transaction) => {
                    const pricePerBtc = transaction.main_currency_price_per_btc || transaction.original_price_per_btc;
                    const currentValue = transaction.current_value_main || 0;
                    const pnl = transaction.pnl_main || 0;
                    const originalValue = transaction.main_currency_total_amount || transaction.original_total_amount;
                    const pnlPercent = originalValue > 0 ? (pnl / originalValue) * 100 : 0;

                    return (
                      <div key={transaction.id}>
                        {/* Desktop View */}
                        <div className="hidden md:block px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="grid grid-cols-6 gap-4 items-center">
                            {/* Date */}
                            <div className="text-sm">
                              <div className="font-medium">
                                {new Date(transaction.transaction_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {new Date(transaction.transaction_date).toLocaleDateString('en-US', { 
                                  year: 'numeric' 
                                })}
                              </div>
                            </div>

                            {/* Type */}
                            <div>
                              <Badge 
                                variant="outline"
                                className={cn(
                                  "font-semibold",
                                  transaction.type === 'BUY' && "border-profit/50 text-profit bg-profit/10",
                                  transaction.type === 'SELL' && "border-loss/50 text-loss bg-loss/10"
                                )}
                              >
                                {transaction.type}
                              </Badge>
                            </div>

                            {/* BTC Amount */}
                            <div className="text-sm font-mono font-medium">
                              {transaction.btc_amount.toFixed(6)} ₿
                            </div>

                            {/* Price */}
                            <div className="text-sm">
                              {formatCurrency(pricePerBtc, mainCurrency)}
                            </div>

                            {/* Current Value */}
                            <div className="text-sm">
                              <div className="font-medium">
                                {currentValue > 0 ? formatCurrency(currentValue, mainCurrency) : '--'}
                              </div>
                            </div>

                            {/* P&L */}
                            <div className="text-sm">
                              {currentValue > 0 ? (
                                <>
                                  <div className={cn("font-medium", pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, mainCurrency)}
                                  </div>
                                  <div className={cn("text-xs", pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                    {formatPercentage(pnlPercent)}
                                  </div>
                                </>
                              ) : (
                                <div className="text-muted-foreground">--</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mobile View - Card Layout */}
                        <div className="md:hidden px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <Badge 
                                variant="outline"
                                className={cn(
                                  "font-semibold",
                                  transaction.type === 'BUY' && "border-profit/50 text-profit bg-profit/10",
                                  transaction.type === 'SELL' && "border-loss/50 text-loss bg-loss/10"
                                )}
                              >
                                {transaction.type}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1">
                                {new Date(transaction.transaction_date).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-sm font-medium">
                                {transaction.btc_amount.toFixed(6)} ₿
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @ {formatCurrency(pricePerBtc, mainCurrency)}
                              </div>
                            </div>
                          </div>
                          
                          {currentValue > 0 && (
                            <div className="flex justify-between items-center pt-2 border-t">
                              <div className="text-xs text-muted-foreground">
                                Current: {formatCurrency(currentValue, mainCurrency)}
                              </div>
                              <div className={cn("text-sm font-medium", pnl >= 0 ? 'text-profit' : 'text-loss')}>
                                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, mainCurrency)} ({formatPercentage(pnlPercent)})
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
