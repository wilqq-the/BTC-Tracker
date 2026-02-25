'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  CheckCircleIcon,
  XCircleIcon,
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

export default function ExchangeConnectionsPanel() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [supportedExchanges, setSupportedExchanges] = useState<SupportedExchange[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
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

  const handleAddConnection = async () => {
    if (!addForm.exchangeName || !addForm.apiKey || !addForm.apiSecret) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
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
    try {
      const response = await fetch(`/api/exchanges/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        toast({ title: 'Exchange connection removed' });
        setShowDeleteDialog(null);
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
        toast({ title: isActive ? 'Connection disabled' : 'Connection enabled' });
        loadConnections();
      }
    } catch (error) {
      toast({ title: 'Error updating connection', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const getSyncStatusBadge = (connection: ExchangeConnection) => {
    if (!connection.lastSyncStatus) {
      return <Badge variant="outline">Not synced</Badge>;
    }

    switch (connection.lastSyncStatus) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-600">
            <CheckCircleIcon className="size-3 mr-1" />
            Success
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-600">
            <AlertTriangleIcon className="size-3 mr-1" />
            Partial
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircleIcon className="size-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="outline">{connection.lastSyncStatus}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Exchange Connections</h3>
          <p className="text-sm text-muted-foreground">
            Connect your exchange accounts to automatically sync Bitcoin trades
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <PlusIcon className="size-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Connections List */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LinkIcon className="size-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No exchange connections yet</p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline">
              <PlusIcon className="size-4 mr-2" />
              Connect your first exchange
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((connection) => (
            <Card key={connection.id} className={cn(!connection.isActive && 'opacity-60')}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {EXCHANGE_LOGOS[connection.exchangeName]?.logo ? (
                        <Image
                          src={EXCHANGE_LOGOS[connection.exchangeName].logo}
                          alt={connection.exchangeName}
                          width={28}
                          height={28}
                          className="object-contain"
                          onError={(e) => {
                            // Fallback to letter if logo fails to load
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `<span class="font-bold text-sm">${EXCHANGE_LOGOS[connection.exchangeName]?.fallback || '?'}</span>`;
                          }}
                        />
                      ) : (
                        <span className="font-bold text-sm">
                          {EXCHANGE_LOGOS[connection.exchangeName]?.fallback || '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {connection.label || connection.exchangeName}
                      </CardTitle>
                      <CardDescription>
                        {connection.label ? connection.exchangeName : null}
                        {connection.wallet && (
                          <span className={connection.label ? 'ml-2' : ''}>
                            {connection.wallet.emoji || ''} {connection.wallet.name}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSyncStatusBadge(connection)}
                    {!connection.isActive && (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Sync info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground">Last Sync</p>
                    <p className="font-medium">{formatDate(connection.lastSyncAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Import</p>
                    <p className="font-medium">
                      {connection.lastSyncCount > 0
                        ? `${connection.lastSyncCount} transactions`
                        : connection.lastSyncAt ? '0 new' : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Connected</p>
                    <p className="font-medium">{formatDate(connection.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Wallet</p>
                    <p className="font-medium">
                      {connection.wallet
                        ? `${connection.wallet.emoji || ''} ${connection.wallet.name}`
                        : 'None'}
                    </p>
                  </div>
                </div>

                {/* Error message */}
                {connection.lastSyncError && connection.lastSyncStatus === 'error' && (
                  <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertTriangleIcon className="size-4 inline mr-2" />
                    {connection.lastSyncError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => handleSync(connection.id)}
                    disabled={syncingId === connection.id || !connection.isActive}
                  >
                    {syncingId === connection.id ? (
                      <Loader2Icon className="size-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-4 mr-2" />
                    )}
                    {syncingId === connection.id ? 'Syncing...' : 'Sync Now'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync(connection.id, true)}
                    disabled={syncingId === connection.id || !connection.isActive}
                    title="Re-fetch all trades from the exchange, ignoring last sync date"
                  >
                    {syncingId === connection.id ? (
                      <Loader2Icon className="size-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-4 mr-2" />
                    )}
                    Full Re-sync
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection(connection.id)}
                    disabled={testingId === connection.id}
                  >
                    {testingId === connection.id ? (
                      <Loader2Icon className="size-4 mr-2 animate-spin" />
                    ) : (
                      <WifiIcon className="size-4 mr-2" />
                    )}
                    Test
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(connection.id, connection.isActive)}
                  >
                    {connection.isActive ? (
                      <>
                        <UnlinkIcon className="size-4 mr-2" />
                        Disable
                      </>
                    ) : (
                      <>
                        <LinkIcon className="size-4 mr-2" />
                        Enable
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(connection.id)}
                  >
                    <TrashIcon className="size-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Connection Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Exchange Connection</DialogTitle>
            <DialogDescription>
              Connect an exchange to automatically sync your Bitcoin trades.
              Your API credentials are encrypted before storage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Exchange Selection */}
            <div className="space-y-2">
              <Label htmlFor="exchange-select">Exchange</Label>
              <Select
                value={addForm.exchangeName}
                onValueChange={(value) => setAddForm({ ...addForm, exchangeName: value })}
              >
                <SelectTrigger id="exchange-select">
                  <SelectValue placeholder="Select exchange" />
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
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={addForm.apiKey}
                onChange={(e) => setAddForm({ ...addForm, apiKey: e.target.value })}
                autoComplete="off"
              />
            </div>

            {/* API Secret */}
            <div className="space-y-2">
              <Label htmlFor="api-secret">API Secret</Label>
              <Input
                id="api-secret"
                type="password"
                placeholder="Enter your API secret"
                value={addForm.apiSecret}
                onChange={(e) => setAddForm({ ...addForm, apiSecret: e.target.value })}
                autoComplete="off"
              />
            </div>

            {/* Label (optional) */}
            <div className="space-y-2">
              <Label htmlFor="connection-label">Label (optional)</Label>
              <Input
                id="connection-label"
                type="text"
                placeholder="e.g. My Kraken Account"
                value={addForm.label}
                onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
              />
            </div>

            {/* Wallet Assignment (optional) */}
            <div className="space-y-2">
              <Label htmlFor="wallet-select">Assign to Wallet (optional)</Label>
              <Select
                value={addForm.walletId}
                onValueChange={(value) => setAddForm({ ...addForm, walletId: value })}
              >
                <SelectTrigger id="wallet-select">
                  <SelectValue placeholder="No wallet assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No wallet</SelectItem>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id.toString()}>
                      {wallet.emoji || ''} {wallet.name} ({wallet.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Synced transactions will be assigned to this wallet
              </p>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-sm">
              <ShieldCheckIcon className="size-4 mt-0.5 text-green-600 shrink-0" />
              <p className="text-muted-foreground">
                Your API credentials are encrypted with AES-256-GCM before storage.
                Use <strong>read-only</strong> API keys for maximum security.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConnection} disabled={addLoading}>
              {addLoading ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <PlusIcon className="size-4 mr-2" />
                  Add Connection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog !== null} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Exchange Connection</DialogTitle>
            <DialogDescription>
              This will remove the exchange connection and its stored credentials.
              Previously synced transactions will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteDialog && handleDeleteConnection(showDeleteDialog)}
            >
              <TrashIcon className="size-4 mr-2" />
              Remove Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
