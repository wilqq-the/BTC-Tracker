/**
 * Dashboard Constants
 * Configuration and default values for the dashboard grid system
 */

import { WidgetDefinition, DashboardLayout, WidgetType } from './dashboard-types';

// Grid configuration
export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 80;
export const GRID_MARGIN: [number, number] = [16, 16];
export const GRID_CONTAINER_PADDING: [number, number] = [16, 16];

// Breakpoints (desktop only for now)
export const GRID_BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
};

// Columns per breakpoint (all same for now since we skip mobile responsiveness)
export const GRID_COLS_PER_BREAKPOINT = {
  lg: 12,
  md: 12,
  sm: 12,
  xs: 12,
};

// Widget definitions with metadata
export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  {
    id: 'bitcoin-chart',
    type: 'chart',
    title: 'Bitcoin Price Chart',
    icon: '📈',
    description: 'Real-time Bitcoin price chart with technical indicators',
    minW: 6,
    minH: 3,
    defaultW: 12,
    defaultH: 4,
    category: 'Market Data',
  },
  {
    id: 'latest-transactions',
    type: 'transactions',
    title: 'Latest Transactions',
    icon: '💸',
    description: 'Your 5 most recent Bitcoin transactions',
    minW: 4,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    category: 'Portfolio',
  },
  {
    id: 'goals-overview',
    type: 'goals',
    title: 'Savings Goals',
    icon: '🎯',
    description: 'Overview of your Bitcoin savings goals',
    minW: 4,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    category: 'Planning',
  },
  {
    id: 'portfolio-summary',
    type: 'portfolio',
    title: 'Portfolio Summary',
    icon: '💼',
    description: 'Overview of your Bitcoin holdings and performance',
    minW: 3,
    minH: 2,
    defaultW: 4,
    defaultH: 3,
    category: 'Portfolio',
  },
  {
    id: 'dca-analysis',
    type: 'dca',
    title: 'DCA Performance',
    icon: '📊',
    description: 'Dollar Cost Averaging strategy analysis',
    minW: 4,
    minH: 2,
    defaultW: 8,
    defaultH: 3,
    category: 'Analytics',
  },
  {
    id: 'multi-timeframe',
    type: 'timeframe',
    title: 'Multi-Timeframe Performance',
    icon: '📈',
    description: 'Performance across 24h, 7d, 30d, 1y, and all-time',
    minW: 4,
    minH: 3,
    defaultW: 6,
    defaultH: 4,
    category: 'Analytics',
  },
  {
    id: 'monthly-summary',
    type: 'monthly',
    title: 'Monthly Summary',
    icon: '📅',
    description: 'Current month accumulation statistics',
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 4,
    category: 'Portfolio',
  },
];

// Default dashboard layout
export const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: [
    // Row 1: Full-width chart
    {
      id: 'bitcoin-chart',
      type: 'chart',
      x: 0,
      y: 0,
      w: 12,
      h: 4,
      visible: true,
    },
    // Row 2: Transactions (left) + Goals (right)
    {
      id: 'latest-transactions',
      type: 'transactions',
      x: 0,
      y: 4,
      w: 6,
      h: 4,
      visible: true,
    },
    {
      id: 'goals-overview',
      type: 'goals',
      x: 6,
      y: 4,
      w: 6,
      h: 4,
      visible: true,
    },
    // Row 3: Portfolio (left) + DCA Analysis (center-right)
    {
      id: 'portfolio-summary',
      type: 'portfolio',
      x: 0,
      y: 8,
      w: 4,
      h: 3,
      visible: true,
    },
    {
      id: 'dca-analysis',
      type: 'dca',
      x: 4,
      y: 8,
      w: 8,
      h: 3,
      visible: true,
    },
    // New widgets (hidden by default - users can add them)
    {
      id: 'multi-timeframe',
      type: 'timeframe',
      x: 0,
      y: 11,
      w: 6,
      h: 4,
      visible: false,
    },
    {
      id: 'monthly-summary',
      type: 'monthly',
      x: 6,
      y: 11,
      w: 4,
      h: 4,
      visible: false,
    },
  ],
};

// Widget type to definition lookup
export const getWidgetDefinition = (type: WidgetType): WidgetDefinition | undefined => {
  return AVAILABLE_WIDGETS.find(w => w.type === type);
};

// Get widget definition by ID
export const getWidgetDefinitionById = (id: string): WidgetDefinition | undefined => {
  return AVAILABLE_WIDGETS.find(w => w.id === id);
};

// Create a new widget instance
export const createWidgetInstance = (
  type: WidgetType,
  x: number = 0,
  y: number = 0
) => {
  const definition = getWidgetDefinition(type);
  if (!definition) return null;

  return {
    id: definition.id,
    type: definition.type,
    x,
    y,
    w: definition.defaultW,
    h: definition.defaultH,
    visible: true,
  };
};

