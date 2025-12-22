'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import { WalletManager } from '@/components/WalletManager';
import { WalletIcon } from 'lucide-react';

export default function WalletsPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <WalletIcon className="size-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Wallets</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your Bitcoin wallets and track holdings across multiple locations
          </p>
        </div>

        {/* Wallet Manager */}
        <WalletManager />
      </div>
    </AppLayout>
  );
}

