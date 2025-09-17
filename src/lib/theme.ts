// Bitcoin Tracker Theme System
// All colors and design tokens in one place for easy modification

// Dark theme (current default)
export const darkTheme = {
  // Main color palette
  colors: {
    // Background colors
    background: {
      primary: '#0f0f0f',      // Main dark background
      secondary: '#1a1a1a',    // Cards, panels
      tertiary: '#262626',     // Hover states, borders
      sidebar: '#141414',      // Sidebar background
    },
    
    // Text colors
    text: {
      primary: '#ffffff',      // Main text
      secondary: '#a3a3a3',    // Secondary text, labels
      muted: '#666666',        // Muted text, placeholders
      inverse: '#000000',      // Text on light backgrounds
    },
    
    // Brand colors (Orange theme)
    brand: {
      primary: '#f97316',      // Main orange (Bitcoin theme)
      secondary: '#fb923c',    // Lighter orange
      dark: '#ea580c',         // Darker orange
      light: '#fed7aa',        // Very light orange
    },
    
    // Status colors
    success: {
      primary: '#22c55e',      // Green for profits/gains
      secondary: '#16a34a',    // Darker green
      light: '#dcfce7',        // Light green background
      muted: '#166534',        // Muted green text
    },
    
    danger: {
      primary: '#ef4444',      // Red for losses/negative
      secondary: '#dc2626',    // Darker red
      light: '#fef2f2',        // Light red background
      muted: '#991b1b',        // Muted red text
    },
    
    // Neutral colors
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    
    // Border colors
    border: {
      primary: '#404040',      // Main borders
      secondary: '#2a2a2a',    // Subtle borders
      accent: '#f97316',       // Accent borders (orange)
    },
    
    // Chart colors
    chart: {
      line: '#f97316',         // Main chart line (orange)
      area: '#f9731620',       // Chart area fill (orange with alpha)
      grid: '#2a2a2a',         // Chart grid lines
      buy: '#22c55e',          // Buy markers
      sell: '#ef4444',         // Sell markers
      volume: '#666666',       // Volume bars
    },
  },
  
  // Typography
  typography: {
    fonts: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Monaco', 'monospace'],
    },
    
    sizes: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
    },
    
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  
  // Spacing
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },
  
  // Border radius
  radius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  
  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },
} as const;

// Light theme
export const lightTheme = {
  // Main color palette
  colors: {
    // Background colors
    background: {
      primary: '#ffffff',      // Main light background
      secondary: '#f8fafc',    // Cards, panels
      tertiary: '#f1f5f9',     // Hover states, borders
      sidebar: '#f9fafb',      // Sidebar background
    },
    
    // Text colors
    text: {
      primary: '#0f172a',      // Main text
      secondary: '#475569',    // Secondary text, labels
      muted: '#94a3b8',        // Muted text, placeholders
      inverse: '#ffffff',      // Text on dark backgrounds
    },
    
    // Brand colors (Orange theme - same as dark)
    brand: {
      primary: '#f97316',      // Main orange (Bitcoin theme)
      secondary: '#fb923c',    // Lighter orange
      dark: '#ea580c',         // Darker orange
      light: '#fed7aa',        // Very light orange
    },
    
    // Status colors (same as dark)
    success: {
      primary: '#22c55e',      // Green for profits/gains
      secondary: '#16a34a',    // Darker green
      light: '#dcfce7',        // Light green background
      muted: '#166534',        // Muted green text
    },
    
    danger: {
      primary: '#ef4444',      // Red for losses/negative
      secondary: '#dc2626',    // Darker red
      light: '#fef2f2',        // Light red background
      muted: '#991b1b',        // Muted red text
    },
    
    // Neutral colors (same as dark)
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    
    // Border colors
    border: {
      primary: '#e2e8f0',      // Main borders
      secondary: '#f1f5f9',    // Subtle borders
      accent: '#f97316',       // Accent borders (orange)
    },
    
    // Chart colors
    chart: {
      line: '#f97316',         // Main chart line (orange)
      area: '#f9731620',       // Chart area fill (orange with alpha)
      grid: '#e2e8f0',         // Chart grid lines
      buy: '#22c55e',          // Buy markers
      sell: '#ef4444',         // Sell markers
      volume: '#94a3b8',       // Volume bars
    },
  },
  
  // Typography (same as dark)
  typography: {
    fonts: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Monaco', 'monospace'],
    },
    
    sizes: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
    },
    
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  
  // Spacing (same as dark)
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },
  
  // Border radius (same as dark)
  radius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',
  },
  
  // Shadows (adjusted for light theme)
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  
  // Transitions (same as dark)
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },
} as const;

// Default theme (dark)
export const theme = darkTheme;

// Theme getter function
export const getTheme = (themeName: 'dark' | 'light' = 'dark') => {
  return themeName === 'light' ? lightTheme : darkTheme;
};

// CSS-in-JS style helpers
export const styles = {
  // Common component styles
  card: {
    backgroundColor: theme.colors.background.secondary,
    borderColor: theme.colors.border.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  
  sidebar: {
    backgroundColor: theme.colors.background.sidebar,
    borderColor: theme.colors.border.secondary,
  },
  
  button: {
    primary: {
      backgroundColor: theme.colors.brand.primary,
      color: theme.colors.text.primary,
      borderRadius: theme.radius.md,
      transition: theme.transitions.normal,
    },
    secondary: {
      backgroundColor: theme.colors.background.tertiary,
      color: theme.colors.text.secondary,
      borderColor: theme.colors.border.primary,
      borderRadius: theme.radius.md,
      transition: theme.transitions.normal,
    },
  },
  
  input: {
    backgroundColor: theme.colors.background.tertiary,
    borderColor: theme.colors.border.primary,
    color: theme.colors.text.primary,
    borderRadius: theme.radius.md,
    fontSize: theme.typography.sizes.sm,
  },
  
  text: {
    primary: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.sizes.base,
    },
    secondary: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.sizes.sm,
    },
    muted: {
      color: theme.colors.text.muted,
      fontSize: theme.typography.sizes.xs,
    },
  },
};

// Utility functions for colors
export const getStatusColor = (value: number) => {
  if (value > 0) return theme.colors.success.primary;
  if (value < 0) return theme.colors.danger.primary;
  return theme.colors.text.secondary;
};

export const getStatusTextClass = (value: number) => {
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-gray-400';
};

// Currency formatting with theme colors
export const formatCurrency = (amount: number | undefined | null, currency: string = '') => {
  // Handle undefined or null amounts
  if (amount === undefined || amount === null || isNaN(amount)) {
    return currency ? `${currency} 0.00` : '$0.00';
  }
  
  const getCurrencySymbol = (curr: string) => {
    switch (curr.toUpperCase()) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'PLN': return 'zł';
      case 'GBP': return '£';
      case 'CAD': return 'C$';
      case 'AUD': return 'A$';
      case 'JPY': return '¥';
      case 'CHF': return 'CHF ';
      case 'SEK': 
      case 'NOK': return 'kr';
      default: return curr ? `${curr} ` : '';
    }
  };

  const symbol = getCurrencySymbol(currency);
  const formatted = Math.abs(amount).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  // For currencies that go after the amount (like PLN)
  if (currency === 'PLN' || currency === 'SEK' || currency === 'NOK') {
    return `${formatted} ${symbol}`;
  }
  
  return `${symbol}${formatted}`;
};

export const formatPercentage = (percent: number) => {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}; 