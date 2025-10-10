'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ThemedButton } from './ui/ThemeProvider';
import { SupportedCurrency } from '@/lib/types';
import currencies from '@/data/currencies.json';

interface TransactionFormData {
  type: 'BUY' | 'SELL';
  btc_amount: string;
  price_per_btc: string;
  currency: string;
  fees: string;
  transaction_date: string;
  notes: string;
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
  transaction_date: new Date().toISOString().split('T')[0],
  notes: ''
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
      transaction_date: editingTransaction.transaction_date,
      notes: editingTransaction.notes
    } : initialFormData
  );
  
  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedCurrency[]>(['USD', 'EUR', 'PLN', 'GBP']);
  const [customCurrencies, setCustomCurrencies] = useState<any[]>([]);
  const [allAvailableCurrencies, setAllAvailableCurrencies] = useState<Array<{code: string, name: string, symbol: string}>>([]);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencySuggestions, setShowCurrencySuggestions] = useState(false);
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Helper function to get currency info from currencies.json
  const getCurrencyInfo = (code: string) => {
    const currency = currencies.find(c => c.alpha === code);
    return currency ? { name: currency.name, symbol: currency.symbol } : { name: code, symbol: code };
  };

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
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
      setCurrencySearch('');
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

  // Filter currencies based on search
  const filteredCurrencies = allAvailableCurrencies.filter(currency => {
    const searchLower = currencySearch.toLowerCase();
    return (
      currency.code.toLowerCase().includes(searchLower) ||
      currency.name.toLowerCase().includes(searchLower)
    );
  }).slice(0, 6); // Limit to 6 suggestions

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

  if (!isOpen) return null;

  const totals = calculateTotal();
  const sats = btcToSats(formData.btc_amount);
  const currencyInfo = getCurrencyInfo(formData.currency);

  // Use portal to render modal at document root level (outside sidebar)
  const modalContent = (
    <div 
      className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-200 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['BUY', 'SELL'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type }))}
                  className={`relative py-2.5 px-4 rounded-lg font-medium transition-colors ${
                    formData.type === type
                      ? type === 'BUY' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* BTC Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              BTC Amount
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.00000001"
                value={formData.btc_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, btc_amount: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-bitcoin focus:border-bitcoin transition-all font-mono"
                placeholder="0.00000000"
                required
              />
              {formData.btc_amount && parseFloat(formData.btc_amount) > 0 && (
                <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 font-mono">
                  = {sats.toLocaleString()} sats
                </div>
              )}
            </div>
          </div>

          {/* Price per BTC */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Price per BTC
              </label>
              {currentBtcPrice && (
                <button
                  type="button"
                  onClick={useCurrentPrice}
                  className="text-xs text-bitcoin hover:text-bitcoin-dark font-medium transition-colors"
                >
                  Use current: ${currentBtcPrice.toLocaleString()}
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              value={formData.price_per_btc}
              onChange={(e) => setFormData(prev => ({ ...prev, price_per_btc: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-bitcoin focus:border-bitcoin transition-all font-mono"
              placeholder="105000.00"
              required
            />
          </div>

          {/* Currency */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Currency
            </label>
            <input
              type="text"
              value={currencySearch}
              onChange={(e) => {
                setCurrencySearch(e.target.value);
                setShowCurrencySuggestions(true);
              }}
              onFocus={() => {
                if (!currencySearch) {
                  setCurrencySearch('');
                }
                setShowCurrencySuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowCurrencySuggestions(false), 200)}
              placeholder={formData.currency ? `${currencyInfo.symbol} ${formData.currency}` : "Type to search currencies..."}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-bitcoin focus:border-bitcoin transition-all"
            />
            
            {/* Suggestions dropdown */}
            {showCurrencySuggestions && filteredCurrencies.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCurrencies.map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, currency: currency.code }));
                      setCurrencySearch('');
                      setShowCurrencySuggestions(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {currency.symbol} {currency.code}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {currency.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Show current selection when not searching */}
            {!currencySearch && formData.currency && (
              <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Selected: {currencyInfo.symbol} {formData.currency} - {currencyInfo.name}
              </div>
            )}
          </div>

          {/* Fees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fees
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.fees}
              onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-bitcoin focus:border-bitcoin transition-all font-mono"
              placeholder="0.00"
            />
          </div>

          {/* Cost Breakdown */}
          {totals.subtotal > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2 border border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Cost Breakdown
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {currencyInfo.symbol}{totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {totals.fees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Fees</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {currencyInfo.symbol}{totals.fees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-gray-100">Total Cost</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {currencyInfo.symbol}{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Transaction Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transaction Date
            </label>
            <input
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData(prev => ({ ...prev, transaction_date: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-bitcoin focus:border-bitcoin transition-all"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-bitcoin focus:border-bitcoin transition-all resize-none"
              placeholder="Add any notes about this transaction..."
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex space-x-3 pt-6">
            <ThemedButton
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </ThemedButton>
            <ThemedButton
              type="submit"
              variant="primary"
              className="flex-1 bg-bitcoin hover:bg-bitcoin-dark"
            >
              {editingTransaction ? 'Update' : 'Add Transaction'}
            </ThemedButton>
          </div>
        </form>
      </div>
    </div>
  );

  // Render modal content using portal to document.body
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
} 