'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ActivityIcon,
  DatabaseIcon,
  RefreshCwIcon,
  ClockIcon,
  TrendingUpIcon,
  RepeatIcon,
  DollarSignIcon,
  ServerIcon,
  XCircleIcon,
  Loader2Icon,
} from 'lucide-react';
import packageJson from '../../package.json';

interface SubsystemStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  lastActivity?: string;
  nextScheduled?: string;
  details?: Record<string, any>;
}

interface SystemStatusData {
  timestamp: string;
  uptime: number;
  nodeVersion: string;
  environment: string;
  app: {
    isInitialized: boolean;
    isInitializing: boolean;
    processId: number;
  };
  subsystems: SubsystemStatus[];
  database: {
    status: 'connected' | 'disconnected' | 'error';
    stats?: {
      totalTransactions: number;
      intradayRecords: number;
      historicalRecords: number;
      recurringTransactions: number;
      activeRecurring: number;
    };
  };
  priceData: {
    currentPrice?: {
      price: number;
      change24h?: number;
      source: string;
      lastUpdate: string;
    };
    latestIntraday?: {
      timestamp: string;
      price: number;
    };
    latestHistorical?: {
      date: string;
      price: number;
    };
  };
  exchangeRates: {
    lastUpdate?: string;
    ratesCount: number;
    baseCurrency?: string;
  };
}

interface SystemStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatusIndicator({ status }: { status: 'running' | 'stopped' | 'error' | 'unknown' | 'connected' | 'disconnected' }) {
  const statusConfig = {
    running: { color: 'bg-tint-green-fg', pulse: false, label: 'Running' },
    connected: { color: 'bg-tint-green-fg', pulse: false, label: 'Connected' },
    stopped: { color: 'bg-primary', pulse: false, label: 'Stopped' },
    error: { color: 'bg-tint-red-fg', pulse: true, label: 'Error' },
    disconnected: { color: 'bg-tint-red-fg', pulse: false, label: 'Disconnected' },
    unknown: { color: 'bg-muted-foreground', pulse: false, label: 'Unknown' },
  };

  const config = statusConfig[status] || statusConfig.unknown;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={cn(
          'size-2.5 rounded-full',
          config.color
        )} />
        {config.pulse && (
          <div className={cn(
            'absolute inset-0 size-2.5 rounded-full animate-ping opacity-75',
            config.color
          )} />
        )}
      </div>
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}

function SubsystemCard({ subsystem, icon: Icon }: { subsystem: SubsystemStatus; icon: React.ElementType }) {
  return (
    <div className="flex items-start justify-between gap-3 px-1 py-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <h4 className="text-sm font-semibold">{subsystem.name}</h4>
          {subsystem.details?.description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {subsystem.details.description}
            </p>
          )}
          {subsystem.details?.interval && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <ClockIcon className="size-3" />
              {subsystem.details.interval}
            </p>
          )}
          {subsystem.details?.activeTransactions !== undefined && (
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {subsystem.details.activeTransactions} active, {subsystem.details.pausedTransactions} paused
            </p>
          )}
        </div>
      </div>
      <StatusIndicator status={subsystem.status} />
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

export function SystemStatusDialog({ open, onOpenChange }: SystemStatusDialogProps) {
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/system/status');
      const result = await response.json();
      
      if (result.success) {
        setStatus(result.status);
      } else {
        setError(result.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open, fetchStatus]);

  // Map subsystem names to icons
  const getSubsystemIcon = (name: string): React.ElementType => {
    if (name.includes('Intraday') || name.includes('Price Updates')) return ActivityIcon;
    if (name.includes('Historical')) return TrendingUpIcon;
    if (name.includes('Exchange')) return DollarSignIcon;
    if (name.includes('DCA')) return RepeatIcon;
    if (name.includes('Database')) return DatabaseIcon;
    return ServerIcon;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>System status</DialogTitle>
          <DialogDescription>
            The background services that keep prices and data up to date.
          </DialogDescription>
        </DialogHeader>

        {loading && !status ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error && !status ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <XCircleIcon className="size-8 text-tint-red-fg mb-3" />
            <p className="text-sm font-semibold">Couldn&apos;t load the status</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4 rounded-full font-semibold"
              onClick={fetchStatus}
            >
              <RefreshCwIcon className="size-4" />
              Try again
            </Button>
          </div>
        ) : status ? (
          <div className="space-y-6">
            {/* App Status Overview */}
            <div className="card-solid grid grid-cols-3 gap-4 rounded-2xl p-4">
              <div>
                <div className="text-[13px] font-semibold text-muted-foreground">App</div>
                <div className={cn('mt-0.5 font-bold', status.app.isInitialized ? 'text-tint-green-fg' : 'text-primary-strong')}>
                  {status.app.isInitialized ? 'Ready' : 'Starting...'}
                </div>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-muted-foreground">Uptime</div>
                <div className="mt-0.5 font-bold tabular-nums">{formatUptime(status.uptime)}</div>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-muted-foreground">Database</div>
                <div className={cn('mt-0.5 font-bold capitalize', status.database.status === 'connected' ? 'text-tint-green-fg' : 'text-tint-red-fg')}>
                  {status.database.status}
                </div>
              </div>
            </div>

            {/* Current Price */}
            {status.priceData.currentPrice && (
              <div className="card-solid rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-muted-foreground">
                      Bitcoin price
                    </div>
                    <div className="text-2xl font-extrabold tracking-tight tabular-nums">
                      {formatPrice(status.priceData.currentPrice.price)}
                    </div>
                    {status.priceData.currentPrice.change24h !== undefined && (
                      <div className={cn(
                        'text-sm font-medium tabular-nums',
                        status.priceData.currentPrice.change24h > 0 ? 'text-tint-green-fg' : status.priceData.currentPrice.change24h < 0 ? 'text-tint-red-fg' : 'text-muted-foreground'
                      )}>
                        {status.priceData.currentPrice.change24h > 0 ? '+' : ''}
                        {status.priceData.currentPrice.change24h.toFixed(2)}% in 24h
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>From {status.priceData.currentPrice.source}</div>
                    <div>Updated {formatDateTime(status.priceData.currentPrice.lastUpdate)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Subsystems */}
            <div>
              <h3 className="mb-2 text-[15px] font-bold">Background services</h3>
              <div className="card-solid divide-y divide-border/60 rounded-2xl px-3">
                {status.subsystems.map((subsystem, index) => (
                  <SubsystemCard
                    key={index}
                    subsystem={subsystem}
                    icon={getSubsystemIcon(subsystem.name)}
                  />
                ))}
              </div>
            </div>

            {/* Database Stats */}
            {status.database.stats && (
              <div>
                <h3 className="mb-2 text-[15px] font-bold">Stored data</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card-solid rounded-2xl p-3">
                    <div className="text-xl font-extrabold tabular-nums">{status.database.stats.totalTransactions}</div>
                    <div className="text-xs text-muted-foreground">Transactions</div>
                  </div>
                  <div className="card-solid rounded-2xl p-3">
                    <div className="text-xl font-extrabold tabular-nums">{status.database.stats.intradayRecords}</div>
                    <div className="text-xs text-muted-foreground">Intraday prices</div>
                  </div>
                  <div className="card-solid rounded-2xl p-3">
                    <div className="text-xl font-extrabold tabular-nums">{status.database.stats.historicalRecords}</div>
                    <div className="text-xs text-muted-foreground">Daily prices</div>
                  </div>
                  <div className="card-solid rounded-2xl p-3">
                    <div className="text-xl font-extrabold tabular-nums">{status.database.stats.activeRecurring}</div>
                    <div className="text-xs text-muted-foreground">Active DCA plans</div>
                  </div>
                </div>
              </div>
            )}

            {/* Exchange Rates */}
            {status.exchangeRates.ratesCount > 0 && (
              <div className="card-solid rounded-2xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Exchange rates</span>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {status.exchangeRates.ratesCount} rates stored
                    {status.exchangeRates.lastUpdate && (
                      <>, updated {formatDateTime(status.exchangeRates.lastUpdate)}</>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <div>
                BTC Tracker {packageJson.version} on Node {status.nodeVersion}, {status.environment}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={fetchStatus}
                disabled={loading}
              >
                {loading ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4" />
                )}
                <span className="ml-1.5">Refresh</span>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default SystemStatusDialog;

