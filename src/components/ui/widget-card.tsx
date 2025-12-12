'use client';

import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RefreshCwIcon, AlertCircleIcon, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WidgetCardProps {
  // Header
  title?: string;
  description?: string;
  icon?: LucideIcon;
  badge?: string | React.ReactNode;
  
  // State
  loading?: boolean;
  error?: string | null;
  
  // Actions
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  
  // Content
  children: React.ReactNode;
  
  // Footer (optional stats, actions, etc.)
  footer?: React.ReactNode;
  
  // Responsive behavior
  onHeightChange?: (height: number) => void;
  
  // Styling
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
}

/**
 * Unified Widget Card Component
 * 
 * Provides consistent styling, loading states, error handling, and refresh functionality
 * for all dashboard widgets using shadcn/ui components.
 * 
 * @example
 * ```tsx
 * <WidgetCard
 *   title="Portfolio Summary"
 *   icon={WalletIcon}
 *   loading={loading}
 *   onRefresh={handleRefresh}
 *   refreshing={refreshing}
 * >
 *   <div>Your content here</div>
 * </WidgetCard>
 * ```
 */
export function WidgetCard({
  title,
  description,
  icon: Icon,
  badge,
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  children,
  footer,
  onHeightChange,
  className,
  contentClassName,
  noPadding = false,
}: WidgetCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Monitor height changes for responsive widgets
  useEffect(() => {
    if (!onHeightChange || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        onHeightChange(height);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [onHeightChange]);

  const handleRefresh = async () => {
    if (onRefresh && !refreshing) {
      await onRefresh();
    }
  };

  return (
    <Card ref={containerRef} className={cn("h-full flex flex-col overflow-hidden", className)}>
      {/* Header */}
      {(title || onRefresh) && (
        <CardHeader className="pb-2 space-y-0 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {Icon && <Icon className="size-4 text-btc-500 shrink-0" />}
              <CardTitle className="text-base truncate">{title}</CardTitle>
              {badge && (
                typeof badge === 'string' ? (
                  <Badge variant="secondary" className="ml-auto shrink-0">{badge}</Badge>
                ) : (
                  badge
                )
              )}
            </div>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="shrink-0 size-7"
              >
                <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
                <span className="sr-only">Refresh</span>
              </Button>
            )}
          </div>
          {description && (
            <CardDescription className="text-xs mt-1">{description}</CardDescription>
          )}
        </CardHeader>
      )}

      {/* Content */}
      <CardContent className={cn(
        "flex-1 min-h-0 flex flex-col",
        noPadding ? "p-0 overflow-hidden" : "overflow-auto",
        contentClassName
      )}>
        {loading ? (
          <WidgetSkeleton />
        ) : error ? (
          <WidgetError error={error} onRetry={onRefresh} />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {children}
          </div>
        )}
      </CardContent>

      {/* Footer */}
      {footer && !loading && !error && (
        <CardContent className="pt-2 pb-4 border-t mt-auto shrink-0">
          {footer}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Default loading skeleton for widgets
 * Uses fixed widths to avoid hydration mismatch
 */
export function WidgetSkeleton({ lines = 4 }: { lines?: number }) {
  const widths = ['75%', '60%', '80%', '65%', '70%', '55%'];
  
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-4" 
          style={{ width: widths[i % widths.length] }} 
        />
      ))}
    </div>
  );
}

/**
 * Default error state for widgets
 */
export function WidgetError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
      <AlertCircleIcon className="size-8 text-destructive mb-2" />
      <p className="text-sm text-muted-foreground mb-3">{error}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

/**
 * Widget stats footer component
 * For displaying high/low/range or other metrics
 */
export interface WidgetStatsProps {
  stats: Array<{
    label: string;
    value: string | number;
    color?: 'default' | 'profit' | 'loss' | 'btc';
  }>;
}

export function WidgetStats({ stats }: WidgetStatsProps) {
  const getColorClass = (color?: string) => {
    switch (color) {
      case 'profit':
        return 'text-green-600 dark:text-green-400';
      case 'loss':
        return 'text-red-600 dark:text-red-400';
      case 'btc':
        return 'text-btc-500';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className={cn("grid gap-4", `grid-cols-${Math.min(stats.length, 4)}`)}>
      {stats.map((stat, i) => (
        <div key={i} className="text-center">
          <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
          <p className={cn("text-sm font-semibold", getColorClass(stat.color))}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Widget list item component
 * For displaying transactions, goals, etc. in a consistent way
 */
export interface WidgetListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string | React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function WidgetListItem({
  icon,
  title,
  subtitle,
  value,
  badge,
  onClick,
  className,
}: WidgetListItemProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors",
        onClick && "hover:bg-muted cursor-pointer w-full text-left",
        className
      )}
    >
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{title}</p>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {value && (
        <div className="shrink-0 text-right">
          {typeof value === 'string' ? (
            <p className="text-sm font-semibold">{value}</p>
          ) : (
            value
          )}
        </div>
      )}
    </Component>
  );
}

/**
 * Empty state component for widgets with no data
 */
export interface WidgetEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function WidgetEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: WidgetEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
      {Icon && <Icon className="size-12 text-muted-foreground/50 mb-3" />}
      <h4 className="text-sm font-medium mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

