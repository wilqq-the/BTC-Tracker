'use client';

import React from 'react';
import BitcoinChart from '@/components/BitcoinChart';
import { WidgetProps } from '@/lib/dashboard-types';

/**
 * Bitcoin Chart Widget
 * Modern shadcn/ui chart with beautiful tooltips and responsive design
 */
export default function BitcoinChartWidget({ id, onRefresh }: WidgetProps) {
  return <BitcoinChart showTitle={true} showTransactions={true} />;
}
