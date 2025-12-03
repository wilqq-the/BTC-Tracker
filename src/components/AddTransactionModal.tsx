'use client';

import React, { useState, useEffect } from 'react';
import { SupportedCurrency } from '@/lib/types';
import currencies from '@/data/currencies.json';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { TagsInput } from '@/components/ui/tags-input';
import { CurrencySelector } from '@/components/ui/currency-selector';
import { ArrowDownIcon, ArrowUpIcon, ArrowLeftRightIcon, CoinsIcon, CalendarIcon, TagIcon, FileTextIcon, InfoIcon, AlertTriangleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionFormData {
  type: 'BUY' | 'SELL' | 'TRANSFER';
  btc_amount: string;
  price_per_btc: string;
  currency: string;
  fees: string;
  fees_currency?: string;
  transaction_date: string;
  notes: string;
  tags: string;
  transfer_type?: 'TO_COLD_WALLET' | 'FROM_COLD_WALLET' | 'BETWEEN_WALLETS';
  destination_address?: string;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingTransaction?: any;
}

const initialFormData: TransactionFormData = {
  type: 'BUY',
  btc_amount: '',
  price_per_btc: '',
  currency: 'USD',
  fees: '0',
  fees_currency: 'BTC', // Default to BTC for transfers
  transaction_date: new Date().toISOString().split('T')[0],
  notes: '',
  tags: '',
  transfer_type: 'TO_COLD_WALLET',
  destination_address: ''
};

export default function AddTransactionModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  editingTransaction 
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>(
    editingTransaction ? {
      type: editingTransaction.type,
      btc_amount: editingTransaction.btc_amount.toString(),
      price_per_btc: editingTransaction.original_price_per_btc.toString(),
      currency: editingTransaction.original_currency,
      fees: editingTransaction.fees.toString(),
      fees_currency: editingTransaction.fees_currency || 'USD',
      transaction_date: editingTransaction.transaction_date,
      notes: editingTransaction.notes || '',
      tags: editingTransaction.tags || '',
      transfer_type: editingTransaction.transfer_type || 'TO_COLD_WALLET',
      destination_address: editingTransaction.destination_address || ''
    } : initialFormData
  );
  
  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedCurrency[]>(['USD', 'EUR', 'PLN', 'GBP']);
  const [customCurrencies, setCustomCurrencies] = useState<any[]>([]);
  const [allAvailableCurrencies, setAllAvailableCurrencies] = useState<Array<{code: string, name: string, symbol: string}>>([]);
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number | null>(null);
  
  // Helper function to get currency info from currencies.json
  const getCurrencyInfo = (code: string) => {
    const currency = currencies.find(c => c.alpha === code);
    return currency ? { name: currency.name, symbol: currency.symbol } : { name: code, symbol: code };
  };

  // Update form data when editingTransaction changes
  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        type: editingTransaction.type,
        btc_amount: editingTransaction.btc_amount.toString(),
        price_per_btc: editingTransaction.original_price_per_btc.toString(),
        currency: editingTransaction.original_currency,
        fees: editingTransaction.fees.toString(),
        fees_currency: editingTransaction.fees_currency || 'USD',
        transaction_date: editingTransaction.transaction_date,
        notes: editingTransaction.notes || '',
        tags: editingTransaction.tags || '',
        transfer_type: editingTransaction.transfer_type || 'TO_COLD_WALLET',
        destination_address: editingTransaction.destination_address || ''
      });
    } else {
      setFormData(initialFormData);
    }
  }, [editingTransaction]);

  // Load supported currencies from settings and custom currencies
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        // Load settings for supported currencies
        const settingsResponse = await fetch('/api/settings');
        const settingsResult = await settingsResponse.json();
        
        // Load custom currencies
        const customResponse = await fetch('/api/custom-currencies');
        const customResult = await customResponse.json();
        
        let enabledCurrencies: SupportedCurrency[] = ['USD', 'EUR', 'PLN', 'GBP']; // fallback
        let customCurrencyList: any[] = [];
        
        if (settingsResult.success && settingsResult.data?.currency?.supportedCurrencies) {
          enabledCurrencies = settingsResult.data.currency.supportedCurrencies;
          console.log('Loaded enabled currencies from settings:', enabledCurrencies);
        }
        
        if (customResult.success && customResult.data) {
          customCurrencyList = customResult.data;
          console.log('Loaded custom currencies:', customCurrencyList);
        }
        
        setSupportedCurrencies(enabledCurrencies);
        setCustomCurrencies(customCurrencyList);
        
        // Combine built-in and custom currencies for the dropdown
        const builtInCurrencies = enabledCurrencies.map(code => {
          const info = getCurrencyInfo(code);
          return {
            code,
            name: info.name,
            symbol: info.symbol
          };
        });
        
        const customCurrenciesFormatted = customCurrencyList.map(currency => ({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol
        }));
        
        // Deduplicate currencies (custom currencies override built-in ones with same code)
        const currencyMap = new Map();
        
        // Add built-in currencies first
        builtInCurrencies.forEach(currency => {
          currencyMap.set(currency.code, currency);
        });
        
        // Add custom currencies (will override built-in if same code)
        customCurrenciesFormatted.forEach(currency => {
          currencyMap.set(currency.code, currency);
        });
        
        const allCurrencies = Array.from(currencyMap.values());
        setAllAvailableCurrencies(allCurrencies);
        
        // If the current form currency is not in the available list, reset to first available currency
        const availableCodes = allCurrencies.map(c => c.code);
        if (!availableCodes.includes(formData.currency)) {
          setFormData(prev => ({ ...prev, currency: availableCodes[0] || 'USD' }));
        }
        
      } catch (error) {
        console.error('Error loading currencies:', error);
        // Keep default currencies as fallback
        const fallbackCurrencies = supportedCurrencies.map(code => {
          const info = getCurrencyInfo(code);
          return {
            code,
            name: info.name,
            symbol: info.symbol
          };
        });
        setAllAvailableCurrencies(fallbackCurrencies);
      }
    };

    if (isOpen) {
      loadCurrencies();
      loadCurrentBitcoinPrice();
    }
  }, [isOpen]);

  // Load current Bitcoin price
  const loadCurrentBitcoinPrice = async () => {
    try {
      const response = await fetch('/api/bitcoin-price');
      const result = await response.json();
      if (result.success && result.data?.price) {
        setCurrentBtcPrice(result.data.price);
      }
    } catch (error) {
      console.error('Error loading Bitcoin price:', error);
    }
  };

  // Calculate real-time totals
  const calculateTotal = () => {
    const btcAmount = parseFloat(formData.btc_amount) || 0;
    const pricePerBtc = parseFloat(formData.price_per_btc) || 0;
    const fees = parseFloat(formData.fees) || 0;
    const subtotal = btcAmount * pricePerBtc;
    const total = subtotal + fees;
    return { subtotal, fees, total };
  };

  // Convert BTC to sats
  const btcToSats = (btc: string) => {
    const btcNum = parseFloat(btc) || 0;
    return Math.round(btcNum * 100000000);
  };

  // Use current BTC price
  const useCurrentPrice = () => {
    if (currentBtcPrice) {
      setFormData(prev => ({ ...prev, price_per_btc: currentBtcPrice.toFixed(2) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const method = editingTransaction ? 'PUT' : 'POST';
      const url = editingTransaction 
        ? `/api/transactions/${editingTransaction.id}` 
        : '/api/transactions';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      
      if (result.success) {
        setFormData(initialFormData);
        onSuccess?.();
        onClose();
      } else {
        alert(`Error: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction. Please try again.');
    }
  };

  const totals = calculateTotal();
  const sats = btcToSats(formData.btc_amount);
  const currencyInfo = getCurrencyInfo(formData.currency);

  // Get icon and color for transaction type
  const getTransactionTypeConfig = (type: 'BUY' | 'SELL' | 'TRANSFER') => {
    switch (type) {
      case 'BUY':
        return { icon: ArrowDownIcon, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800' };
      case 'SELL':
        return { icon: ArrowUpIcon, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800' };
      case 'TRANSFER':
        return { icon: ArrowLeftRightIcon, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800' };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CoinsIcon className="size-6 text-btc-500" />
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
          <DialogDescription>
            {editingTransaction 
              ? 'Update the details of your Bitcoin transaction' 
              : 'Record a new Bitcoin transaction to track your portfolio'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Transaction Type */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Transaction Type</Label>
            <div className="grid grid-cols-3 gap-3">
              {(['BUY', 'SELL', 'TRANSFER'] as const).map((type) => {
                const config = getTransactionTypeConfig(type);
                const Icon = config.icon;
                const isSelected = formData.type === type;
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="lg"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      type,
                      fees_currency: type === 'TRANSFER' ? 'BTC' : prev.fees_currency
                    }))}
                    className={cn(
                      "flex flex-col gap-2 h-auto py-4",
                      isSelected && type === 'BUY' && "bg-green-500 hover:bg-green-600",
                      isSelected && type === 'SELL' && "bg-red-500 hover:bg-red-600",
                      isSelected && type === 'TRANSFER' && "bg-blue-500 hover:bg-blue-600"
                    )}
                  >
                    <Icon className={cn("size-5", isSelected ? "text-white" : config.color)} />
                    <span className="font-semibold">{type}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* BTC Amount */}
          <div className="space-y-2">
            <Label htmlFor="btc_amount" className="text-base">
              {formData.type === 'TRANSFER' ? 'BTC Amount to Send' : 'BTC Amount'}
            </Label>
            <Input
              id="btc_amount"
              type="number"
              step="0.00000001"
              value={formData.btc_amount}
              onChange={(e) => setFormData(prev => ({ ...prev, btc_amount: e.target.value }))}
              placeholder="0.00000000"
              className="font-mono text-base"
              required
            />
            {formData.btc_amount && parseFloat(formData.btc_amount) > 0 && (
              <p className="text-sm text-muted-foreground font-mono">
                = {sats.toLocaleString()} sats
              </p>
            )}
            {formData.type === 'TRANSFER' && (
              <div className="space-y-2 mt-2">
                <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-800">
                  <InfoIcon className="size-4 flex-shrink-0" />
                  <span>Enter the <strong>total amount leaving</strong> your source wallet</span>
                </div>
                {parseFloat(formData.btc_amount || '0') > 0 && parseFloat(formData.fees || '0') > 0 && (
                  <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-700 dark:text-green-300">Will arrive at destination:</span>
                        <span className="font-mono font-bold text-green-600 dark:text-green-400">
                          {(parseFloat(formData.btc_amount) - parseFloat(formData.fees)).toFixed(8)} BTC
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Transfer Type (only for TRANSFER) */}
          {formData.type === 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="transfer_type" className="text-base">Transfer Direction</Label>
              <Select 
                value={formData.transfer_type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, transfer_type: value as any }))}
              >
                <SelectTrigger id="transfer_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TO_COLD_WALLET">To Cold Wallet</SelectItem>
                  <SelectItem value="FROM_COLD_WALLET">From Cold Wallet</SelectItem>
                  <SelectItem value="BETWEEN_WALLETS">Between Wallets</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Price per BTC (hidden for TRANSFER) */}
          {formData.type !== 'TRANSFER' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="price_per_btc" className="text-base">Price per BTC</Label>
                {currentBtcPrice && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={useCurrentPrice}
                    className="h-auto p-0 text-btc-500 hover:text-btc-600"
                  >
                    Use current: ${currentBtcPrice.toLocaleString()}
                  </Button>
                )}
              </div>
              <Input
                id="price_per_btc"
                type="number"
                step="0.01"
                value={formData.price_per_btc}
                onChange={(e) => setFormData(prev => ({ ...prev, price_per_btc: e.target.value }))}
                placeholder="105000.00"
                className="font-mono text-base"
                required
              />
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <InfoIcon className="size-3 flex-shrink-0" />
                <span>Enter 0 for mining rewards, gifts, or airdrops</span>
              </p>
            </div>
          )}

          {/* Currency (hidden for TRANSFER since no fiat is involved) */}
          {formData.type !== 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-base">Currency</Label>
              <CurrencySelector
                id="currency"
                value={formData.currency}
                currencies={allAvailableCurrencies}
                onChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                placeholder="Select currency..."
                searchPlaceholder="Search currency..."
              />
            </div>
          )}

          {/* Fees */}
          <div className="space-y-2">
            <Label htmlFor="fees" className="text-base">
              {formData.type === 'TRANSFER' ? 'Network Fees (in BTC)' : 'Fees'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="fees"
                type="number"
                step={formData.type === 'TRANSFER' ? '0.00000001' : '0.01'}
                value={formData.fees}
                onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
                placeholder={formData.type === 'TRANSFER' ? '0.00001' : '0.00'}
                className="flex-1 font-mono text-base"
              />
              {formData.type === 'TRANSFER' && (
                <div className="w-20 flex items-center justify-center px-3 py-2 bg-muted border rounded-md text-muted-foreground font-medium text-sm">
                  BTC
                </div>
              )}
            </div>
            {formData.type === 'TRANSFER' && parseFloat(formData.fees || '0') > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <AlertTriangleIcon className="size-3 flex-shrink-0" />
                <span>Network fees are deducted from your total holdings</span>
              </p>
            )}
          </div>

          {/* Destination Address (only for TRANSFER) */}
          {formData.type === 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="destination_address" className="text-base">
                Destination Address <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="destination_address"
                type="text"
                value={formData.destination_address}
                onChange={(e) => setFormData(prev => ({ ...prev, destination_address: e.target.value }))}
                placeholder="bc1q... (optional for tracking)"
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Cost Breakdown */}
          {formData.type !== 'TRANSFER' && totals.subtotal > 0 && (
            <Card className="border-btc-200 dark:border-btc-800 bg-btc-50 dark:bg-btc-900/10">
              <CardContent className="p-4 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cost Breakdown
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono font-medium">
                      {currencyInfo.symbol}{totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {totals.fees > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fees</span>
                      <span className="font-mono font-medium">
                        {currencyInfo.symbol}{totals.fees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t">
                    <span>Total Cost</span>
                    <span className="font-mono text-btc-600 dark:text-btc-400">
                      {currencyInfo.symbol}{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transfer Summary (only for TRANSFER) - Simplified */}
          {formData.type === 'TRANSFER' && parseFloat(formData.btc_amount || '0') > 0 && parseFloat(formData.fees || '0') > 0 && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Arrives at destination</span>
                  <span className="font-mono text-lg font-bold text-green-600 dark:text-green-400">
                    {(parseFloat(formData.btc_amount) - parseFloat(formData.fees || '0')).toFixed(8)} BTC
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label htmlFor="transaction_date" className="text-base flex items-center gap-2">
              <CalendarIcon className="size-4" />
              Transaction Date
            </Label>
            <DatePicker
              id="transaction_date"
              value={formData.transaction_date ? new Date(formData.transaction_date) : undefined}
              onChange={(date) => setFormData(prev => ({ 
                ...prev, 
                transaction_date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
              }))}
              placeholder="Select date"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base flex items-center gap-2">
              <FileTextIcon className="size-4" />
              Notes <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any notes about this transaction..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-base flex items-center gap-2">
              <TagIcon className="size-4" />
              Tags <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <TagsInput
              id="tags"
              value={formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
              onChange={(tags) => setFormData(prev => ({ ...prev, tags: tags.join(', ') }))}
              placeholder="Type tag and press Enter"
            />
            <p className="text-xs text-muted-foreground">
              Press Enter to add a tag. Click X to remove.
            </p>
          </div>
          </div>

          <DialogFooter className="mt-6 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="bg-btc-500 hover:bg-btc-600"
            >
              {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 