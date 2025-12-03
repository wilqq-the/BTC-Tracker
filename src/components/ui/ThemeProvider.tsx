'use client';

import React, { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

// Re-export useTheme for convenience
export { useTheme };

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {/* Use CSS variables from globals.css - no hardcoded colors */}
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </NextThemesProvider>
  );
}

// Legacy components kept for backward compatibility
// These should be replaced with shadcn/ui components

export function ThemedCard({ 
  children, 
  className = '', 
  padding = true,
  ...props 
}: { 
  children: ReactNode; 
  className?: string; 
  padding?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`
        bg-card text-card-foreground
        border border-border 
        rounded-lg 
        ${padding ? 'p-6' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function ThemedText({ 
  children, 
  variant = 'primary',
  size = 'base',
  className = '',
  ...props 
}: { 
  children: ReactNode; 
  variant?: 'primary' | 'secondary' | 'muted';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  
  const variantClasses = {
    primary: 'text-foreground',
    secondary: 'text-muted-foreground',
    muted: 'text-muted-foreground/70',
  };
  
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
  };
  
  return (
    <span
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}

export function ThemedButton({ 
  children, 
  variant = 'primary',
  size = 'md',
  className = '',
  ...props 
}: { 
  children: ReactNode; 
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  
  const baseClasses = 'font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring';
  
  const variantClasses = {
    primary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border',
    ghost: 'hover:bg-accent text-muted-foreground hover:text-foreground',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  
  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
