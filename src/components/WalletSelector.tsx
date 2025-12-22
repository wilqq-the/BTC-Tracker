'use client';

import React, { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  PlusIcon, 
  WalletIcon, 
  HardDriveIcon, 
  LaptopIcon, 
  BuildingIcon, 
  SmartphoneIcon, 
  ShieldIcon, 
  FileTextIcon,
  GlobeIcon,
  FlameIcon,
  SnowflakeIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Wallet {
  id: number;
  name: string;
  type: string;
  temperature: string;
  emoji?: string | null;
  color?: string | null;
  balance?: number;
  isDefault?: boolean;
}

interface WalletSelectorProps {
  value?: number | null;
  onChange: (walletId: number | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showBalance?: boolean;
  showExternal?: boolean; // Show "External" option for transfers out
  filterTemperature?: 'HOT' | 'COLD' | null; // Filter by temperature
  excludeWalletId?: number | null; // Exclude a specific wallet (e.g., source when selecting destination)
  onCreateWallet?: () => void; // Callback to open wallet creation
  className?: string;
}

// Wallet type icons mapping
const WALLET_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  HARDWARE: HardDriveIcon,
  SOFTWARE: LaptopIcon,
  EXCHANGE: BuildingIcon,
  MOBILE: SmartphoneIcon,
  CUSTODIAL: ShieldIcon,
  PAPER: FileTextIcon,
};

export function WalletSelector({
  value,
  onChange,
  label,
  placeholder = 'Select wallet',
  disabled = false,
  required = false,
  showBalance = true,
  showExternal = false,
  filterTemperature = null,
  excludeWalletId = null,
  onCreateWallet,
  className,
}: WalletSelectorProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/wallets');
      const data = await response.json();
      
      if (data.wallets) {
        setWallets(data.wallets);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch wallets:', err);
      setError('Failed to load wallets');
    } finally {
      setLoading(false);
    }
  };

  // Filter wallets based on props
  const filteredWallets = wallets.filter(wallet => {
    if (filterTemperature && wallet.temperature !== filterTemperature) {
      return false;
    }
    if (excludeWalletId && wallet.id === excludeWalletId) {
      return false;
    }
    return true;
  });

  // Group wallets by temperature
  const hotWallets = filteredWallets.filter(w => w.temperature === 'HOT');
  const coldWallets = filteredWallets.filter(w => w.temperature === 'COLD');

  const WalletTypeIcon = ({ type, className }: { type: string; className?: string }) => {
    const IconComponent = WALLET_TYPE_ICONS[type] || WalletIcon;
    return <IconComponent className={cn("size-4", className)} />;
  };

  const formatBalance = (balance?: number) => {
    if (balance === undefined) return '';
    if (balance === 0) return '0 BTC';
    if (balance < 0.00001) return `${(balance * 100000000).toFixed(0)} sats`;
    return `${balance.toFixed(8)} BTC`;
  };

  const selectedWallet = wallets.find(w => w.id === value);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={cn("w-full", className)}>
          <SelectValue placeholder="Loading wallets..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive">{error}</div>
    );
  }

  return (
    <Select
      value={value?.toString() || ''}
      onValueChange={(val) => {
        if (val === 'external') {
          onChange(null);
        } else if (val === 'create') {
          onCreateWallet?.();
        } else {
          onChange(parseInt(val, 10));
        }
      }}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder}>
          {selectedWallet && (
            <span className="flex items-center gap-2">
              <WalletTypeIcon type={selectedWallet.type} />
              <span>{selectedWallet.name}</span>
              {showBalance && selectedWallet.balance !== undefined && selectedWallet.balance > 0 && (
                <span className="text-muted-foreground text-xs">
                  ({formatBalance(selectedWallet.balance)})
                </span>
              )}
            </span>
          )}
          {value === null && showExternal && (
            <span className="flex items-center gap-2">
              <GlobeIcon className="size-4" />
              <span>External</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Hot Wallets */}
        {hotWallets.length > 0 && (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1.5">
              <FlameIcon className="size-3.5 text-orange-500" /> Hot Wallets
            </SelectLabel>
            {hotWallets.map((wallet) => (
              <SelectItem key={wallet.id} value={wallet.id.toString()}>
                <div className="flex items-center gap-2 w-full">
                  <WalletTypeIcon type={wallet.type} />
                  <span className="flex-1">{wallet.name}</span>
                  {wallet.isDefault && (
                    <span className="text-xs text-muted-foreground">(default)</span>
                  )}
                  {showBalance && wallet.balance !== undefined && wallet.balance > 0 && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatBalance(wallet.balance)}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* Cold Wallets */}
        {coldWallets.length > 0 && (
          <>
            {hotWallets.length > 0 && <SelectSeparator />}
            <SelectGroup>
              <SelectLabel className="flex items-center gap-1.5">
                <SnowflakeIcon className="size-3.5 text-blue-500" /> Cold Wallets
              </SelectLabel>
              {coldWallets.map((wallet) => (
                <SelectItem key={wallet.id} value={wallet.id.toString()}>
                  <div className="flex items-center gap-2 w-full">
                    <WalletTypeIcon type={wallet.type} />
                    <span className="flex-1">{wallet.name}</span>
                    {wallet.isDefault && (
                      <span className="text-xs text-muted-foreground">(default)</span>
                    )}
                    {showBalance && wallet.balance !== undefined && wallet.balance > 0 && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatBalance(wallet.balance)}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}

        {/* External Option */}
        {showExternal && (
          <>
            <SelectSeparator />
            <SelectItem value="external">
              <div className="flex items-center gap-2">
                <GlobeIcon className="size-4" />
                <span>External (outside your wallets)</span>
              </div>
            </SelectItem>
          </>
        )}

        {/* Create New Wallet */}
        {onCreateWallet && (
          <>
            <SelectSeparator />
            <SelectItem value="create" className="text-primary">
              <div className="flex items-center gap-2">
                <PlusIcon className="size-4" />
                <span>Create New Wallet</span>
              </div>
            </SelectItem>
          </>
        )}

        {/* Empty State */}
        {filteredWallets.length === 0 && !showExternal && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <WalletIcon className="mx-auto size-8 mb-2 opacity-50" />
            <p>No wallets found</p>
            {onCreateWallet && (
              <Button
                variant="link"
                size="sm"
                onClick={onCreateWallet}
                className="mt-1"
              >
                Create your first wallet
              </Button>
            )}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

export default WalletSelector;

