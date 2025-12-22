'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { 
  Loader2Icon, 
  HardDriveIcon, 
  LaptopIcon, 
  BuildingIcon, 
  SmartphoneIcon, 
  ShieldIcon, 
  FileTextIcon,
  FlameIcon,
  SnowflakeIcon,
} from 'lucide-react';

// Wallet type configuration with icons
const WALLET_TYPES = [
  { value: 'HARDWARE', label: 'Hardware Wallet', icon: HardDriveIcon, defaultTemp: 'COLD', description: 'Ledger, Trezor, etc.' },
  { value: 'SOFTWARE', label: 'Software Wallet', icon: LaptopIcon, defaultTemp: 'HOT', description: 'Desktop or browser wallets' },
  { value: 'EXCHANGE', label: 'Exchange', icon: BuildingIcon, defaultTemp: 'HOT', description: 'Kraken, Coinbase, etc.' },
  { value: 'MOBILE', label: 'Mobile Wallet', icon: SmartphoneIcon, defaultTemp: 'HOT', description: 'Phone-based wallets' },
  { value: 'CUSTODIAL', label: 'Custodial', icon: ShieldIcon, defaultTemp: 'COLD', description: 'Third-party custody services' },
  { value: 'PAPER', label: 'Paper Wallet', icon: FileTextIcon, defaultTemp: 'COLD', description: 'Printed keys' },
] as const;

// Color options
const COLOR_OPTIONS = [
  { value: 'blue', bg: 'bg-blue-500', label: 'Blue' },
  { value: 'green', bg: 'bg-green-500', label: 'Green' },
  { value: 'purple', bg: 'bg-purple-500', label: 'Purple' },
  { value: 'orange', bg: 'bg-orange-500', label: 'Orange' },
  { value: 'red', bg: 'bg-red-500', label: 'Red' },
  { value: 'yellow', bg: 'bg-yellow-500', label: 'Yellow' },
  { value: 'pink', bg: 'bg-pink-500', label: 'Pink' },
  { value: 'cyan', bg: 'bg-cyan-500', label: 'Cyan' },
];

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
}

interface WalletFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingWallet?: Wallet | null;
}

interface FormData {
  name: string;
  type: string;
  temperature: 'HOT' | 'COLD';
  color: string;
  notes: string;
  includeInTotal: boolean;
  isDefault: boolean;
}

const initialFormData: FormData = {
  name: '',
  type: 'SOFTWARE',
  temperature: 'HOT',
  color: '',
  notes: '',
  includeInTotal: true,
  isDefault: false,
};

export function WalletForm({
  isOpen,
  onClose,
  onSuccess,
  editingWallet,
}: WalletFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when opening/closing or when editing wallet changes
  useEffect(() => {
    if (isOpen) {
      if (editingWallet) {
        setFormData({
          name: editingWallet.name,
          type: editingWallet.type,
          temperature: editingWallet.temperature as 'HOT' | 'COLD',
          color: editingWallet.color || '',
          notes: editingWallet.notes || '',
          includeInTotal: editingWallet.includeInTotal,
          isDefault: editingWallet.isDefault,
        });
      } else {
        setFormData(initialFormData);
      }
      setError(null);
    }
  }, [isOpen, editingWallet]);

  // Update temperature when type changes
  const handleTypeChange = (type: string) => {
    const typeConfig = WALLET_TYPES.find(t => t.value === type);
    setFormData(prev => ({
      ...prev,
      type,
      temperature: typeConfig?.defaultTemp || 'HOT',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = editingWallet 
        ? `/api/wallets/${editingWallet.id}` 
        : '/api/wallets';
      
      const method = editingWallet ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          type: formData.type,
          temperature: formData.temperature,
          color: formData.color || null,
          notes: formData.notes.trim() || null,
          includeInTotal: formData.includeInTotal,
          isDefault: formData.isDefault,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save wallet');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingWallet ? 'Edit Wallet' : 'Create New Wallet'}
          </DialogTitle>
          <DialogDescription>
            {editingWallet 
              ? 'Update your wallet settings'
              : 'Add a new wallet to track your Bitcoin holdings'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Wallet Name */}
          <div className="space-y-2">
            <Label htmlFor="wallet-name">Wallet Name *</Label>
            <Input
              id="wallet-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Hardware Wallet"
              required
              maxLength={50}
            />
          </div>

          {/* Wallet Type */}
          <div className="space-y-2">
            <Label>Wallet Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              {WALLET_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleTypeChange(type.value)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      "hover:border-primary/50 hover:bg-accent/50",
                      formData.type === type.value 
                        ? "border-primary bg-primary/10" 
                        : "border-border"
                    )}
                  >
                    <Icon className="size-6 mb-1 text-muted-foreground" />
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Temperature Toggle */}
          <div className="space-y-2">
            <Label>Security Level</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.temperature === 'HOT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, temperature: 'HOT' }))}
                className={cn(
                  "flex-1 gap-2",
                  formData.temperature === 'HOT' && "bg-orange-500 hover:bg-orange-600"
                )}
              >
                <FlameIcon className="size-4" /> Hot (Online)
              </Button>
              <Button
                type="button"
                variant={formData.temperature === 'COLD' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, temperature: 'COLD' }))}
                className={cn(
                  "flex-1 gap-2",
                  formData.temperature === 'COLD' && "bg-blue-500 hover:bg-blue-600"
                )}
              >
                <SnowflakeIcon className="size-4" /> Cold (Offline)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formData.temperature === 'HOT' 
                ? 'Connected to internet, convenient but higher risk'
                : 'Offline storage, more secure for long-term holdings'
              }
            </p>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color (optional)</Label>
            <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, color: '' }))}
                className={cn(
                  "size-8 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground hover:bg-accent transition-colors",
                  !formData.color && "ring-2 ring-primary"
                )}
              >
                ✕
              </button>
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={cn(
                    "size-8 rounded transition-all",
                    color.bg,
                    formData.color === color.value && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="wallet-notes">Notes (optional)</Label>
            <Textarea
              id="wallet-notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any notes about this wallet..."
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="include-in-total" className="font-normal">Include in Total</Label>
                <p className="text-xs text-muted-foreground">Count this wallet in your portfolio total</p>
              </div>
              <Switch
                id="include-in-total"
                checked={formData.includeInTotal}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includeInTotal: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is-default" className="font-normal">Default Wallet</Label>
                <p className="text-xs text-muted-foreground">Auto-select for new transactions</p>
              </div>
              <Switch
                id="is-default"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              {editingWallet ? 'Save Changes' : 'Create Wallet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default WalletForm;

