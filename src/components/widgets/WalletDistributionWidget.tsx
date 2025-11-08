'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import { WidgetProps } from '@/lib/dashboard-types';

interface WalletData {
  totalBtc: number;
  coldWalletBtc: number;
  hotWalletBtc: number;
  coldPercentage: number;
}

/**
 * Wallet Distribution Widget
 * Shows Hot/Cold wallet breakdown
 */
export default function WalletDistributionWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        const total = data.totalBtc || 0;
        const cold = data.coldWalletBtc || 0;
        const hot = data.hotWalletBtc || 0;
        const coldPercent = total > 0 ? (cold / total) * 100 : 0;
        
        setWalletData({
          totalBtc: total,
          coldWalletBtc: cold,
          hotWalletBtc: hot,
          coldPercentage: coldPercent
        });
      } else {
        setError('Failed to load wallet data');
      }
    } catch (err) {
      console.error('Error loading wallet data:', err);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            🔐 Wallet Distribution
          </h3>
        </div>
        <ThemedCard className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bitcoin"></div>
        </ThemedCard>
      </div>
    );
  }

  if (error || !walletData) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            🔐 Wallet Distribution
          </h3>
        </div>
        <ThemedCard className="flex-1 flex items-center justify-center">
          <ThemedText variant="secondary" className="text-center">
            {error || 'No data available'}
          </ThemedText>
        </ThemedCard>
      </div>
    );
  }

  // Determine security status
  const getSecurityStatus = () => {
    if (walletData.coldPercentage >= 80) return { emoji: '🛡️', text: 'Excellent', color: 'text-green-500' };
    if (walletData.coldPercentage >= 50) return { emoji: '✅', text: 'Good', color: 'text-blue-500' };
    if (walletData.coldPercentage >= 20) return { emoji: '⚠️', text: 'Fair', color: 'text-orange-500' };
    return { emoji: '🔴', text: 'Consider Cold Storage', color: 'text-red-500' };
  };

  const status = getSecurityStatus();

  return (
    <div className="h-full flex flex-col">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          🔐 Wallet Distribution
        </h3>
      </div>

      <ThemedCard className="flex-1">
        <div className="p-4 h-full flex flex-col justify-between">

        {/* Visual Distribution Bar */}
        <div className="mb-4">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-500 transition-all duration-300"
              style={{ width: `${walletData.coldPercentage}%` }}
              title="Cold Wallet"
            ></div>
            <div
              className="bg-orange-500 transition-all duration-300"
              style={{ width: `${100 - walletData.coldPercentage}%` }}
              title="Hot Wallet"
            ></div>
          </div>
        </div>

        {/* Wallet Breakdown */}
        <div className="space-y-3 mb-4">
          {/* Cold Wallet */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <ThemedText size="sm" className="font-medium">
                Cold Wallet
              </ThemedText>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-btc-text-primary">
                {walletData.coldWalletBtc.toFixed(8)} ₿
              </div>
              <ThemedText variant="muted" size="xs">
                {walletData.coldPercentage.toFixed(1)}%
              </ThemedText>
            </div>
          </div>

          {/* Hot Wallet */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <ThemedText size="sm" className="font-medium">
                Hot Wallet
              </ThemedText>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-btc-text-primary">
                {Math.abs(walletData.hotWalletBtc).toFixed(8)} ₿
              </div>
              <ThemedText variant="muted" size="xs">
                {Math.abs(100 - walletData.coldPercentage).toFixed(1)}%
              </ThemedText>
            </div>
          </div>
        </div>

        {/* Security Status */}
        <div className="pt-3 border-t border-btc-border-secondary">
          <div className="flex items-center justify-between">
            <ThemedText variant="muted" size="xs">
              Security Status
            </ThemedText>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{status.emoji}</span>
              <span className={`text-sm font-semibold ${status.color}`}>
                {status.text}
              </span>
            </div>
          </div>
        </div>
        </div>
      </ThemedCard>
    </div>
  );
}

