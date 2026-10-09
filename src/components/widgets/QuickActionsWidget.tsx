'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, MinusIcon, ArrowLeftRightIcon, UploadIcon, LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddTransactionModal from '@/components/AddTransactionModal';
import { WidgetProps } from '@/lib/dashboard-types';
import { emitTransactionsChanged } from '@/lib/app-events';
import { cn } from '@/lib/utils';

type TxType = 'BUY' | 'SELL' | 'TRANSFER';

interface Action {
  label: string;
  icon: LucideIcon;
  tile: string;
  iconColor: string;
  /** One small gesture on hover that matches the icon */
  nudge: string;
  run: () => void;
}

/**
 * Quick Actions Widget
 * Tinted tiles for the common jobs: buy, sell, transfer, import.
 */
export default function QuickActionsWidget(_props: WidgetProps) {
  const router = useRouter();
  const [modalType, setModalType] = useState<TxType | null>(null);

  const actions: Action[] = [
    { label: 'Buy', icon: PlusIcon, tile: 'bg-tint-orange', iconColor: 'text-primary-strong', nudge: 'group-hover:animate-nudge-up', run: () => setModalType('BUY') },
    { label: 'Sell', icon: MinusIcon, tile: 'bg-secondary', iconColor: 'text-foreground', nudge: 'group-hover:animate-nudge-down', run: () => setModalType('SELL') },
    { label: 'Transfer', icon: ArrowLeftRightIcon, tile: 'bg-secondary', iconColor: 'text-tint-blue-fg', nudge: 'group-hover:animate-nudge-x', run: () => setModalType('TRANSFER') },
    { label: 'Import CSV', icon: UploadIcon, tile: 'bg-secondary', iconColor: 'text-foreground', nudge: 'group-hover:animate-hop', run: () => router.push('/transactions?import=1') },
  ];

  return (
    <Card className="rounded-2xl h-full flex flex-col gap-4 overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle className="text-[17px] font-bold tracking-tight">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="grid h-full grid-cols-2 auto-rows-fr gap-2.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.run}
                className={cn(
                  'group flex min-h-[72px] items-center gap-3 rounded-[18px] px-4 py-3 text-left',
                  'transition-transform duration-200 ease-[cubic-bezier(0.3,1.4,0.5,1)] hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.97]',
                  action.tile
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-card transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] group-hover:scale-110">
                  <Icon className={cn('size-5', action.iconColor, action.nudge)} strokeWidth={2.2} />
                </span>
                <span className="text-[15px] font-bold">{action.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>

      <AddTransactionModal
        isOpen={modalType !== null}
        initialType={modalType ?? undefined}
        onClose={() => setModalType(null)}
        onSuccess={emitTransactionsChanged}
      />
    </Card>
  );
}
