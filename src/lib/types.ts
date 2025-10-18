// Bitcoin Transaction Types (Database Schema)
export interface BitcoinTransaction {
  id: number;
  type: 'BUY' | 'SELL';
  btc_amount: number; // Amount of BTC bought/sold
  
  // Original transaction data (what user actually entered)
  original_price_per_btc: number; // Price per BTC in original currency
  original_currency: string; // Currency used for transaction (USD, EUR, PLN, INR, etc.)
  original_total_amount: number; // Total amount in original currency
  
  // Fees and metadata
  fees: number; // Transaction fees
  fees_currency: string; // Currency of fees
  transaction_date: string; // Date of transaction (YYYY-MM-DD)
  notes: string; // Optional notes
  
  // Tracking
  created_at: string; // When record was created
  updated_at: string; // When record was last updated
}

// Enhanced Transaction (with calculated currency conversions)
export interface EnhancedTransaction extends BitcoinTransaction {
  // Dynamically calculated main currency values
  main_currency: string;
  main_currency_price_per_btc: number;
  main_currency_total_amount: number;
  
  // Dynamically calculated secondary currency values
  secondary_currency: string;
  secondary_currency_price_per_btc: number;
  secondary_currency_total_amount: number;
  secondary_currency_current_value: number;
  secondary_currency_pnl: number;
  
  // Current values and P&L
  current_value_main: number;
  pnl_main: number;
}

export interface TransactionFormData {
  type: 'BUY' | 'SELL';
  btc_amount: string;
  price_per_btc: string;
  currency: string;
  fees: string;
  transaction_date: string;
  notes: string;
  tags?: string;
}

export interface TransactionSummary {
  total_transactions: number;
  total_buy_transactions: number;
  total_sell_transactions: number;
  total_btc_bought: number;
  total_btc_sold: number;
  current_btc_holdings: number;
  total_usd_invested: number;
  total_usd_received: number;
  total_fees_paid: number;
  average_buy_price: number;
  average_sell_price: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  roi_percentage: number;
}

export interface TransactionFilters {
  type?: 'ALL' | 'BUY' | 'SELL';
  date_from?: string;
  date_to?: string;
  currency?: string;
  min_amount?: number;
  max_amount?: number;
}

export interface TransactionSort {
  field: 'date' | 'amount' | 'price' | 'total' | 'pnl';
  order: 'asc' | 'desc';
}

// Portfolio Calculation Types
export interface PortfolioHolding {
  btc_amount: number;
  average_cost_basis: number; // Average price paid per BTC
  total_cost_basis: number; // Total amount invested
  current_value: number; // Current USD value
  unrealized_pnl: number; // Unrealized profit/loss
  unrealized_pnl_percentage: number; // Unrealized P&L percentage
}

export interface PortfolioPerformance {
  total_invested: number;
  total_received: number; // From sells
  current_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  total_pnl_percentage: number;
  total_fees: number;
}

// Exchange and Price Data Types
export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  timestamp: string;
}



// API Response Types
export interface TransactionResponse {
  success: boolean;
  data?: BitcoinTransaction | BitcoinTransaction[];
  summary?: TransactionSummary;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message: string;
  error?: string;
}

export interface PortfolioResponse {
  success: boolean;
  data?: {
    holdings: PortfolioHolding;
    performance: PortfolioPerformance;
    transactions: BitcoinTransaction[];
  };
  message: string;
  error?: string;
}

// Historical Bitcoin Price Data (daily OHLC)
export interface BitcoinPriceHistory {
  id: number;
  date: string; // YYYY-MM-DD format
  open_usd: number;
  high_usd: number;
  low_usd: number;
  close_usd: number;
  volume?: number;
  created_at: string;
}

// Intraday Bitcoin Price Data (5-10 minute intervals)
export interface BitcoinPriceIntraday {
  id: number;
  timestamp: string; // ISO datetime
  price_usd: number;
  volume?: number;
  created_at: string;
}

// Exchange Rates
export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  last_updated: string;
}

// Portfolio Summary (calculated)
export interface PortfolioSummary {
  total_btc: number;
  average_buy_price: number; // In main currency
  total_invested: number; // In main currency
  current_value: number; // In main currency
  unrealized_pnl: number; // In main currency
  unrealized_pnl_percentage: number;
  main_currency: string;
  
  // Secondary currency display
  secondary_currency: string;
  current_value_secondary: number;
  
  // Legacy fields (for backward compatibility)
  average_buy_price_usd?: number;
  total_invested_usd?: number;
  current_value_usd?: number;
  unrealized_pnl_usd?: number;
  current_value_eur?: number;
}

// Supported currencies for different purposes
export type MainCurrency = 'USD' | 'EUR'; // Only USD and EUR allowed for calculations
export type SupportedCurrency = 'USD' | 'EUR' | 'PLN' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'CHF' | 'SEK' | 'NOK';

// Settings Types
export interface CurrencySettings {
  mainCurrency: MainCurrency;          // Used for calculations (USD or EUR ONLY)
  secondaryCurrency: SupportedCurrency; // Used for display only (any supported currency)
  supportedCurrencies: SupportedCurrency[]; // All currencies users can transact in
  autoUpdateRates: boolean;
  rateUpdateInterval: number;          // hours
  fallbackToHardcodedRates: boolean;   // If API fails, use hardcoded rates
}

export interface PriceDataSettings {
  historicalDataPeriod: string;    // '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'ALL'
  intradayInterval: string;        // '1m' | '5m' | '15m' | '30m' | '1h'
  priceUpdateInterval: number;     // minutes for live price updates (legacy)
  liveUpdateInterval: number;      // seconds for live price updates
  enableIntradayData: boolean;     // whether to collect intraday data
  maxHistoricalDays: number;       // how many days to keep in database (legacy)
  dataRetentionDays: number;       // days to keep historical data
  maxIntradayDays: number;         // how many days of intraday data to keep
}

export interface DisplaySettings {
  theme: 'dark' | 'light';
  dateFormat: string;              // 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12h' | '24h';
  decimalPlaces: number;           // for BTC amounts
  currencyDecimalPlaces: number;   // for fiat amounts
  showSatoshis: boolean;
  compactNumbers: boolean;         // 1.2K instead of 1,200
}

export interface NotificationSettings {
  priceAlerts: boolean;
  priceThresholds: {
    high: number;
    low: number;
  };
  portfolioAlerts: boolean;
  portfolioThresholds: {
    profitPercent: number;
    lossPercent: number;
  };
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface AppSettings {
  id: number;
  currency: CurrencySettings;
  priceData: PriceDataSettings;
  display: DisplaySettings;
  notifications: NotificationSettings;
  lastUpdated: string;
  version: string;
}

// Default settings
export const defaultSettings: Omit<AppSettings, 'id' | 'lastUpdated'> = {
  currency: {
    mainCurrency: 'USD' as MainCurrency,
    secondaryCurrency: 'EUR' as SupportedCurrency,
    supportedCurrencies: ['USD', 'EUR', 'PLN', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK'] as SupportedCurrency[],
    autoUpdateRates: true,
    rateUpdateInterval: 4, // 4 hours
    fallbackToHardcodedRates: true,
  },
  priceData: {
    historicalDataPeriod: '1Y',
    intradayInterval: '5m',
    priceUpdateInterval: 5, // 5 minutes (legacy)
    liveUpdateInterval: 300, // 5 minutes in seconds
    enableIntradayData: true,
    maxHistoricalDays: 730, // 2 years (legacy)
    dataRetentionDays: 365, // 1 year
    maxIntradayDays: 7,     // 1 week
  },
  display: {
    theme: 'dark',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '24h',
    decimalPlaces: 8,
    currencyDecimalPlaces: 2,
    showSatoshis: true,
    compactNumbers: false,
  },
  notifications: {
    priceAlerts: false,
    priceThresholds: {
      high: 120000,
      low: 80000,
    },
    portfolioAlerts: false,
    portfolioThresholds: {
      profitPercent: 50,
      lossPercent: -20,
    },
    emailNotifications: false,
    pushNotifications: false,
  },
  version: '1.0.0',
}; 