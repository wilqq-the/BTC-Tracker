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
    <div className="h-full flex flex-col">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          📈 Bitcoin Price Chart
        </h3>
      </div>

      <div className="flex-1">
        <BitcoinChart 
          height={400} 
          showVolume={true} 
          showTransactions={true}
          showTitle={false}
        />
      </div>
    </div>
  );
}

