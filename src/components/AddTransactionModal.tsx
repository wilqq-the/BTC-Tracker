'use client';

import React, { useState, useEffect } from 'react';
import { SupportedCurrency } from '@/lib/types';
import currencies from '@/data/currencies.json';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { DatePicker } from '@/components/ui/date-picker';
import { TagsInput } from '@/components/ui/tags-input';
import { CurrencySelector } from '@/components/ui/currency-selector';
import { ArrowDownIcon, ArrowUpIcon, ArrowLeftRightIcon, CoinsIcon, ArrowDownToLineIcon, ArrowUpFromLineIcon, RefreshCwIcon, ChevronDownIcon, PlusIcon, WalletIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WalletSelector } from '@/components/WalletSelector';
import { WalletForm } from '@/components/WalletForm';

/**
 * Format a Date to YYYY-MM-DD string in LOCAL timezone (not UTC)
 * This fixes the "off by one day" bug when selecting dates near midnight
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date in LOCAL timezone
 * Using "T12:00:00" ensures the date doesn't shift due to timezone offset
 */
function parseDateLocal(dateStr: string): Date {
  // Add noon time to avoid timezone issues (midnight can shift days)
  return new Date(`${dateStr}T12:00:00`);
}

interface TransactionFormData {
  type: 'BUY' | 'SELL' | 'TRANSFER';
  btc_amount: string;
  price_per_btc: string;
  total_fiat_amount: string; // For fiat input mode
  currency: string;
  fees: string;
  fees_currency?: string;
  transaction_date: string;
  notes: string;
  tags: string;
  transfer_type?: 'TO_COLD_WALLET' | 'FROM_COLD_WALLET' | 'BETWEEN_WALLETS' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  transfer_category?: 'INTERNAL' | 'EXTERNAL'; // For two-step UI
  destination_address?: string;
  // Multi-wallet support
  source_wallet_id?: number | null;
  destination_wallet_id?: number | null;
}

type InputMode = 'price' | 'fiat';

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
  total_fiat_amount: '',
  currency: 'USD',
  fees: '0',
  fees_currency: 'BTC', // Default to BTC for transfers
  transaction_date: formatDateLocal(new Date()),
  notes: '',
  tags: '',
  transfer_type: 'TO_COLD_WALLET',
  transfer_category: 'INTERNAL',
  destination_address: '',
  source_wallet_id: null,
  destination_wallet_id: null,
};

export default function AddTransactionModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  editingTransaction 
}: AddTransactionModalProps) {
  // Helper to determine transfer category from transfer_type
  const getTransferCategory = (transferType?: string): 'INTERNAL' | 'EXTERNAL' => {
    if (transferType === 'TRANSFER_IN' || transferType === 'TRANSFER_OUT') {
      return 'EXTERNAL';
    }
    return 'INTERNAL';
  };

  const [formData, setFormData] = useState<TransactionFormData>(
    editingTransaction ? {
      type: editingTransaction.type,
      btc_amount: editingTransaction.btc_amount.toString(),
      price_per_btc: editingTransaction.original_price_per_btc.toString(),
      total_fiat_amount: (editingTransaction.btc_amount * editingTransaction.original_price_per_btc).toFixed(2),
      currency: editingTransaction.original_currency,
      fees: editingTransaction.fees.toString(),
      fees_currency: editingTransaction.fees_currency || 'USD',
      transaction_date: editingTransaction.transaction_date,
      notes: editingTransaction.notes || '',
      tags: editingTransaction.tags || '',
      transfer_type: editingTransaction.transfer_type || 'TO_COLD_WALLET',
      transfer_category: getTransferCategory(editingTransaction.transfer_type),
      destination_address: editingTransaction.destination_address || '',
      source_wallet_id: editingTransaction.source_wallet_id || null,
      destination_wallet_id: editingTransaction.destination_wallet_id || null,
    } : initialFormData
  );
  
  // Input mode: 'price' = enter BTC price, 'fiat' = enter total fiat spent
  const [inputMode, setInputMode] = useState<InputMode>('price');
  
  // UI state for collapsible sections
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showFees, setShowFees] = useState(false);
  
  // Wallet creation modal
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletSelectorKey, setWalletSelectorKey] = useState(0); // Key to force re-fetch wallets
  
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
        total_fiat_amount: (editingTransaction.btc_amount * editingTransaction.original_price_per_btc).toFixed(2),
        currency: editingTransaction.original_currency,
        fees: editingTransaction.fees.toString(),
        fees_currency: editingTransaction.fees_currency || 'USD',
        transaction_date: editingTransaction.transaction_date,
        notes: editingTransaction.notes || '',
        tags: editingTransaction.tags || '',
        transfer_type: editingTransaction.transfer_type || 'TO_COLD_WALLET',
        transfer_category: getTransferCategory(editingTransaction.transfer_type),
        destination_address: editingTransaction.destination_address || '',
        source_wallet_id: editingTransaction.source_wallet_id || null,
        destination_wallet_id: editingTransaction.destination_wallet_id || null,
      });
      setInputMode('price'); // Default to price mode when editing
      // Show more options if editing has notes or tags
      setShowMoreOptions(!!(editingTransaction.notes || editingTransaction.tags));
      setShowFees(parseFloat(editingTransaction.fees) > 0);
    } else {
      setFormData(initialFormData);
      setInputMode('price');
      setShowMoreOptions(false);
      setShowFees(false);
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

  // Calculate real-time totals (works in both input modes)
  const calculateTotal = () => {
    const btcAmount = parseFloat(formData.btc_amount) || 0;
    const fees = parseFloat(formData.fees) || 0;
    
    let subtotal: number;
    let pricePerBtc: number;
    
    if (inputMode === 'fiat') {
      // In fiat mode, total is the input and we derive price
      subtotal = parseFloat(formData.total_fiat_amount) || 0;
      pricePerBtc = btcAmount > 0 ? subtotal / btcAmount : 0;
    } else {
      // In price mode, price is the input and we derive total
      pricePerBtc = parseFloat(formData.price_per_btc) || 0;
      subtotal = btcAmount * pricePerBtc;
    }
    
    const total = subtotal + fees;
    return { subtotal, fees, total, pricePerBtc };
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
      
      // Prepare submit data - calculate price_per_btc if in fiat mode
      let submitData = { ...formData };
      if (inputMode === 'fiat') {
        const btcAmount = parseFloat(formData.btc_amount) || 0;
        const totalFiat = parseFloat(formData.total_fiat_amount) || 0;
        if (btcAmount > 0 && totalFiat > 0) {
          submitData.price_per_btc = (totalFiat / btcAmount).toFixed(2);
        }
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();
      
      if (result.success) {
        setFormData(initialFormData);
        setInputMode('price');
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
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <CoinsIcon className="size-5 text-btc-500" />
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Transaction Type - Compact horizontal */}
          <div className="flex items-center gap-2">
              {(['BUY', 'SELL', 'TRANSFER'] as const).map((type) => {
                const config = getTransactionTypeConfig(type);
                const Icon = config.icon;
                const isSelected = formData.type === type;
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                  size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      type,
                      fees_currency: type === 'TRANSFER' ? 'BTC' : prev.fees_currency
                    }))}
                    className={cn(
                    "gap-1.5",
                      isSelected && type === 'BUY' && "bg-green-500 hover:bg-green-600",
                      isSelected && type === 'SELL' && "bg-red-500 hover:bg-red-600",
                      isSelected && type === 'TRANSFER' && "bg-blue-500 hover:bg-blue-600"
                    )}
                  >
                  <Icon className={cn("size-4", isSelected ? "text-white" : config.color)} />
                  <span className="font-medium">{type}</span>
                  </Button>
                );
              })}
          </div>

          {/* BTC Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="btc_amount">BTC Amount</Label>
            <Input
              id="btc_amount"
              type="number"
              step="0.00000001"
              value={formData.btc_amount}
              onChange={(e) => setFormData(prev => ({ ...prev, btc_amount: e.target.value }))}
              placeholder="0.00000000"
              className="font-mono"
              required
            />
            {formData.btc_amount && parseFloat(formData.btc_amount) > 0 && (
              <p className="text-xs text-muted-foreground font-mono">
                = {sats.toLocaleString()} sats
              </p>
            )}
          </div>

          {/* Wallet Selection for BUY/SELL */}
          {formData.type !== 'TRANSFER' && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <WalletIcon className="size-4" />
                {formData.type === 'BUY' ? 'Destination Wallet' : 'Source Wallet'}
              </Label>
              <WalletSelector
                key={walletSelectorKey}
                value={formData.type === 'BUY' ? formData.destination_wallet_id : formData.source_wallet_id}
                onChange={(walletId) => setFormData(prev => ({
                  ...prev,
                  [formData.type === 'BUY' ? 'destination_wallet_id' : 'source_wallet_id']: walletId
                }))}
                placeholder={formData.type === 'BUY' ? 'Where BTC will be stored' : 'Where BTC is coming from'}
                onCreateWallet={() => setShowWalletForm(true)}
              />
              <p className="text-xs text-muted-foreground">
                {formData.type === 'BUY' 
                  ? 'Select where you want to store your purchased Bitcoin'
                  : 'Select which wallet you are selling from'
                }
              </p>
            </div>
          )}

          {/* Transfer Type (only for TRANSFER) - Compact */}
          {formData.type === 'TRANSFER' && (
            <div className="space-y-3">
              {/* Internal vs External */}
              <div className="space-y-1.5">
                <Label>Transfer Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.transfer_category === 'INTERNAL' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      transfer_category: 'INTERNAL',
                      transfer_type: 'TO_COLD_WALLET'
                    }))}
                    className={cn(
                      "gap-1.5",
                      formData.transfer_category === 'INTERNAL' && "bg-blue-500 hover:bg-blue-600"
                    )}
                  >
                    <RefreshCwIcon className="size-4" />
                    Internal
                  </Button>
                  <Button
                    type="button"
                    variant={formData.transfer_category === 'EXTERNAL' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      transfer_category: 'EXTERNAL',
                      transfer_type: 'TRANSFER_IN'
                    }))}
                    className={cn(
                      "gap-1.5",
                      formData.transfer_category === 'EXTERNAL' && "bg-purple-500 hover:bg-purple-600"
                    )}
                  >
                    <ArrowLeftRightIcon className="size-4" />
                    External
                  </Button>
                </div>
              </div>

              {/* Direction */}
              <div className="space-y-1.5">
                <Label>Direction</Label>
                {formData.transfer_category === 'INTERNAL' ? (
                  <div className="flex gap-2">
                    {[
                      { type: 'TO_COLD_WALLET', icon: ArrowDownToLineIcon, label: 'To Cold' },
                      { type: 'FROM_COLD_WALLET', icon: ArrowUpFromLineIcon, label: 'From Cold' },
                      { type: 'BETWEEN_WALLETS', icon: RefreshCwIcon, label: 'Between' },
                    ].map(({ type, icon: Icon, label }) => (
                    <Button
                        key={type}
                      type="button"
                        variant={formData.transfer_type === type ? "default" : "outline"}
                      size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, transfer_type: type as any }))}
                      className={cn(
                          "gap-1.5 flex-1",
                          formData.transfer_type === type && "bg-blue-500 hover:bg-blue-600"
                      )}
                    >
                        <Icon className="size-4" />
                        {label}
                    </Button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formData.transfer_type === 'TRANSFER_IN' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, transfer_type: 'TRANSFER_IN' }))}
                      className={cn(
                        "gap-1.5 flex-1",
                        formData.transfer_type === 'TRANSFER_IN' && "bg-green-500 hover:bg-green-600"
                      )}
                    >
                      <ArrowDownIcon className="size-4" />
                      Transfer In
                    </Button>
                    <Button
                      type="button"
                      variant={formData.transfer_type === 'TRANSFER_OUT' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, transfer_type: 'TRANSFER_OUT' }))}
                      className={cn(
                        "gap-1.5 flex-1",
                        formData.transfer_type === 'TRANSFER_OUT' && "bg-red-500 hover:bg-red-600"
                      )}
                    >
                      <ArrowUpIcon className="size-4" />
                      Transfer Out
                    </Button>
                  </div>
                )}
                    </div>

              {/* Wallet Selection for Transfers */}
              <div className="space-y-3 pt-2 border-t">
                {/* Internal transfers: source and destination */}
                {formData.transfer_category === 'INTERNAL' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">From Wallet</Label>
                      <WalletSelector
                        key={`source-${walletSelectorKey}`}
                        value={formData.source_wallet_id}
                        onChange={(walletId) => setFormData(prev => ({ ...prev, source_wallet_id: walletId }))}
                        placeholder="Source wallet"
                        excludeWalletId={formData.destination_wallet_id}
                        onCreateWallet={() => setShowWalletForm(true)}
                        showBalance
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">To Wallet</Label>
                      <WalletSelector
                        key={`dest-${walletSelectorKey}`}
                        value={formData.destination_wallet_id}
                        onChange={(walletId) => setFormData(prev => ({ ...prev, destination_wallet_id: walletId }))}
                        placeholder="Destination wallet"
                        excludeWalletId={formData.source_wallet_id}
                        onCreateWallet={() => setShowWalletForm(true)}
                        showBalance
                      />
                    </div>
                  </div>
                )}

                {/* External IN: destination wallet only */}
                {formData.transfer_category === 'EXTERNAL' && formData.transfer_type === 'TRANSFER_IN' && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <WalletIcon className="size-4" />
                      Receiving Wallet
                    </Label>
                    <WalletSelector
                      key={`dest-ext-${walletSelectorKey}`}
                      value={formData.destination_wallet_id}
                      onChange={(walletId) => setFormData(prev => ({ ...prev, destination_wallet_id: walletId }))}
                      placeholder="Where BTC will arrive"
                      onCreateWallet={() => setShowWalletForm(true)}
                      showBalance
                    />
                    <p className="text-xs text-muted-foreground">
                      Select which wallet is receiving the Bitcoin
                    </p>
                  </div>
                )}

                {/* External OUT: source wallet only */}
                {formData.transfer_category === 'EXTERNAL' && formData.transfer_type === 'TRANSFER_OUT' && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <WalletIcon className="size-4" />
                      Sending Wallet
                    </Label>
                    <WalletSelector
                      key={`source-ext-${walletSelectorKey}`}
                      value={formData.source_wallet_id}
                      onChange={(walletId) => setFormData(prev => ({ ...prev, source_wallet_id: walletId }))}
                      placeholder="Where BTC is leaving from"
                      showExternal={false}
                      onCreateWallet={() => setShowWalletForm(true)}
                      showBalance
                    />
                    <p className="text-xs text-muted-foreground">
                      Select which wallet you are sending from
                    </p>
                  </div>
                )}
              </div>
                  </div>
                )}

          {/* Price/Amount Input (hidden for internal transfers) */}
          {(formData.type !== 'TRANSFER' || formData.transfer_category === 'EXTERNAL') && (
            <div className="space-y-3">
              {/* Input Mode Toggle (only for BUY/SELL) */}
              {formData.type !== 'TRANSFER' && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">I know the:</Label>
                  <div className="flex rounded-md border bg-muted/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => setInputMode('price')}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded transition-all",
                        inputMode === 'price' 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      BTC Price
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('fiat')}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded transition-all",
                        inputMode === 'fiat' 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Total Spent
                    </button>
              </div>
            </div>
          )}

              {/* Price per BTC Input (price mode or external transfers) */}
              {(inputMode === 'price' || formData.type === 'TRANSFER') && (
                <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                    <Label htmlFor="price_per_btc">
                      {formData.transfer_category === 'EXTERNAL' ? 'Reference Price' : 'Price per BTC'}
                </Label>
                    {currentBtcPrice && formData.type !== 'TRANSFER' && (
                      <button
                    type="button"
                    onClick={useCurrentPrice}
                        className="text-xs text-btc-500 hover:text-btc-600 hover:underline"
                  >
                        Use ${currentBtcPrice.toLocaleString()}
                      </button>
                )}
              </div>
              <Input
                id="price_per_btc"
                type="number"
                step="0.01"
                value={formData.price_per_btc}
                onChange={(e) => setFormData(prev => ({ ...prev, price_per_btc: e.target.value }))}
                placeholder="105000.00"
                    className="font-mono"
                    required={formData.type !== 'TRANSFER' && inputMode === 'price'}
              />
                </div>
              )}

              {/* Total Fiat Amount Input (fiat mode) */}
              {inputMode === 'fiat' && formData.type !== 'TRANSFER' && (
                <div className="space-y-1.5">
                  <Label htmlFor="total_fiat_amount">Total Amount Spent</Label>
                  <Input
                    id="total_fiat_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_fiat_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_fiat_amount: e.target.value }))}
                    placeholder="300.00"
                    className="font-mono"
                    required={inputMode === 'fiat'}
                  />
                  {parseFloat(formData.btc_amount) > 0 && parseFloat(formData.total_fiat_amount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ <span className="font-mono font-medium text-foreground">
                        {currencyInfo.symbol}{(parseFloat(formData.total_fiat_amount) / parseFloat(formData.btc_amount)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span> per BTC
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Two-column: Currency + Date */}
          <div className="grid grid-cols-2 gap-3">
            {/* Currency (hidden for internal transfers) */}
          {(formData.type !== 'TRANSFER' || formData.transfer_category === 'EXTERNAL') && (
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
              <CurrencySelector
                id="currency"
                value={formData.currency}
                currencies={allAvailableCurrencies}
                onChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                  placeholder="Select..."
                  searchPlaceholder="Search..."
              />
            </div>
          )}

          {/* Transaction Date */}
            <div className={cn("space-y-1.5", formData.type === 'TRANSFER' && formData.transfer_category === 'INTERNAL' && "col-span-2")}>
              <Label htmlFor="transaction_date">Date</Label>
            <DatePicker
              id="transaction_date"
              value={formData.transaction_date ? parseDateLocal(formData.transaction_date) : undefined}
              onChange={(date) => setFormData(prev => ({ 
                ...prev, 
                transaction_date: date ? formatDateLocal(date) : formatDateLocal(new Date())
              }))}
              placeholder="Select date"
            />
          </div>
          </div>

          {/* Cost Summary - Compact inline */}
          {formData.type !== 'TRANSFER' && totals.subtotal > 0 && (
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 border">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-mono font-bold text-btc-600 dark:text-btc-400">
                {currencyInfo.symbol}{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Fees Toggle (for BUY/SELL) */}
          {formData.type !== 'TRANSFER' && (
            <>
              {!showFees ? (
                <button
                  type="button"
                  onClick={() => setShowFees(true)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <PlusIcon className="size-4" />
                  Add fees
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fees">Fees</Label>
                    <button
                      type="button"
                      onClick={() => { setShowFees(false); setFormData(prev => ({ ...prev, fees: '0' })); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>
                  <Input
                    id="fees"
                    type="number"
                    step="0.01"
                    value={formData.fees}
                    onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
                    placeholder="0.00"
                    className="font-mono"
                  />
                </div>
              )}
            </>
          )}

          {/* Transfer-specific: Network Fees + Destination */}
          {formData.type === 'TRANSFER' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fees">Network Fees (BTC)</Label>
                <Input
                  id="fees"
                  type="number"
                  step="0.00000001"
                  value={formData.fees}
                  onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
                  placeholder="0.00001"
                  className="font-mono"
                />
              </div>
              {parseFloat(formData.btc_amount || '0') > 0 && parseFloat(formData.fees || '0') > 0 && (
                <p className="text-xs text-muted-foreground">
                  Arrives: <span className="font-mono font-medium text-foreground">{(parseFloat(formData.btc_amount) - parseFloat(formData.fees)).toFixed(8)} BTC</span>
                </p>
              )}
            </div>
          )}

          {/* More Options Toggle */}
          <button
            type="button"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", showMoreOptions && "rotate-180")} />
            {showMoreOptions ? 'Hide options' : 'More options'}
            {(formData.notes || formData.tags || (formData.type === 'TRANSFER' && formData.destination_address)) && !showMoreOptions && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">has data</span>
            )}
          </button>

          {/* Collapsible: Notes, Tags, Destination */}
          {showMoreOptions && (
            <div className="space-y-3 pt-1">
              {/* Destination Address (only for TRANSFER) */}
              {formData.type === 'TRANSFER' && (
                <div className="space-y-1.5">
                  <Label htmlFor="destination_address">Destination Address</Label>
                  <Input
                    id="destination_address"
                    type="text"
                    value={formData.destination_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination_address: e.target.value }))}
                    placeholder="bc1q... (optional)"
                    className="font-mono text-sm"
                  />
                </div>
              )}

          {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={2}
              className="resize-none"
            />
          </div>

          {/* Tags */}
              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags</Label>
            <TagsInput
              id="tags"
              value={formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
              onChange={(tags) => setFormData(prev => ({ ...prev, tags: tags.join(', ') }))}
                  placeholder="Type and press Enter"
            />
          </div>
            </div>
          )}
          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-btc-500 hover:bg-btc-600">
              {editingTransaction ? 'Update' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Wallet Creation Modal */}
      <WalletForm
        isOpen={showWalletForm}
        onClose={() => setShowWalletForm(false)}
        onSuccess={() => {
          setShowWalletForm(false);
          // Increment key to force WalletSelector to refresh
          setWalletSelectorKey(prev => prev + 1);
        }}
      />
    </Dialog>
  );
} 