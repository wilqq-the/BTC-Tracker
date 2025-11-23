/**
 * Widget Registry
 * Maps widget types to their corresponding React components
 */

import { WidgetType } from '@/lib/dashboard-types';
import BitcoinChartWidget from '@/components/widgets/BitcoinChartWidget';
import LatestTransactionsWidget from '@/components/widgets/LatestTransactionsWidget';
import GoalsOverviewWidget from '@/components/widgets/GoalsOverviewWidget';
import PortfolioSummaryWidget from '@/components/widgets/PortfolioSummaryWidget';
import DCAAnalysisWidget from '@/components/widgets/DCAAnalysisWidget';
import MultiTimeframeWidget from '@/components/widgets/MultiTimeframeWidget';
import MonthlySummaryWidget from '@/components/widgets/MonthlySummaryWidget';
import AutoDCAWidget from '@/components/widgets/AutoDCAWidget';
import WalletDistributionWidget from '@/components/widgets/WalletDistributionWidget';

// Map widget types to components
export const WIDGET_COMPONENTS: Record<WidgetType, React.ComponentType<any>> = {
  chart: BitcoinChartWidget,
  transactions: LatestTransactionsWidget,
  goals: GoalsOverviewWidget,
  portfolio: PortfolioSummaryWidget,
  dca: DCAAnalysisWidget,
  timeframe: MultiTimeframeWidget,
  monthly: MonthlySummaryWidget,
  'auto-dca': AutoDCAWidget,
  'wallet-distribution': WalletDistributionWidget,
};

/**
 * Get the component for a widget type
 */
export function getWidgetComponent(type: WidgetType) {
  return WIDGET_COMPONENTS[type];
}

/**
 * Check if a widget type is valid
 */
export function isValidWidgetType(type: string): type is WidgetType {
  return type in WIDGET_COMPONENTS;
}

