'use client';

/**
 * On-chain provenance shown next to a transaction row.
 *
 * Three facts matter to someone reading their own history and none of them are
 * visible in the type badge:
 *
 *  - where the row came from: typed by hand, or read from the chain;
 *  - whether it is final: an unconfirmed transaction is real money that can still
 *    be dropped, so it is counted but marked;
 *  - whether it was replaced: an RBF'd transaction never confirmed, and leaving it
 *    looking like a settled one is how a portfolio ends up claiming coins that
 *    were never received.
 *
 * The txid is shown as text and not turned into a link to a public explorer: the
 * whole point of the self-hosted option is that clicking around a transaction
 * should not be a decision the interface makes for the user.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Link2Icon, ClockIcon, XCircleIcon } from 'lucide-react';

interface Props {
  source?: string | null;
  txid?: string | null;
  confirmations?: number | null;
  isReplaced?: boolean | null;
  className?: string;
}

function shorten(txid: string): string {
  return txid.length <= 20 ? txid : `${txid.slice(0, 12)}…${txid.slice(-6)}`;
}

export function TransactionOnchainMeta({
  source,
  txid,
  confirmations,
  isReplaced,
  className,
}: Props) {
  const isOnchain = source === 'onchain' || !!txid;
  if (!isOnchain) {
    return null;
  }

  const pending = confirmations === 0 && !isReplaced;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <Badge
        variant="outline"
        className="rounded-full border-transparent px-2 py-0.5 text-[11px] font-semibold bg-tint-orange text-primary-strong"
        title="Imported from the Bitcoin blockchain"
      >
        <Link2Icon className="size-3" />
        on-chain
      </Badge>

      {pending && (
        <Badge
          variant="outline"
          className="rounded-full border-transparent px-2 py-0.5 text-[11px] font-semibold bg-tint-blue text-tint-blue-fg"
          title="Counted in your portfolio, but not confirmed yet"
        >
          <ClockIcon className="size-3" />
          pending
        </Badge>
      )}

      {isReplaced && (
        <Badge
          variant="outline"
          className="rounded-full border-transparent px-2 py-0.5 text-[11px] font-semibold bg-tint-red text-tint-red-fg"
          title="Dropped from the mempool, most likely replaced by a conflicting transaction"
        >
          <XCircleIcon className="size-3" />
          replaced
        </Badge>
      )}

      {txid && (
        <span
          className="font-mono text-[10px] text-muted-foreground"
          title={txid}
        >
          {shorten(txid)}
          {typeof confirmations === 'number' && confirmations > 0
            ? ` · ${confirmations} conf`
            : ''}
        </span>
      )}
    </div>
  );
}

export default TransactionOnchainMeta;
