'use client';

import React from 'react';
import BitcoinChart from '@/components/BitcoinChart';
import { WidgetProps } from '@/lib/dashboard-types';

/**
 * Bitcoin Chart Widget
 * Wrapper around the existing BitcoinChart component for the dashboard grid
 */
export default function BitcoinChartWidget({ id, isEditMode }: WidgetProps) {
  return (
    <div className="h-full w-full">
      <BitcoinChart 
        height={400} 
        showVolume={true} 
        showTransactions={true} 
      />
    </div>
  );
}

