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
// Note: icon field stores lucide-react icon name for reference
export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  {
    id: 'portfolio-hero',
    type: 'hero',
    title: 'Your portfolio',
    icon: 'Wallet',
    description: 'Portfolio value, all-time P&L and the price chart with your buys and sells',
    minW: 5,
    minH: 4,
    defaultW: 8,
    defaultH: 6,
    category: 'Portfolio',
  },
  {
    id: 'quick-actions',
    type: 'quick-actions',
    title: 'Quick actions',
    icon: 'Zap',
    description: 'Buy, sell, transfer or import in one tap',
    minW: 3,
    minH: 3,
    defaultW: 4,
    defaultH: 4,
    category: 'Portfolio',
  },
  {
    id: 'btc-price',
    type: 'btc-price',
    title: 'Bitcoin price',
    icon: 'Bitcoin',
    description: 'Live BTC price and 24h change',
    minW: 3,
    minH: 1,
    defaultW: 4,
    defaultH: 2,
    category: 'Market Data',
  },
  {
    id: 'hodl-milestones',
    type: 'milestones',
    title: 'HODL milestones',
    icon: 'Trophy',
    description: 'Your stacking milestones, from Satoshi Starter to Whale',
    minW: 3,
    minH: 4,
    defaultW: 4,
    defaultH: 4,
    category: 'Portfolio',
  },
  {
    id: 'bitcoin-chart',
    type: 'chart',
    title: 'Price chart',
    icon: 'LineChart',
    description: 'Bitcoin price chart with your buys and sells',
    minW: 4,
    minH: 4,
    defaultW: 12,
    defaultH: 4,
    category: 'Market Data',
  },
  {
    id: 'latest-transactions',
    type: 'transactions',
    title: 'Recent transactions',
    icon: 'ArrowLeftRight',
    description: 'Your latest transactions',
    minW: 3,
    minH: 2,
    defaultW: 6,
    defaultH: 4,
    category: 'Portfolio',
  },
  {
    id: 'goals-overview',
    type: 'goals',
    title: 'Savings goals',
    icon: 'Target',
    description: 'Progress on your savings goals',
    minW: 3,
    minH: 2,
    defaultW: 6,
    defaultH: 4,
    category: 'Planning',
  },
  {
    id: 'portfolio-summary',
    type: 'portfolio',
    title: 'Portfolio summary',
    icon: 'Wallet',
    description: 'Holdings, cost basis and P&L in one card',
    minW: 2,
    minH: 2,
    defaultW: 4,
    defaultH: 3,
    category: 'Portfolio',
  },
  {
    id: 'dca-analysis',
    type: 'dca',
    title: 'DCA score',
    icon: 'TrendingUp',
    description: 'How consistent and well-timed your buying is',
    minW: 3,
    minH: 2,
    defaultW: 8,
    defaultH: 3,
    category: 'Analytics',
  },
  {
    id: 'multi-timeframe',
    type: 'timeframe',
    title: 'Performance',
    icon: 'Activity',
    description: 'Performance over 24h, 7d, 30d, 1y and all time',
    minW: 3,
    minH: 2,
    defaultW: 6,
    defaultH: 4,
    category: 'Analytics',
  },
  {
    id: 'monthly-summary',
    type: 'monthly',
    title: 'This month',
    icon: 'Calendar',
    description: 'What you stacked this month',
    minW: 2,
    minH: 2,
    defaultW: 4,
    defaultH: 4,
    category: 'Portfolio',
  },
  {
    id: 'auto-dca',
    type: 'auto-dca',
    title: 'Auto DCA',
    icon: 'RefreshCw',
    description: 'Your recurring purchases and when they run next',
    minW: 2,
    minH: 2,
    defaultW: 4,
    defaultH: 4,
    category: 'Planning',
  },
  {
    id: 'wallet-distribution',
    type: 'wallet-distribution',
    title: 'Wallets',
    icon: 'Shield',
    description: 'How your bitcoin is split across wallets',
    minW: 2,
    minH: 2,
    defaultW: 3,
    defaultH: 3,
    category: 'Portfolio',
  },
];

// Default dashboard layout
export const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: [
    // Row 1: hero (portfolio + chart) | quick actions over the DCA score
    { id: 'portfolio-hero', type: 'hero', x: 0, y: 0, w: 8, h: 6, visible: true },
    { id: 'quick-actions', type: 'quick-actions', x: 8, y: 0, w: 4, h: 3, visible: true },
    { id: 'dca-analysis', type: 'dca', x: 8, y: 3, w: 4, h: 3, visible: true },
    // Row 2: recent transactions | wallets
    { id: 'latest-transactions', type: 'transactions', x: 0, y: 6, w: 8, h: 4, visible: true },
    { id: 'wallet-distribution', type: 'wallet-distribution', x: 8, y: 6, w: 4, h: 4, visible: true },
    // Row 3: milestones | goals
    { id: 'hodl-milestones', type: 'milestones', x: 0, y: 10, w: 6, h: 4, visible: true },
    { id: 'goals-overview', type: 'goals', x: 6, y: 10, w: 6, h: 4, visible: true },
    // Available from "Add widget" (the sidebar already shows the live price)
    { id: 'btc-price', type: 'btc-price', x: 0, y: 13, w: 4, h: 2, visible: false },
    { id: 'bitcoin-chart', type: 'chart', x: 0, y: 15, w: 12, h: 5, visible: false },
    { id: 'portfolio-summary', type: 'portfolio', x: 0, y: 20, w: 4, h: 4, visible: false },
    { id: 'multi-timeframe', type: 'timeframe', x: 4, y: 20, w: 4, h: 4, visible: false },
    { id: 'monthly-summary', type: 'monthly', x: 8, y: 20, w: 4, h: 4, visible: false },
    { id: 'auto-dca', type: 'auto-dca', x: 0, y: 24, w: 4, h: 4, visible: false },
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

