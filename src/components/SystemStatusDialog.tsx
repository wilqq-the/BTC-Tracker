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
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
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
    running: { color: 'bg-emerald-500', pulse: true, icon: CheckCircleIcon, label: 'Running' },
    connected: { color: 'bg-emerald-500', pulse: false, icon: CheckCircleIcon, label: 'Connected' },
    stopped: { color: 'bg-amber-500', pulse: false, icon: AlertCircleIcon, label: 'Stopped' },
    error: { color: 'bg-red-500', pulse: true, icon: XCircleIcon, label: 'Error' },
    disconnected: { color: 'bg-red-500', pulse: false, icon: XCircleIcon, label: 'Disconnected' },
    unknown: { color: 'bg-gray-400', pulse: false, icon: AlertCircleIcon, label: 'Unknown' },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const Icon = config.icon;

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
    <div className="flex items-start justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-start gap-3">
        <div className={cn(
          'p-2 rounded-md',
          subsystem.status === 'running' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
          subsystem.status === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
          'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        )}>
          <Icon className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-medium">{subsystem.name}</h4>
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
            <p className="text-xs text-muted-foreground mt-0.5">
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
          <DialogTitle className="flex items-center gap-2">
            <ServerIcon className="size-5" />
            System Status
          </DialogTitle>
          <DialogDescription>
            Monitor all background services and subsystems
          </DialogDescription>
        </DialogHeader>

        {loading && !status ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error && !status ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <XCircleIcon className="size-12 text-destructive mb-3" />
            <p className="text-sm text-destructive">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={fetchStatus}
            >
              <RefreshCwIcon className="size-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : status ? (
          <div className="space-y-6">
            {/* App Status Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                <div className={cn(
                  'text-xs font-medium uppercase tracking-wide mb-1',
                  status.app.isInitialized ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {status.app.isInitialized ? 'Initialized' : 'Starting...'}
                </div>
                <div className="text-lg font-semibold">App</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Uptime
                </div>
                <div className="text-lg font-semibold">{formatUptime(status.uptime)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                <div className={cn(
                  'text-xs font-medium uppercase tracking-wide mb-1',
                  status.database.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {status.database.status}
                </div>
                <div className="text-lg font-semibold">Database</div>
              </div>
            </div>

            {/* Current Price */}
            {status.priceData.currentPrice && (
              <div className="p-4 rounded-lg bg-gradient-to-r from-btc-500/10 to-btc-600/5 border border-btc-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Current BTC Price
                    </div>
                    <div className="text-2xl font-bold text-btc-500">
                      {formatPrice(status.priceData.currentPrice.price)}
                    </div>
                    {status.priceData.currentPrice.change24h !== undefined && (
                      <div className={cn(
                        'text-sm font-medium',
                        status.priceData.currentPrice.change24h >= 0 ? 'text-profit' : 'text-loss'
                      )}>
                        {status.priceData.currentPrice.change24h >= 0 ? '+' : ''}
                        {status.priceData.currentPrice.change24h.toFixed(2)}% (24h)
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>Source: {status.priceData.currentPrice.source}</div>
                    <div>Updated: {formatDateTime(status.priceData.currentPrice.lastUpdate)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Subsystems */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ActivityIcon className="size-4" />
                Background Services
              </h3>
              <div className="space-y-2">
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
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <DatabaseIcon className="size-4" />
                  Data Statistics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                    <div className="text-2xl font-bold">{status.database.stats.totalTransactions}</div>
                    <div className="text-xs text-muted-foreground">Transactions</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                    <div className="text-2xl font-bold">{status.database.stats.intradayRecords}</div>
                    <div className="text-xs text-muted-foreground">Intraday Records</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                    <div className="text-2xl font-bold">{status.database.stats.historicalRecords}</div>
                    <div className="text-xs text-muted-foreground">Historical Records</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                    <div className="text-2xl font-bold">{status.database.stats.activeRecurring}</div>
                    <div className="text-xs text-muted-foreground">Active DCA</div>
                  </div>
                </div>
              </div>
            )}

            {/* Exchange Rates */}
            {status.exchangeRates.ratesCount > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSignIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Exchange Rates</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {status.exchangeRates.ratesCount} rates stored
                    {status.exchangeRates.lastUpdate && (
                      <> · Updated {formatDateTime(status.exchangeRates.lastUpdate)}</>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
              <div>
                BTC Tracker v{packageJson.version} · Node {status.nodeVersion} · {status.environment}
              </div>
              <Button
                variant="ghost"
                size="sm"
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

