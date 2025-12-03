'use client';

import React from 'react';
import BitcoinChartNew from '@/components/BitcoinChartNew';
import { WidgetProps } from '@/lib/dashboard-types';

/**
 * Bitcoin Chart Widget
 * Modern shadcn/ui chart with beautiful tooltips and responsive design
 */
export default function BitcoinChartWidget({ id, onRefresh }: WidgetProps) {
  return <BitcoinChartNew showTitle={true} />;
}
