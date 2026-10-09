'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { WalletIcon, PencilIcon, TrashIcon, AlertCircleIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { WalletTypeIcon } from '@/components/ui/wallet-type-icon';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/hooks/use-toast';

interface Wallet {
  id: number;
  name: string;
  type: 'cold' | 'hot';
  emoji: string | null;
  note: string | null;
  includeInPortfolio: boolean;
  isActive: boolean;
  createdAt: string;
  btcBalance: number;
}

interface WalletsPanelProps {
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}

export default function WalletsPanel({ onHeaderAction }: WalletsPanelProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  // The wallet emoji field still exists in the DB/API; the form no longer asks for it
  // (wallets are marked with WalletTypeIcon), and leaving it out of the payload keeps
  // any existing value untouched on edit.
  const [walletForm, setWalletForm] = useState({ name: '', type: 'hot' as 'cold' | 'hot', note: '', includeInPortfolio: true });
  const [walletError, setWalletError] = useState('');
  const [savingWallet, setSavingWallet] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  // Surface the primary action in the settings page header
  useEffect(() => {
    onHeaderAction?.({ label: 'Add wallet', onClick: openAddWallet });
    return () => onHeaderAction?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWallets = async () => {
    setWalletsLoading(true);
    try {
      const response = await fetch('/api/wallets');
      if (response.ok) {
        const result = await response.json();
        if (result.success) setWallets(result.data);
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    } finally {
      setWalletsLoading(false);
    }
  };

  const openAddWallet = () => {
    setEditingWallet(null);
    setWalletForm({ name: '', type: 'hot', note: '', includeInPortfolio: true });
    setWalletError('');
    setShowWalletModal(true);
  };

  const openEditWallet = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setWalletForm({
      name: wallet.name,
      type: wallet.type,
      note: wallet.note || '',
      includeInPortfolio: wallet.includeInPortfolio,
    });
    setWalletError('');
    setShowWalletModal(true);
  };

  const handleSaveWallet = async () => {
    if (!walletForm.name.trim()) {
      setWalletError('Give the wallet a name.');
      return;
    }
    setWalletError('');
    setSavingWallet(true);
    try {
      const url = editingWallet ? `/api/wallets/${editingWallet.id}` : '/api/wallets';
      const method = editingWallet ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(walletForm),
      });
      const result = await response.json();
      if (result.success) {
        setShowWalletModal(false);
        toast({ title: editingWallet ? 'Wallet updated' : 'Wallet added' });
        await loadWallets();
      } else {
        setWalletError(result.message || 'Failed to save wallet');
      }
    } catch (error) {
      setWalletError('Couldn’t save the wallet. Check your connection and try again.');
    } finally {
      setSavingWallet(false);
    }
  };

  const handleDeleteWallet = async (wallet: Wallet) => {
    if (!(await confirm({
      title: 'Delete wallet?',
      description: `Delete "${wallet.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    }))) return;
    try {
      const response = await fetch(`/api/wallets/${wallet.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Wallet deleted' });
        await loadWallets();
      } else {
        toast({ title: 'Failed to delete wallet', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting wallet:', error);
      toast({ title: 'Failed to delete wallet', variant: 'destructive' });
    }
  };

  const formatBtc = (n: number) => (n === 0 ? '0' : n.toFixed(8));

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-2">
        <CardContent className="px-2">
          {walletsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading wallets" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <WalletIcon className="size-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No wallets yet</p>
                <p className="text-sm text-muted-foreground">Add the wallets and exchanges you keep bitcoin in to see how it&apos;s split.</p>
              </div>
              <Button size="sm" className="rounded-full font-semibold" onClick={openAddWallet}>Add a wallet</Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {wallets.map(wallet => (
                <li key={wallet.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-full',
                      wallet.type === 'cold' ? 'bg-tint-blue' : 'bg-tint-orange'
                    )}>
                      <WalletTypeIcon type={wallet.type} className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-[15px] font-semibold">{wallet.name}</span>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          wallet.type === 'cold' ? 'bg-tint-blue text-tint-blue-fg' : 'bg-tint-orange text-primary-strong'
                        )}>
                          {wallet.type === 'cold' ? 'Cold storage' : 'Hot wallet'}
                        </span>
                        {!wallet.includeInPortfolio && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            Not in total
                          </span>
                        )}
                      </div>
                      {wallet.note && (
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{wallet.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn(
                      'text-[15px] font-bold tabular-nums',
                      wallet.btcBalance === 0 && 'text-muted-foreground'
                    )}>
                      {formatBtc(wallet.btcBalance)} <span className="text-[13px] font-semibold text-muted-foreground">BTC</span>
                    </span>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full text-muted-foreground hover:text-foreground"
                        aria-label={`Edit ${wallet.name}`}
                        onClick={() => openEditWallet(wallet)}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full text-muted-foreground hover:bg-tint-red hover:text-tint-red-fg"
                        aria-label={`Delete ${wallet.name}`}
                        onClick={() => handleDeleteWallet(wallet)}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Wallet Dialog */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWallet ? 'Edit wallet' : 'Add a wallet'}</DialogTitle>
            <DialogDescription>
              {editingWallet ? 'Change the name, type or note.' : 'A place you keep bitcoin: a hardware wallet, an exchange, a phone app.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="walletName">Name</Label>
              <Input
                id="walletName"
                placeholder="Ledger Nano, Kraken, Lightning"
                value={walletForm.name}
                onChange={e => setWalletForm({ ...walletForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walletType">Type</Label>
              <Select value={walletForm.type} onValueChange={v => setWalletForm({ ...walletForm, type: v as 'cold' | 'hot' })}>
                <SelectTrigger id="walletType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">
                    <WalletTypeIcon type="cold" />
                    Cold storage
                  </SelectItem>
                  <SelectItem value="hot">
                    <WalletTypeIcon type="hot" />
                    Hot wallet
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walletNote">Note</Label>
              <Input
                id="walletNote"
                placeholder="Optional"
                value={walletForm.note}
                onChange={e => setWalletForm({ ...walletForm, note: e.target.value })}
              />
            </div>
            <div className="card-solid flex items-center justify-between gap-4 rounded-2xl p-3">
              <div>
                <Label htmlFor="walletInclude" className="text-sm font-semibold">Count in portfolio total</Label>
                <p className="text-xs text-muted-foreground">Turn off to track this wallet without adding its bitcoin to your total.</p>
              </div>
              <Switch
                id="walletInclude"
                checked={walletForm.includeInPortfolio}
                onCheckedChange={(checked) => setWalletForm({ ...walletForm, includeInPortfolio: checked })}
              />
            </div>
            {walletError && (
              <div className="flex items-center gap-2 rounded-2xl bg-tint-red p-3 text-sm text-tint-red-fg">
                <AlertCircleIcon className="size-4 shrink-0" />
                {walletError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full font-semibold" onClick={() => setShowWalletModal(false)}>Cancel</Button>
            <Button className="rounded-full font-semibold" onClick={handleSaveWallet} disabled={savingWallet}>
              {savingWallet ? (
                <div className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : null}
              {editingWallet ? 'Save changes' : 'Add wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
