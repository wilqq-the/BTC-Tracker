import React from 'react';
import { SnowflakeIcon, FlameIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Wallet marker: snowflake for cold storage, flame for hot wallets.
 * Used everywhere a wallet is named instead of the wallet's emoji.
 */
export function WalletTypeIcon({ type, className }: { type?: string | null; className?: string }) {
  const Icon = type === 'cold' ? SnowflakeIcon : FlameIcon;
  return (
    <Icon
      aria-hidden
      className={cn('inline-block size-4 shrink-0', type === 'cold' ? 'text-tint-blue-fg' : 'text-primary-strong', className)}
    />
  );
}
