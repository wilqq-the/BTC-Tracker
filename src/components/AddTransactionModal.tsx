'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { SupportedCurrency } from '@/lib/types';
import currencies from '@/data/currencies.json';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
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
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WalletLabel } from '@/components/ui/wallet-type-icon';
import { DEFAULT_TRANSFER_FEE_MODE, type TransferFeeMode } from '@/lib/transfer-fees';
import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/theme';
import { useBtcUnit } from '@/hooks/use-btc-unit';

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
  transfer_fee_mode?: TransferFeeMode; // How a BTC network fee was paid (#168)
  destination_address?: string;
  from_wallet_id?: number | null;
  to_wallet_id?: number | null;
}

interface WalletOption {
  id: number;
  name: string;
  type: 'cold' | 'hot';
  emoji: string | null;
  btcBalance: number;
}

type InputMode = 'price' | 'fiat';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingTransaction?: any;
  /** Preselect BUY / SELL / TRANSFER when opening for a new transaction */
  initialType?: 'BUY' | 'SELL' | 'TRANSFER';
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
  transfer_fee_mode: DEFAULT_TRANSFER_FEE_MODE,
  destination_address: '',
  from_wallet_id: null,
  to_wallet_id: null,
};

export default function AddTransactionModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  editingTransaction,
  initialType,
}: AddTransactionModalProps) {
  const { formatBtc } = useBtcUnit();
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
      // Transfers saved before fee modes existed took the fee from the amount
      transfer_fee_mode: editingTransaction.transfer_fee_mode || 'DEDUCTED',
      destination_address: editingTransaction.destination_address || '',
      from_wallet_id: editingTransaction.from_wallet_id || null,
      to_wallet_id: editingTransaction.to_wallet_id || null,
    } : initialFormData
  );
  
  // Input mode: 'price' = enter BTC price, 'fiat' = enter total fiat spent
  const [inputMode, setInputMode] = useState<InputMode>('price');
  
  // UI state for collapsible sections
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showFees, setShowFees] = useState(false);
  
  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedCurrency[]>(['USD', 'EUR', 'PLN', 'GBP']);
  const [customCurrencies, setCustomCurrencies] = useState<any[]>([]);
  const [allAvailableCurrencies, setAllAvailableCurrencies] = useState<Array<{code: string, name: string, symbol: string}>>([]);
  // Current BTC price is always USD; usdRate converts it into the form's currency
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number | null>(null);
  const [usdRate, setUsdRate] = useState<{ currency: string; rate: number } | null>({ currency: 'USD', rate: 1 });
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  
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
        transfer_fee_mode: editingTransaction.transfer_fee_mode || 'DEDUCTED',
        destination_address: editingTransaction.destination_address || '',
        from_wallet_id: editingTransaction.from_wallet_id || null,
        to_wallet_id: editingTransaction.to_wallet_id || null,
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

        // Load wallets
        const walletsResponse = await fetch('/api/wallets');
        const walletsResult = await walletsResponse.json();
        if (walletsResult.success && walletsResult.data) {
          setWallets(walletsResult.data);
          // Pre-select the first hot wallet for new BUY transactions
          if (!editingTransaction) {
            const defaultHotWallet = walletsResult.data.find((w: WalletOption) => w.type === 'hot');
            if (defaultHotWallet) {
              setFormData(prev => ({ ...prev, to_wallet_id: defaultHotWallet.id }));
            }
          }
        }
        
        let enabledCurrencies: SupportedCurrency[] = ['USD', 'EUR', 'PLN', 'GBP']; // fallback
        let customCurrencyList: any[] = [];
        
        if (settingsResult.success && settingsResult.data?.currency?.supportedCurrencies) {
          enabledCurrencies = settingsResult.data.currency.supportedCurrencies;
          console.log('Loaded enabled currencies from settings:', enabledCurrencies);
        }

        // Set default currency to secondary (display) currency for new transactions
        if (!editingTransaction && settingsResult.success && settingsResult.data?.currency?.secondaryCurrency) {
          setFormData(prev => ({ ...prev, currency: settingsResult.data.currency.secondaryCurrency }));
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

  // Quick actions open the modal on a specific type
  useEffect(() => {
    if (isOpen && !editingTransaction && initialType) {
      setFormData(prev => ({ ...prev, type: initialType }));
    }
  }, [isOpen, initialType, editingTransaction]);

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

  // Fetch the USD -> selected currency rate whenever the currency changes
  useEffect(() => {
    if (!isOpen) return;
    const currency = formData.currency;
    if (currency === 'USD') {
      setUsdRate({ currency, rate: 1 });
      return;
    }
    let cancelled = false;
    setUsdRate(null);
    (async () => {
      try {
        const response = await fetch(`/api/exchange-rates?from=USD&to=${encodeURIComponent(currency)}`);
        const result = await response.json();
        if (!cancelled && typeof result.rate === 'number' && result.rate > 0) {
          setUsdRate({ currency, rate: result.rate });
        }
      } catch (error) {
        console.error('Error loading exchange rate:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, formData.currency]);

  // Today's BTC price in the selected currency, rounded to cents (null until the rate is known)
  const currentPriceInCurrency =
    currentBtcPrice && usdRate && usdRate.currency === formData.currency
      ? Math.round(currentBtcPrice * usdRate.rate * 100) / 100
      : null;

  // Use current BTC price
  const useCurrentPrice = () => {
    if (currentPriceInCurrency) {
      setFormData(prev => ({ ...prev, price_per_btc: currentPriceInCurrency.toFixed(2) }));
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
        toast({ title: 'Error saving transaction', description: result.error || result.message, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast({ title: 'Failed to save transaction', description: 'Please try again.', variant: 'destructive' });
    }
  };


  const totals = calculateTotal();
  const sats = btcToSats(formData.btc_amount);
  const isInternalTransfer = formData.type === 'TRANSFER' && formData.transfer_category === 'INTERNAL';

  const selectType = (type: 'BUY' | 'SELL' | 'TRANSFER') => {
    const defaultHotWallet = wallets.find(w => w.type === 'hot');
    setFormData(prev => ({
      ...prev,
      type,
      fees_currency: type === 'TRANSFER' ? 'BTC' : prev.fees_currency,
      from_wallet_id: type === 'SELL' && defaultHotWallet ? defaultHotWallet.id : (type === 'TRANSFER' ? prev.from_wallet_id : null),
      to_wallet_id: type === 'BUY' && defaultHotWallet ? defaultHotWallet.id : (type === 'TRANSFER' ? prev.to_wallet_id : null),
    }));
  };

  // Buttons without a type default to "submit" inside a form: SegmentedControl's
  // options would submit (and trigger validation) on click, and pressing Enter
  // in an input would "click" the first option. Make every untyped button plain.
  const formRef = useRef<HTMLFormElement>(null);
  useLayoutEffect(() => {
    formRef.current?.querySelectorAll('button:not([type])').forEach((button) => {
      (button as HTMLButtonElement).type = 'button';
    });
  });

  const walletItems = (disabledId?: number | null) =>
    wallets.map(w => (
      <SelectItem key={w.id} value={w.id.toString()} disabled={disabledId != null && w.id === disabledId}>
        <WalletLabel type={w.type} name={w.name} />
      </SelectItem>
    ));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-[17px] font-bold tracking-tight">
            {editingTransaction ? 'Edit transaction' : 'Add transaction'}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 overflow-y-auto flex-1 px-1 pb-1">
          {/* Transaction type */}
          <SegmentedControl
            aria-label="Transaction type"
            options={[
              { label: 'Buy', value: 'BUY' },
              { label: 'Sell', value: 'SELL' },
              { label: 'Transfer', value: 'TRANSFER' },
            ]}
            value={formData.type}
            onChange={selectType}
          />

          {/* BTC amount */}
          <div className="space-y-1.5">
            <Label htmlFor="btc_amount">BTC amount</Label>
            <Input
              id="btc_amount"
              type="number"
              inputMode="decimal"
              step="0.00000001"
              value={formData.btc_amount}
              onChange={(e) => setFormData(prev => ({ ...prev, btc_amount: e.target.value }))}
              placeholder="0.00000000"
              className="tabular-nums"
              required
            />
            {formData.btc_amount && parseFloat(formData.btc_amount) > 0 && (
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {sats.toLocaleString()} sats
              </p>
            )}
          </div>

          {/* Transfer type (only for TRANSFER) */}
          {formData.type === 'TRANSFER' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Transfer type</Label>
                <div>
                  <SegmentedControl
                    aria-label="Transfer type"
                    size="sm"
                    options={[
                      { label: 'Between my wallets', value: 'INTERNAL' },
                      { label: 'In or out of my stack', value: 'EXTERNAL' },
                    ]}
                    value={formData.transfer_category || 'INTERNAL'}
                    onChange={(category) => setFormData(prev => ({
                      ...prev,
                      transfer_category: category,
                      transfer_type: category === 'INTERNAL' ? 'TO_COLD_WALLET' : 'TRANSFER_IN',
                    }))}
                  />
                </div>
              </div>

              {/* Wallet selectors */}
              {wallets.length > 0 ? (
                <div className="space-y-3">
                  {formData.transfer_category === 'INTERNAL' ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>From wallet</Label>
                        <Select
                          value={formData.from_wallet_id?.toString() || ''}
                          onValueChange={v => {
                            const fromId = v ? parseInt(v) : null;
                            const toWallet = wallets.find(w => w.id === formData.to_wallet_id);
                            const fromWallet = wallets.find(w => w.id === fromId);
                            // Derive transfer_type from wallet types
                            let ttype: TransactionFormData['transfer_type'] = 'BETWEEN_WALLETS';
                            if (fromWallet?.type === 'cold') ttype = 'FROM_COLD_WALLET';
                            else if (toWallet?.type === 'cold') ttype = 'TO_COLD_WALLET';
                            setFormData(prev => ({ ...prev, from_wallet_id: fromId, transfer_type: ttype }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>{walletItems(formData.to_wallet_id)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>To wallet</Label>
                        <Select
                          value={formData.to_wallet_id?.toString() || ''}
                          onValueChange={v => {
                            const toId = v ? parseInt(v) : null;
                            const fromWallet = wallets.find(w => w.id === formData.from_wallet_id);
                            const toWallet = wallets.find(w => w.id === toId);
                            let ttype: TransactionFormData['transfer_type'] = 'BETWEEN_WALLETS';
                            if (toWallet?.type === 'cold') ttype = 'TO_COLD_WALLET';
                            else if (fromWallet?.type === 'cold') ttype = 'FROM_COLD_WALLET';
                            setFormData(prev => ({ ...prev, to_wallet_id: toId, transfer_type: ttype }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select destination" />
                          </SelectTrigger>
                          <SelectContent>{walletItems(formData.from_wallet_id)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <SegmentedControl
                        aria-label="Direction"
                        size="sm"
                        options={[
                          { label: 'Transfer in', value: 'TRANSFER_IN' },
                          { label: 'Transfer out', value: 'TRANSFER_OUT' },
                        ]}
                        value={formData.transfer_type === 'TRANSFER_OUT' ? 'TRANSFER_OUT' : 'TRANSFER_IN'}
                        onChange={(direction) => setFormData(prev => (
                          direction === 'TRANSFER_IN'
                            ? { ...prev, transfer_type: 'TRANSFER_IN', from_wallet_id: null }
                            : { ...prev, transfer_type: 'TRANSFER_OUT', to_wallet_id: null }
                        ))}
                      />
                      {formData.transfer_type === 'TRANSFER_IN' && (
                        <div className="space-y-1.5">
                          <Label>To wallet</Label>
                          <Select
                            value={formData.to_wallet_id?.toString() || ''}
                            onValueChange={v => setFormData(prev => ({ ...prev, to_wallet_id: v ? parseInt(v) : null }))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select destination wallet" />
                            </SelectTrigger>
                            <SelectContent>{walletItems()}</SelectContent>
                          </Select>
                        </div>
                      )}
                      {formData.transfer_type === 'TRANSFER_OUT' && (
                        <div className="space-y-1.5">
                          <Label>From wallet</Label>
                          <Select
                            value={formData.from_wallet_id?.toString() || ''}
                            onValueChange={v => setFormData(prev => ({ ...prev, from_wallet_id: v ? parseInt(v) : null }))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select source wallet" />
                            </SelectTrigger>
                            <SelectContent>{walletItems()}</SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Fallback for users with no wallets yet: direction choice
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <div>
                    {formData.transfer_category === 'INTERNAL' ? (
                      <SegmentedControl
                        aria-label="Direction"
                        size="sm"
                        options={[
                          { label: 'To cold storage', value: 'TO_COLD_WALLET' },
                          { label: 'From cold storage', value: 'FROM_COLD_WALLET' },
                          { label: 'Between wallets', value: 'BETWEEN_WALLETS' },
                        ]}
                        value={
                          formData.transfer_type === 'FROM_COLD_WALLET' || formData.transfer_type === 'BETWEEN_WALLETS'
                            ? formData.transfer_type
                            : 'TO_COLD_WALLET'
                        }
                        onChange={(direction) => setFormData(prev => ({ ...prev, transfer_type: direction }))}
                      />
                    ) : (
                      <SegmentedControl
                        aria-label="Direction"
                        size="sm"
                        options={[
                          { label: 'Transfer in', value: 'TRANSFER_IN' },
                          { label: 'Transfer out', value: 'TRANSFER_OUT' },
                        ]}
                        value={formData.transfer_type === 'TRANSFER_OUT' ? 'TRANSFER_OUT' : 'TRANSFER_IN'}
                        onChange={(direction) => setFormData(prev => ({ ...prev, transfer_type: direction }))}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Price / amount input (hidden for internal transfers) */}
          {!isInternalTransfer && (
            <div className="space-y-3">
              {/* Input mode toggle (only for BUY/SELL) */}
              {formData.type !== 'TRANSFER' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted-foreground">I know the</span>
                  <SegmentedControl<InputMode>
                    aria-label="Enter price or total"
                    size="sm"
                    options={[
                      { label: 'Price per BTC', value: 'price' },
                      { label: formData.type === 'SELL' ? 'Total received' : 'Total spent', value: 'fiat' },
                    ]}
                    value={inputMode}
                    onChange={setInputMode}
                  />
                </div>
              )}

              {/* Price per BTC input (price mode or external transfers) */}
              {(inputMode === 'price' || formData.type === 'TRANSFER') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="price_per_btc">
                      {formData.type === 'TRANSFER' ? 'Reference price' : 'Price per BTC'}
                    </Label>
                    {currentPriceInCurrency !== null && (
                      <button
                        type="button"
                        onClick={useCurrentPrice}
                        className="rounded-full text-[13px] font-semibold text-primary-strong tabular-nums hover:underline"
                      >
                        Use {formatCurrency(currentPriceInCurrency, formData.currency)}
                      </button>
                    )}
                  </div>
                  <Input
                    id="price_per_btc"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.price_per_btc}
                    onChange={(e) => setFormData(prev => ({ ...prev, price_per_btc: e.target.value }))}
                    placeholder="105000.00"
                    className="tabular-nums"
                    required={formData.type !== 'TRANSFER' && inputMode === 'price'}
                  />
                </div>
              )}

              {/* Total fiat amount input (fiat mode) */}
              {inputMode === 'fiat' && formData.type !== 'TRANSFER' && (
                <div className="space-y-1.5">
                  <Label htmlFor="total_fiat_amount">{formData.type === 'SELL' ? 'Total received' : 'Total spent'}</Label>
                  <Input
                    id="total_fiat_amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.total_fiat_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_fiat_amount: e.target.value }))}
                    placeholder="300.00"
                    className="tabular-nums"
                    required={inputMode === 'fiat'}
                  />
                  {parseFloat(formData.btc_amount) > 0 && parseFloat(formData.total_fiat_amount) > 0 && (
                    <p className="text-[13px] text-muted-foreground">
                      That&apos;s{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatCurrency(parseFloat(formData.total_fiat_amount) / parseFloat(formData.btc_amount), formData.currency)}
                      </span>{' '}
                      per BTC
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Currency + date */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!isInternalTransfer && (
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

            <div className={cn('space-y-1.5', isInternalTransfer && 'sm:col-span-2')}>
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

          {/* Wallet selector for BUY/SELL */}
          {formData.type !== 'TRANSFER' && wallets.length > 0 && (
            <div className="space-y-1.5">
              <Label>{formData.type === 'BUY' ? 'To wallet' : 'From wallet'}</Label>
              <Select
                value={
                  formData.type === 'BUY'
                    ? (formData.to_wallet_id?.toString() || '')
                    : (formData.from_wallet_id?.toString() || '')
                }
                onValueChange={(v) => {
                  const walletId = v ? parseInt(v) : null;
                  if (formData.type === 'BUY') {
                    setFormData(prev => ({ ...prev, to_wallet_id: walletId }));
                  } else {
                    setFormData(prev => ({ ...prev, from_wallet_id: walletId }));
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={formData.type === 'BUY' ? 'Select destination wallet' : 'Select source wallet'} />
                </SelectTrigger>
                <SelectContent>{walletItems()}</SelectContent>
              </Select>
            </div>
          )}

          {/* Cost summary */}
          {formData.type !== 'TRANSFER' && totals.subtotal > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
              <span className="text-[13px] font-semibold text-muted-foreground">
                {totals.fees > 0 ? 'Total with fees' : 'Total'}
              </span>
              <span className="text-[15px] font-bold tabular-nums">
                {formatCurrency(totals.total, formData.currency)}
              </span>
            </div>
          )}

          {/* Fees toggle (for BUY/SELL) */}
          {formData.type !== 'TRANSFER' && (
            <>
              {!showFees ? (
                <button
                  type="button"
                  onClick={() => setShowFees(true)}
                  className="flex items-center gap-1.5 rounded-full text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
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
                      className="rounded-full text-[13px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Remove fees
                    </button>
                  </div>
                  <Input
                    id="fees"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.fees}
                    onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
                    placeholder="0.00"
                    className="tabular-nums"
                  />
                </div>
              )}
            </>
          )}

          {/* Transfer-specific: network fees */}
          {formData.type === 'TRANSFER' && (
            <div className="space-y-1.5">
              <Label htmlFor="fees">Network fee (BTC)</Label>
              <Input
                id="fees"
                type="number"
                inputMode="decimal"
                step="0.00000001"
                value={formData.fees}
                onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
                placeholder="0.00001"
                className="tabular-nums"
              />
              {parseFloat(formData.btc_amount || '0') > 0 && parseFloat(formData.fees || '0') > 0 && (() => {
                const amount = parseFloat(formData.btc_amount);
                const fee = parseFloat(formData.fees);
                // Incoming transfers: the sender pays; BTC leaves one of your
                // wallets otherwise, so ask how the fee was paid (#168)
                const leavesYourWallet = formData.transfer_type !== 'TRANSFER_IN';
                const onTop = leavesYourWallet && formData.transfer_fee_mode === 'ON_TOP';
                return (
                  <div className="space-y-2 pt-1">
                    {leavesYourWallet && (
                      <SegmentedControl<TransferFeeMode>
                        size="sm"
                        aria-label="How the network fee was paid"
                        options={[
                          { label: 'Paid on top', value: 'ON_TOP' },
                          { label: 'Taken from amount', value: 'DEDUCTED' },
                        ]}
                        value={formData.transfer_fee_mode ?? DEFAULT_TRANSFER_FEE_MODE}
                        onChange={(mode) => setFormData(prev => ({ ...prev, transfer_fee_mode: mode }))}
                      />
                    )}
                    <p className="text-[13px] text-muted-foreground">
                      {leavesYourWallet && (
                        <>
                          Leaves:{' '}
                          <span className="font-semibold text-foreground tabular-nums">
                            {formatBtc(onTop ? amount + fee : amount)}
                          </span>
                          {' · '}
                        </>
                      )}
                      Arrives:{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatBtc(onTop ? amount : amount - fee)}
                      </span>
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* More options toggle */}
          <button
            type="button"
            aria-expanded={showMoreOptions}
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="flex items-center gap-1.5 rounded-full text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDownIcon className={cn('size-4 transition-transform', showMoreOptions && 'rotate-180')} />
            {showMoreOptions ? 'Fewer options' : 'More options'}
            {(formData.notes || formData.tags || (formData.type === 'TRANSFER' && formData.destination_address)) && !showMoreOptions && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">Filled in</span>
            )}
          </button>

          {/* Collapsible: notes, tags, destination */}
          {showMoreOptions && (
            <div className="space-y-3 pt-1">
              {formData.type === 'TRANSFER' && (
                <div className="space-y-1.5">
                  <Label htmlFor="destination_address">Destination address</Label>
                  <Input
                    id="destination_address"
                    type="text"
                    value={formData.destination_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination_address: e.target.value }))}
                    placeholder="bc1q... (optional)"
                    className="text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional"
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags</Label>
                <TagsInput
                  id="tags"
                  value={formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
                  onChange={(tags) => setFormData(prev => ({ ...prev, tags: tags.join(', ') }))}
                  placeholder="Type a tag and press Enter"
                />
              </div>
            </div>
          )}
          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-full font-semibold">
              {editingTransaction ? 'Save changes' : 'Add transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
