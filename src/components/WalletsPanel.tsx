'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { WalletIcon, EditIcon, TrashIcon, AlertCircleIcon } from 'lucide-react';
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
  const [walletForm, setWalletForm] = useState({ name: '', type: 'hot' as 'cold' | 'hot', emoji: '', note: '', includeInPortfolio: true });
  const [walletError, setWalletError] = useState('');
  const [savingWallet, setSavingWallet] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  // Surface the primary action in the settings page header
  useEffect(() => {
    onHeaderAction?.({ label: 'Add Wallet', onClick: openAddWallet });
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
    setWalletForm({ name: '', type: 'hot', emoji: '', note: '', includeInPortfolio: true });
    setWalletError('');
    setShowWalletModal(true);
  };

  const openEditWallet = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setWalletForm({
      name: wallet.name,
      type: wallet.type,
      emoji: wallet.emoji || '',
      note: wallet.note || '',
      includeInPortfolio: wallet.includeInPortfolio,
    });
    setWalletError('');
    setShowWalletModal(true);
  };

  const handleSaveWallet = async () => {
    if (!walletForm.name.trim()) {
      setWalletError('Wallet name is required');
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
        await loadWallets();
      } else {
        setWalletError(result.message || 'Failed to save wallet');
      }
    } catch (error) {
      setWalletError('An error occurred');
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
        await loadWallets();
      } else {
        toast({ title: 'Failed to delete wallet', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting wallet:', error);
      toast({ title: 'Failed to delete wallet', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          {walletsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <WalletIcon className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No wallets yet. Add your first wallet to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wallets.map(wallet => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between p-3 bg-muted/40 rounded-2xl hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'size-9 rounded-full flex items-center justify-center text-lg',
                      wallet.type === 'cold' ? 'bg-blue-500/10' : 'bg-orange-500/10'
                    )}>
                      {wallet.emoji || (wallet.type === 'cold' ? '❄️' : '🔥')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{wallet.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs py-0',
                            wallet.type === 'cold'
                              ? 'text-blue-600 border-blue-500/30'
                              : 'text-orange-600 border-orange-500/30'
                          )}
                        >
                          {wallet.type === 'cold' ? 'Cold' : 'Hot'}
                        </Badge>
                        {!wallet.includeInPortfolio && (
                          <Badge variant="outline" className="text-xs py-0 text-muted-foreground">
                            Excluded
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                        {wallet.btcBalance.toFixed(8)} ₿
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditWallet(wallet)}>
                      <EditIcon className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDeleteWallet(wallet)}>
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Wallet Dialog */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWallet ? 'Edit Wallet' : 'Add Wallet'}</DialogTitle>
            <DialogDescription>
              {editingWallet ? 'Update your wallet details.' : 'Add a new wallet to track your Bitcoin holdings.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="walletName">Name *</Label>
              <Input
                id="walletName"
                placeholder="e.g. Ledger Nano, Kraken, Lightning"
                value={walletForm.name}
                onChange={e => setWalletForm({ ...walletForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={walletForm.type} onValueChange={v => setWalletForm({ ...walletForm, type: v as 'cold' | 'hot' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">❄️ Cold Storage</SelectItem>
                    <SelectItem value="hot">🔥 Hot Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walletEmoji">Emoji / Icon</Label>
                <Input
                  id="walletEmoji"
                  placeholder="🏦"
                  value={walletForm.emoji}
                  onChange={e => setWalletForm({ ...walletForm, emoji: e.target.value })}
                  maxLength={4}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walletNote">Note</Label>
              <Input
                id="walletNote"
                placeholder="Optional description"
                value={walletForm.note}
                onChange={e => setWalletForm({ ...walletForm, note: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-2xl">
              <div>
                <p className="text-sm font-medium">Include in Portfolio Total</p>
                <p className="text-xs text-muted-foreground">When disabled, this wallet&apos;s BTC is excluded from your portfolio value</p>
              </div>
              <button
                type="button"
                onClick={() => setWalletForm({ ...walletForm, includeInPortfolio: !walletForm.includeInPortfolio })}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  walletForm.includeInPortfolio ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block size-5 rounded-full bg-white shadow transform transition-transform',
                  walletForm.includeInPortfolio ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
            {walletError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                <AlertCircleIcon className="size-4" />
                {walletError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWalletModal(false)}>Cancel</Button>
            <Button onClick={handleSaveWallet} disabled={savingWallet}>
              {savingWallet ? (
                <div className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              {editingWallet ? 'Save Changes' : 'Add Wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
