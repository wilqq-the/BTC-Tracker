'use client';

/**
 * On-chain settings and watch list.
 *
 * Two things live here because they are one workflow: turn the feature on, point
 * it at a backend, then add the addresses or xpubs to follow. The panel never
 * receives an xpub from the server — the API only reports `hasXpub` — so there is
 * nothing to accidentally log or render.
 *
 * What the server sends and what this displays differ on purpose: balances
 * arrive as exact satoshi strings, and the BTC figure next to them is a
 * convenience view of the same number.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  Link2Icon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react';

const NO_WALLET = 'none';

// How often the panel re-reads what the background scheduler has synced. The
// call is local and cheap; it never reaches the Esplora endpoint.
const REFRESH_INTERVAL_MS = 30 * 1000;

interface WatchedAddress {
  id: number;
  walletId: number | null;
  wallet?: { id: number; name: string; type: string; emoji: string | null } | null;
  label: string;
  address: string;
  chain: string;
  scriptType: string;
  hasXpub: boolean;
  xpubDerivationPath: string | null;
  balanceBtc: number;
  balanceSats: string;
  utxoCount: number;
  txCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  isActive: boolean;
}

interface WalletOption {
  id: number;
  name: string;
  type: string;
  emoji: string | null;
}

interface OnchainConfig {
  enabled: boolean;
  esploraEndpoint: string;
  syncIntervalMinutes: number;
  gapLimit: number;
  requestTimeoutMs: number;
  recalculatePortfolio: boolean;
}

interface Status {
  enabled: boolean;
  endpoint: string | null;
  watchedAddresses: number;
  importedTransactions: number;
  pendingTransactions: number;
  replacedTransactions: number;
  scheduler: { isRunning: boolean; intervalMinutes: number };
  connection?: { reachable: boolean; tipHeight: number | null; error?: string };
}

function formatBtc(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  });
}

function formatDate(value: string | null): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'never';
  return date.toLocaleString();
}

function truncate(value: string, head = 12, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

interface OnchainPanelProps {
  /**
   * The on-chain settings are server-wide: the endpoint receives every user's
   * addresses, so only an admin may change them (the API enforces it too).
   * Everyone can still watch and sync their own addresses.
   */
  isAdmin: boolean;
}

export function OnchainPanel({ isAdmin }: OnchainPanelProps) {
  const [config, setConfig] = useState<OnchainConfig | null>(null);
  const [watched, setWatched] = useState<WatchedAddress[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<number | 'all' | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [form, setForm] = useState({ address: '', xpub: '', label: '', walletId: NO_WALLET, chain: 'mainnet' });
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [settingsRes, watchedRes, walletsRes, statusRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/onchain/addresses'),
        fetch('/api/wallets'),
        fetch('/api/onchain/status'),
      ]);

      if (settingsRes.ok) {
        const body = await settingsRes.json();
        if (body.success && body.data.onchain) setConfig(body.data.onchain);
      }
      if (watchedRes.ok) {
        const body = await watchedRes.json();
        if (body.success) setWatched(body.data || []);
      }
      if (walletsRes.ok) {
        const body = await walletsRes.json();
        if (body.success) setWallets(body.data || []);
      }
      if (statusRes.ok) {
        const body = await statusRes.json();
        if (body.success) setStatus(body.data);
      }
    } catch (error) {
      console.error('Error loading on-chain data:', error);
      toast({ title: 'Failed to load on-chain settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // The scheduler syncs server-side, so without this the panel would keep showing
  // the snapshot from when it was opened. Only addresses and status are re-read:
  // reloading settings would overwrite a config field the user is editing.
  const refreshSyncedData = useCallback(async () => {
    try {
      const [watchedRes, statusRes] = await Promise.all([
        fetch('/api/onchain/addresses'),
        fetch('/api/onchain/status'),
      ]);
      if (watchedRes.ok) {
        const body = await watchedRes.json();
        if (body.success) setWatched(body.data || []);
      }
      if (statusRes.ok) {
        const body = await statusRes.json();
        // Keep the last connection probe, the plain status call does not return one.
        if (body.success) setStatus((prev) => ({ ...body.data, connection: prev?.connection }));
      }
    } catch (error) {
      // Background refresh: stay silent, the next tick will retry.
      console.error('Error refreshing on-chain data:', error);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshSyncedData();
      }
    }, REFRESH_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshSyncedData();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshSyncedData]);

  const saveConfig = async (patch: Partial<OnchainConfig>) => {
    if (!config) return;
    const previous = config;
    // Applied locally straight away: the toggle and the fields are controlled,
    // and waiting for the round trip would make the switch feel stuck.
    const optimistic = { ...config, ...patch };
    setConfig(optimistic);
    setSaving(true);

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onchain: patch }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        setConfig(previous);
        toast({ title: body.error || 'Failed to save on-chain settings', variant: 'destructive' });
        return;
      }

      if (body.data?.onchain) setConfig(body.data.onchain);
      toast({ title: 'On-chain settings saved' });
    } catch (error) {
      setConfig(previous);
      toast({ title: 'Failed to save on-chain settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/onchain/status?test=1');
      const body = await response.json();
      if (!response.ok || !body.success) {
        toast({ title: body.error || 'Test failed', variant: 'destructive' });
        return;
      }
      setStatus((prev) => (prev ? { ...prev, connection: body.connection } : prev));
      if (body.connection?.reachable) {
        toast({
          title: 'Endpoint reachable',
          description: `Block height ${body.connection.tipHeight ?? 'unknown'}`,
        });
      } else {
        toast({
          title: 'Endpoint not reachable',
          description: body.connection?.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({ title: 'Test failed', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const addWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const address = form.address.trim();
    const xpub = form.xpub.trim();
    if (!address && !xpub) {
      setFormError('Enter an address, an xpub, or both.');
      return;
    }
    if (address && xpub) {
      setFormError('Enter either an address or an xpub, not both.');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch('/api/onchain/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address || undefined,
          xpub: xpub || undefined,
          label: form.label.trim() || undefined,
          chain: form.chain,
          walletId: form.walletId === NO_WALLET ? null : Number(form.walletId),
        }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        setFormError(body.error || 'Could not add this address');
        return;
      }

      setForm({ address: '', xpub: '', label: '', walletId: NO_WALLET, chain: form.chain });
      // The POST already runs the first sync server-side and reports what came
      // out of it, so the panel must reflect that instead of announcing a
      // sync that would just run again.
      toast({ title: 'Address added', description: body.message || 'Add successful.' });
      await loadAll();
    } catch (error) {
      setFormError('Could not add this address');
    } finally {
      setAdding(false);
    }
  };

  const syncOne = async (id: number) => {
    setSyncing(id);
    try {
      const response = await fetch(`/api/onchain/addresses/${id}/sync`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok || !body.success) {
        toast({ title: body.error || 'Sync failed', variant: 'destructive' });
      } else {
        const imported = body.data?.txsImported ?? 0;
        toast({
          title: imported > 0 ? `Imported ${imported} transaction(s)` : 'Already up to date',
        });
      }
      await loadAll();
    } catch (error) {
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  };

  const syncAll = async () => {
    setSyncing('all');
    try {
      const response = await fetch('/api/onchain/sync', { method: 'POST' });
      const body = await response.json();
      if (!response.ok || !body.success) {
        toast({ title: body.error || 'Sync failed', variant: 'destructive' });
      } else {
        toast({
          title: `Synced ${body.data.addresses} address(es)`,
          description: `${body.data.txsImported} new transaction(s)${
            body.data.failed > 0 ? `, ${body.data.failed} failed` : ''
          }`,
        });
      }
      await loadAll();
    } catch (error) {
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  };

  const removeWatch = async (id: number) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/onchain/addresses/${id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success) {
        toast({ title: body.error || 'Could not stop watching', variant: 'destructive' });
        return;
      }
      // The transactions stay in the portfolio, which is the whole point of the
      // message: history is not a side effect of the watch.
      toast({ title: 'Stopped watching', description: body.message });
      await loadAll();
    } catch (error) {
      toast({ title: 'Could not stop watching', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2Icon className="size-5" />
                On-chain tracking
              </CardTitle>
              <CardDescription>
                Read-only. Your extended public keys are stored encrypted and are never sent back
                to the browser.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config.enabled ? 'default' : 'secondary'}>
                {config.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => saveConfig({ enabled: checked })}
                disabled={saving || !isAdmin}
                aria-label="Enable on-chain tracking"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-tint-orange p-3">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-primary-strong" />
            <p className="text-sm text-muted-foreground">
              Every address you add is sent to whichever Esplora endpoint is configured here. The
              default is a public third-party service, so your addresses and balances become
              visible to it. Run your own Electrs for a fully self-hosted setup.
            </p>
          </div>

          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              These settings apply to the whole server, so only an admin can change them. You can
              still watch and sync your own addresses below.
            </p>
          )}

          <fieldset disabled={!isAdmin} className="space-y-4 disabled:opacity-60">
          <div className="space-y-2">
            <Label htmlFor="esplora-endpoint">Esplora endpoint</Label>
            <div className="flex gap-2">
              <Input
                id="esplora-endpoint"
                value={config.esploraEndpoint}
                onChange={(e) => setConfig({ ...config, esploraEndpoint: e.target.value })}
                onBlur={() => {
                  if (config.esploraEndpoint !== status?.endpoint) {
                    saveConfig({ esploraEndpoint: config.esploraEndpoint });
                  }
                }}
                placeholder="https://mempool.space/api"
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={testing}
              >
                {testing ? <Loader2Icon className="size-4 animate-spin" /> : <EyeIcon className="size-4" />}
                Test
              </Button>
            </div>
            {status?.connection && (
              <p
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  status.connection.reachable ? 'text-tint-green-fg' : 'text-tint-red-fg'
                )}
              >
                {status.connection.reachable ? (
                  <>
                    <CheckCircleIcon className="size-3.5" />
                    Reachable, block height {status.connection.tipHeight ?? 'unknown'}
                  </>
                ) : (
                  <>
                    <XCircleIcon className="size-3.5" />
                    {status.connection.error || 'Not reachable'}
                  </>
                )}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sync-interval">Sync every (minutes)</Label>
              <Input
                id="sync-interval"
                type="number"
                min={1}
                max={1440}
                value={config.syncIntervalMinutes}
                onChange={(e) =>
                  setConfig({ ...config, syncIntervalMinutes: Number(e.target.value) })
                }
                onBlur={() => saveConfig({ syncIntervalMinutes: config.syncIntervalMinutes })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gap-limit">Gap limit</Label>
              <Input
                id="gap-limit"
                type="number"
                min={1}
                max={200}
                value={config.gapLimit}
                onChange={(e) => setConfig({ ...config, gapLimit: Number(e.target.value) })}
                onBlur={() => saveConfig({ gapLimit: config.gapLimit })}
              />
              <p className="text-xs text-muted-foreground">
                Addresses derived per chain from an xpub.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-timeout">Request timeout (ms)</Label>
              <Input
                id="request-timeout"
                type="number"
                min={1000}
                max={120000}
                step={1000}
                value={config.requestTimeoutMs}
                onChange={(e) =>
                  setConfig({ ...config, requestTimeoutMs: Number(e.target.value) })
                }
                onBlur={() => saveConfig({ requestTimeoutMs: config.requestTimeoutMs })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="recalculate">Recompute the portfolio after a sync</Label>
              <p className="text-xs text-muted-foreground">
                Needed for the dashboard to reflect newly imported transactions.
              </p>
            </div>
            <Switch
              id="recalculate"
              checked={config.recalculatePortfolio}
              onCheckedChange={(checked) => saveConfig({ recalculatePortfolio: checked })}
              disabled={saving}
            />
          </div>
          </fieldset>

          {status && (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat label="Watched" value={status.watchedAddresses} />
              <Stat label="Imported" value={status.importedTransactions} />
              <Stat label="Pending" value={status.pendingTransactions} />
              <Stat
                label="Scheduler"
                value={status.scheduler.isRunning ? `every ${status.scheduler.intervalMinutes}m` : 'stopped'}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Watched addresses</CardTitle>
              <CardDescription>
                An xpub finds the whole wallet, including the change addresses that only appear
                once you spend.
              </CardDescription>
            </div>
            <Button
              onClick={syncAll}
              disabled={syncing !== null || watched.length === 0}
              variant="outline"
            >
              {syncing === 'all' ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              Sync all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addWatch} className="space-y-3 rounded-md border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="watch-address">Address</Label>
                <Input
                  id="watch-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="bc1q… or 1… or 3…"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="watch-xpub">Extended public key</Label>
                <Input
                  id="watch-xpub"
                  value={form.xpub}
                  onChange={(e) => setForm({ ...form, xpub: e.target.value })}
                  placeholder="xpub… / ypub… / zpub…"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="watch-label">Label</Label>
                <Input
                  id="watch-label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Cold storage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="watch-chain">Network</Label>
                <Select
                  value={form.chain}
                  onValueChange={(value) => setForm({ ...form, chain: value })}
                >
                  <SelectTrigger id="watch-chain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mainnet">Mainnet</SelectItem>
                    <SelectItem value="testnet">Testnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="watch-wallet">Add to wallet</Label>
                <Select
                  value={form.walletId}
                  onValueChange={(value) => setForm({ ...form, walletId: value })}
                >
                  <SelectTrigger id="watch-wallet">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_WALLET}>Not linked</SelectItem>
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={String(wallet.id)}>
                        {wallet.emoji ? `${wallet.emoji} ` : ''}
                        {wallet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formError && <p className="text-sm text-tint-red-fg">{formError}</p>}
            <Button type="submit" disabled={adding}>
              {adding ? <Loader2Icon className="size-4 animate-spin" /> : <WalletIcon className="size-4" />}
              Add
            </Button>
          </form>

          {watched.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing watched yet. Add an address above, then sync.
            </p>
          ) : (
            <ul className="space-y-3">
              {watched.map((entry) => (
                <li key={entry.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {entry.label || truncate(entry.address, 16, 10)}
                        </span>
                        {entry.hasXpub && <Badge variant="outline">xpub</Badge>}
                        {entry.chain !== 'mainnet' && (
                          <Badge variant="outline">{entry.chain}</Badge>
                        )}
                        {entry.wallet && (
                          <Badge variant="secondary">
                            {entry.wallet.emoji ? `${entry.wallet.emoji} ` : ''}
                            {entry.wallet.name}
                          </Badge>
                        )}
                        {!entry.isActive && <Badge variant="secondary">paused</Badge>}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground break-all">
                        {truncate(entry.address, 20, 12)}
                      </p>
                      {entry.hasXpub && entry.xpubDerivationPath && (
                        <p className="text-xs text-muted-foreground">
                          derives receive and change from {entry.xpubDerivationPath}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatBtc(entry.balanceBtc)} BTC · {entry.utxoCount} UTXO · synced{' '}
                        {formatDate(entry.lastSyncAt)}
                      </p>
                      {entry.lastSyncError && (
                        <p className="text-xs text-tint-red-fg">Last error: {entry.lastSyncError}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncOne(entry.id)}
                        disabled={syncing !== null}
                      >
                        {syncing === entry.id ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <RefreshCwIcon className="size-4" />
                        )}
                        Sync
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeWatch(entry.id)}
                        disabled={busyId === entry.id}
                        aria-label="Stop watching"
                      >
                        {busyId === entry.id ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <Trash2Icon className="size-4 text-tint-red-fg" />
                        )}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export default OnchainPanel;
