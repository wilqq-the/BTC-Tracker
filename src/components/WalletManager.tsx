'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WalletForm } from '@/components/WalletForm';
import { cn } from '@/lib/utils';
import {
  PlusIcon,
  MoreVerticalIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  Loader2Icon,
  WalletIcon,
  AlertCircleIcon,
  HardDriveIcon,
  LaptopIcon,
  BuildingIcon,
  SmartphoneIcon,
  ShieldIcon,
  FileTextIcon,
  FlameIcon,
  SnowflakeIcon,
} from 'lucide-react';

// Wallet type icon mapping
const WALLET_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  HARDWARE: HardDriveIcon,
  SOFTWARE: LaptopIcon,
  EXCHANGE: BuildingIcon,
  MOBILE: SmartphoneIcon,
  CUSTODIAL: ShieldIcon,
  PAPER: FileTextIcon,
};

interface Wallet {
  id: number;
  name: string;
  type: string;
  temperature: string;
  emoji?: string | null;
  color?: string | null;
  notes?: string | null;
  includeInTotal: boolean;
  isDefault: boolean;
  sortOrder: number;
  balance: number;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WalletSummary {
  totalBalance: number;
  includedBalance: number;
  hotBalance: number;
  coldBalance: number;
  walletCount: number;
}

interface WalletManagerProps {
  onWalletChange?: () => void;
}

// Color to Tailwind class mapping
const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/20 border-blue-500/50',
  green: 'bg-green-500/20 border-green-500/50',
  purple: 'bg-purple-500/20 border-purple-500/50',
  orange: 'bg-orange-500/20 border-orange-500/50',
  red: 'bg-red-500/20 border-red-500/50',
  yellow: 'bg-yellow-500/20 border-yellow-500/50',
  pink: 'bg-pink-500/20 border-pink-500/50',
  cyan: 'bg-cyan-500/20 border-cyan-500/50',
};

export function WalletManager({ onWalletChange }: WalletManagerProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [deletingWallet, setDeletingWallet] = useState<Wallet | null>(null);
  const [reassignWalletId, setReassignWalletId] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/wallets');
      const data = await response.json();

      if (data.wallets) {
        setWallets(data.wallets);
        setSummary(data.summary);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch wallets:', err);
      setError('Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleSetDefault = async (wallet: Wallet) => {
    try {
      const response = await fetch(`/api/wallets/${wallet.id}/set-default`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchWallets();
        onWalletChange?.();
      }
    } catch (err) {
      console.error('Failed to set default wallet:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingWallet) return;

    setDeleteLoading(true);
    try {
      const body = deletingWallet.transactionCount > 0 && reassignWalletId
        ? JSON.stringify({ reassignToWalletId: parseInt(reassignWalletId, 10) })
        : undefined;

      const response = await fetch(`/api/wallets/${deletingWallet.id}`, {
        method: 'DELETE',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete wallet');
      }

      setDeletingWallet(null);
      setReassignWalletId('');
      fetchWallets();
      onWalletChange?.();
    } catch (err) {
      console.error('Failed to delete wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete wallet');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return '0 BTC';
    if (balance < 0.00001) return `${(balance * 100000000).toFixed(0)} sats`;
    return `${balance.toFixed(8)} BTC`;
  };

  const getWalletColorClass = (wallet: Wallet) => {
    if (wallet.color && COLOR_CLASSES[wallet.color]) {
      return COLOR_CLASSES[wallet.color];
    }
    return wallet.temperature === 'COLD' 
      ? 'bg-blue-500/10 border-blue-500/30' 
      : 'bg-orange-500/10 border-orange-500/30';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircleIcon className="size-12 text-destructive mb-4" />
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchWallets} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Portfolio Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Balance</p>
                <p className="text-lg font-mono font-semibold">{formatBalance(summary.totalBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FlameIcon className="size-3.5 text-orange-500" /> Hot Wallets
                </p>
                <p className="text-lg font-mono font-semibold text-orange-500">{formatBalance(summary.hotBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <SnowflakeIcon className="size-3.5 text-blue-500" /> Cold Wallets
                </p>
                <p className="text-lg font-mono font-semibold text-blue-500">{formatBalance(summary.coldBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wallets</p>
                <p className="text-lg font-semibold">{summary.walletCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallets Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Wallets</h3>
        <Button onClick={() => setShowCreateForm(true)} size="sm">
          <PlusIcon className="size-4 mr-1" />
          Add Wallet
        </Button>
      </div>

      {/* Wallets Grid */}
      {wallets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WalletIcon className="size-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Wallets Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first wallet to start tracking your Bitcoin holdings
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <PlusIcon className="size-4 mr-2" />
              Create Your First Wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <Card 
              key={wallet.id} 
              className={cn(
                "relative overflow-hidden transition-all hover:shadow-md",
                getWalletColorClass(wallet)
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = WALLET_TYPE_ICONS[wallet.type] || WalletIcon;
                      return <Icon className="size-8 text-muted-foreground" />;
                    })()}
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {wallet.name}
                        {wallet.isDefault && (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-yellow-600 dark:text-yellow-500">
                            <StarIcon className="size-3.5 fill-yellow-500" />
                            default
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        {wallet.temperature === 'COLD' ? (
                          <><SnowflakeIcon className="size-3 text-blue-500" /> Cold</>
                        ) : (
                          <><FlameIcon className="size-3 text-orange-500" /> Hot</>
                        )}
                        <span className="mx-1">•</span>
                        {wallet.type.charAt(0) + wallet.type.slice(1).toLowerCase()}
                      </CardDescription>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreVerticalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingWallet(wallet)}>
                        <PencilIcon className="size-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {!wallet.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(wallet)}>
                          <StarIcon className="size-4 mr-2" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeletingWallet(wallet)}
                        className="text-destructive focus:text-destructive"
                        disabled={wallet.isDefault || wallets.length <= 1}
                      >
                        <TrashIcon className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-xl font-mono font-semibold">
                      {formatBalance(wallet.balance)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{wallet.transactionCount} transactions</span>
                    {!wallet.includeInTotal && (
                      <span className="text-yellow-600">Excluded from total</span>
                    )}
                  </div>
                  {wallet.notes && (
                    <p className="text-xs text-muted-foreground truncate" title={wallet.notes}>
                      {wallet.notes}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      <WalletForm
        isOpen={showCreateForm || !!editingWallet}
        onClose={() => {
          setShowCreateForm(false);
          setEditingWallet(null);
        }}
        onSuccess={() => {
          fetchWallets();
          onWalletChange?.();
        }}
        editingWallet={editingWallet}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingWallet} onOpenChange={(open) => !open && setDeletingWallet(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingWallet?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingWallet?.transactionCount && deletingWallet.transactionCount > 0 ? (
                <>
                  This wallet has <strong>{deletingWallet.transactionCount} transactions</strong>. 
                  You must reassign them to another wallet before deleting.
                </>
              ) : (
                'This action cannot be undone. The wallet will be permanently deleted.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Reassignment selector for wallets with transactions */}
          {deletingWallet?.transactionCount && deletingWallet.transactionCount > 0 && (
            <div className="py-4">
              <label className="text-sm font-medium">Move transactions to:</label>
              <Select value={reassignWalletId} onValueChange={setReassignWalletId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets
                    .filter(w => w.id !== deletingWallet?.id)
                    .map((wallet) => {
                      const Icon = WALLET_TYPE_ICONS[wallet.type] || WalletIcon;
                      return (
                        <SelectItem key={wallet.id} value={wallet.id.toString()}>
                          <span className="flex items-center gap-2">
                            <Icon className="size-4" />
                            <span>{wallet.name}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading || (deletingWallet?.transactionCount && deletingWallet.transactionCount > 0 && !reassignWalletId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Delete Wallet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default WalletManager;

