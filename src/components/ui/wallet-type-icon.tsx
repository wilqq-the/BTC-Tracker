import React from 'react';
import { SnowflakeIcon, FlameIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Wallet marker: snowflake for cold storage, flame for hot wallets.
 * Used everywhere a wallet is named instead of the wallet's emoji.
 */
export function WalletTypeIcon({ type, className }: { type?: string | null; className?: string }) {
  const cold = type === 'cold';
  const Icon = cold ? SnowflakeIcon : FlameIcon;
  return (
    <Icon
      aria-hidden
      // Solid marks: the flame is filled; the snowflake is all lines, so it
      // gets a heavier stroke to carry the same visual weight
      fill={cold ? 'none' : 'currentColor'}
      strokeWidth={cold ? 2.6 : 2}
      className={cn('inline-block size-4 shrink-0', cold ? 'text-tint-blue-fg' : 'text-primary-strong', className)}
    />
  );
}

/**
 * Icon + wallet name, centred on the text with a gap — use inside select
 * options (Radix copies it into the closed select too) and anywhere else a
 * wallet is named on one line.
 */
export function WalletLabel({ type, name, className }: { type?: string | null; name: React.ReactNode; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <WalletTypeIcon type={type} />
      <span className="truncate">{name}</span>
    </span>
  );
}
