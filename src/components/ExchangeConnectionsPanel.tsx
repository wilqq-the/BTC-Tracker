'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm-dialog';
import { WalletTypeIcon } from '@/components/ui/wallet-type-icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Icons
import {
  PlusIcon,
  TrashIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  LinkIcon,
  UnlinkIcon,
  ShieldCheckIcon,
  Loader2Icon,
  WifiIcon,
} from 'lucide-react';
import Image from 'next/image';

/** Exchange logo paths and fallback letters */
const EXCHANGE_LOGOS: Record<string, { logo: string; fallback: string }> = {
  BINANCE:  { logo: '/exchanges/binance.svg',  fallback: 'Bi' },
  COINBASE: { logo: '/exchanges/coinbase.svg', fallback: 'Cb' },
  KRAKEN:   { logo: '/exchanges/kraken.svg',   fallback: 'Kr' },
  BYBIT:    { logo: '/exchanges/bybit.svg',    fallback: 'By' },
  GEMINI:   { logo: '/exchanges/gemini.svg',   fallback: 'Ge' },
};

// Types
interface ExchangeConnection {
  id: number;
  exchangeName: string;
  label: string;
  walletId: number | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  lastSyncCount: number;
  createdAt: string;
  updatedAt: string;
  wallet: { id: number; name: string; type: string; emoji: string | null } | null;
}

interface SupportedExchange {
  name: string;
  displayName: string;
  description: string;
}

interface Wallet {
  id: number;
  name: string;
  type: string;
  emoji: string | null;
}

interface ExchangeConnectionsPanelProps {
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}

export default function ExchangeConnectionsPanel({ onHeaderAction }: ExchangeConnectionsPanelProps) {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [supportedExchanges, setSupportedExchanges] = useState<SupportedExchange[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Add form state
  const [addForm, setAddForm] = useState({
    exchangeName: '',
    apiKey: '',
    apiSecret: '',
    label: '',
    walletId: '' as string,
  });
  const [addLoading, setAddLoading] = useState(false);

  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/exchanges');
      const result = await response.json();
      if (result.success) {
        setConnections(result.data);
        setSupportedExchanges(result.supportedExchanges || []);
      }
    } catch (error) {
      console.error('Error loading exchange connections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWallets = useCallback(async () => {
    try {
      const response = await fetch('/api/wallets');
      const result = await response.json();
      if (result.success) {
        setWallets(result.data || []);
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    loadWallets();
  }, [loadConnections, loadWallets]);

  // Surface the primary action in the settings page header
  useEffect(() => {
    onHeaderAction?.({ label: 'Add connection', onClick: () => setShowAddDialog(true) });
    return () => onHeaderAction?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddConnection = async () => {
    if (!addForm.exchangeName || !addForm.apiKey || !addForm.apiSecret) {
      toast({ title: 'Choose an exchange and enter the API key and secret', variant: 'destructive' });
      return;
    }

    setAddLoading(true);
    try {
      const response = await fetch('/api/exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchangeName: addForm.exchangeName,
          apiKey: addForm.apiKey,
          apiSecret: addForm.apiSecret,
          label: addForm.label || undefined,
          walletId: addForm.walletId && addForm.walletId !== 'none' ? parseInt(addForm.walletId) : null,
          testFirst: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Exchange connection added' });
        setShowAddDialog(false);
        setAddForm({ exchangeName: '', apiKey: '', apiSecret: '', label: '', walletId: '' });
        loadConnections();
      } else {
        toast({ title: result.error || 'Failed to add connection', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error adding connection', variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteConnection = async (id: number) => {
    const ok = await confirm({
      title: 'Remove this connection?',
      description: 'Its stored API credentials are deleted. Transactions it already imported stay.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/exchanges/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        toast({ title: 'Exchange connection removed' });
        loadConnections();
      } else {
        toast({ title: result.error || 'Failed to delete connection', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error deleting connection', variant: 'destructive' });
    }
  };

  const handleSync = async (id: number, fullSync = false) => {
    setSyncingId(id);
    try {
      const url = fullSync ? `/api/exchanges/${id}/sync?fullSync=true` : `/api/exchanges/${id}/sync`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync }),
      });
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sync completed',
          description: result.message,
        });
        loadConnections();
      } else {
        toast({
          title: 'Sync failed',
          description: result.error || result.message,
          variant: 'destructive',
        });
        loadConnections();
      }
    } catch (error) {
      toast({ title: 'Error syncing exchange', variant: 'destructive' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    try {
      const response = await fetch(`/api/exchanges/${id}/test`, { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        toast({ title: 'Connection test passed' });
      } else {
        toast({
          title: 'Connection test failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Error testing connection', variant: 'destructive' });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/exchanges/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const result = await response.json();

      if (result.success) {
        toast({ title: isActive ? 'Connection paused' : 'Connection resumed' });
        loadConnections();
      }
    } catch (error) {
      toast({ title: 'Error updating connection', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const chip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold';

  const getSyncStatusBadge = (connection: ExchangeConnection) => {
    if (!connection.lastSyncStatus) {
      return <span className={cn(chip, 'bg-secondary text-muted-foreground')}>Not synced yet</span>;
    }

    switch (connection.lastSyncStatus) {
      case 'success':
        return <span className={cn(chip, 'bg-tint-green text-tint-green-fg')}>Synced</span>;
      case 'partial':
        return (
          <span className={cn(chip, 'bg-tint-orange text-primary-strong')}>
            <AlertTriangleIcon className="size-3" />
            Partly synced
          </span>
        );
      case 'error':
        return (
          <span className={cn(chip, 'bg-tint-red text-tint-red-fg')}>
            <AlertTriangleIcon className="size-3" />
            Sync failed
          </span>
        );
      default:
        return <span className={cn(chip, 'bg-secondary text-muted-foreground')}>{connection.lastSyncStatus}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label="Loading connections" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connections List */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <LinkIcon className="size-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">No exchanges connected</p>
              <p className="text-sm text-muted-foreground">Connect one with a read-only API key and your trades are imported automatically.</p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="rounded-full font-semibold">
              <PlusIcon className="size-4" />
              Connect an exchange
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((connection) => {
            const lastImport = connection.lastSyncCount > 0
              ? `${connection.lastSyncCount} transaction${connection.lastSyncCount === 1 ? '' : 's'}`
              : connection.lastSyncAt ? 'Nothing new' : 'Nothing yet';
            return (
            <Card key={connection.id} className="gap-5">
              <CardContent className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className={cn('flex min-w-0 items-center gap-3', !connection.isActive && 'opacity-60')}>
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                      {EXCHANGE_LOGOS[connection.exchangeName]?.logo ? (
                        <Image
                          src={EXCHANGE_LOGOS[connection.exchangeName].logo}
                          alt={connection.exchangeName}
                          width={24}
                          height={24}
                          className="object-contain"
                          onError={(e) => {
                            // Fallback to letter if logo fails to load
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `<span class="font-bold text-sm">${EXCHANGE_LOGOS[connection.exchangeName]?.fallback || '?'}</span>`;
                          }}
                        />
                      ) : (
                        <span className="text-sm font-bold">
                          {EXCHANGE_LOGOS[connection.exchangeName]?.fallback || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[17px] font-bold tracking-tight">
                        {connection.label || connection.exchangeName}
                      </div>
                      {connection.label && (
                        <div className="text-[13px] text-muted-foreground">{connection.exchangeName}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!connection.isActive && (
                      <span className={cn(chip, 'bg-secondary text-muted-foreground')}>Paused</span>
                    )}
                    {getSyncStatusBadge(connection)}
                  </div>
                </div>

                {/* Sync info */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-secondary p-4 md:grid-cols-4">
                  <div>
                    <dt className="text-[13px] font-semibold text-muted-foreground">Last sync</dt>
                    <dd className={cn('mt-0.5 text-sm font-semibold', !connection.lastSyncAt && 'text-muted-foreground')}>{formatDate(connection.lastSyncAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] font-semibold text-muted-foreground">Last import</dt>
                    <dd className={cn('mt-0.5 text-sm font-semibold tabular-nums', connection.lastSyncCount === 0 && 'text-muted-foreground')}>{lastImport}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] font-semibold text-muted-foreground">Connected</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{formatDate(connection.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] font-semibold text-muted-foreground">Imports into</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
                      {connection.wallet ? (
                        <>
                          <WalletTypeIcon type={connection.wallet.type} className="size-3.5" />
                          <span className="truncate">{connection.wallet.name}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No wallet</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {/* Error message */}
                {connection.lastSyncError && connection.lastSyncStatus === 'error' && (
                  <div className="flex items-start gap-2 rounded-2xl bg-tint-red p-3 text-sm text-tint-red-fg">
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                    <span>{connection.lastSyncError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="rounded-full font-semibold"
                    onClick={() => handleSync(connection.id)}
                    disabled={syncingId === connection.id || !connection.isActive}
                  >
                    {syncingId === connection.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-4" />
                    )}
                    {syncingId === connection.id ? 'Syncing...' : 'Sync now'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full font-semibold"
                    onClick={() => handleSync(connection.id, true)}
                    disabled={syncingId === connection.id || !connection.isActive}
                    title="Fetch every trade again, ignoring the last sync date"
                  >
                    Full re-sync
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full font-semibold"
                    onClick={() => handleTestConnection(connection.id)}
                    disabled={testingId === connection.id}
                  >
                    {testingId === connection.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <WifiIcon className="size-4" />
                    )}
                    Test connection
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full font-semibold"
                    onClick={() => handleToggleActive(connection.id, connection.isActive)}
                  >
                    {connection.isActive ? (
                      <>
                        <UnlinkIcon className="size-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <LinkIcon className="size-4" />
                        Resume
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full font-semibold text-tint-red-fg hover:bg-tint-red hover:text-tint-red-fg sm:ml-auto"
                    onClick={() => handleDeleteConnection(connection.id)}
                  >
                    <TrashIcon className="size-4" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Add Connection Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect an exchange</DialogTitle>
            <DialogDescription>
              Your trades are imported automatically. The key and secret are encrypted before they&apos;re stored.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Exchange Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="exchange-select">Exchange</Label>
              <Select
                value={addForm.exchangeName}
                onValueChange={(value) => setAddForm({ ...addForm, exchangeName: value })}
              >
                <SelectTrigger id="exchange-select" className="w-full">
                  <SelectValue placeholder="Choose an exchange" />
                </SelectTrigger>
                <SelectContent>
                  {supportedExchanges.map((exchange) => (
                    <SelectItem key={exchange.name} value={exchange.name}>
                      {exchange.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="api-key">API key</Label>
              <Input
                id="api-key"
                type="password"
                value={addForm.apiKey}
                onChange={(e) => setAddForm({ ...addForm, apiKey: e.target.value })}
                autoComplete="off"
              />
            </div>

            {/* API Secret */}
            <div className="space-y-1.5">
              <Label htmlFor="api-secret">API secret</Label>
              <Input
                id="api-secret"
                type="password"
                value={addForm.apiSecret}
                onChange={(e) => setAddForm({ ...addForm, apiSecret: e.target.value })}
                autoComplete="off"
              />
            </div>

            {/* Label (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="connection-label">Label <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="connection-label"
                type="text"
                placeholder="My Kraken account"
                value={addForm.label}
                onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
              />
            </div>

            {/* Wallet Assignment (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="wallet-select">Import into wallet <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Select
                value={addForm.walletId}
                onValueChange={(value) => setAddForm({ ...addForm, walletId: value })}
              >
                <SelectTrigger id="wallet-select" className="w-full">
                  <SelectValue placeholder="No wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No wallet</SelectItem>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id.toString()}>
                      <WalletTypeIcon type={wallet.type} />
                      {wallet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Imported transactions are assigned to this wallet.
              </p>
            </div>

            {/* Security note */}
            <div className="card-solid flex items-start gap-2.5 rounded-2xl p-3 text-[13px]">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-tint-green-fg" />
              <p className="text-muted-foreground">
                Credentials are encrypted with AES-256-GCM. Use a <strong className="text-foreground">read-only</strong> API key: the tracker never needs to trade or withdraw.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full font-semibold" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className="rounded-full font-semibold" onClick={handleAddConnection} disabled={addLoading}>
              {addLoading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Checking the key...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
