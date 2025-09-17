'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, useTheme } from './ui/ThemeProvider';
import { CurrencySettings, PriceDataSettings, DisplaySettings, NotificationSettings, MainCurrency, SupportedCurrency } from '@/lib/types';
import { ThemedButton } from './ui/ThemeProvider';
import { CustomCurrency } from '@/lib/custom-currency-service';
import { CurrencySymbolService } from '@/lib/currency-symbol-service';
import UserAvatar from './UserAvatar';
import AvatarUploadModal from './AvatarUploadModal';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

interface SettingsPanelProps<T> {
  settings: T;
  onUpdate: (updates: Partial<T>) => void;
  saving: boolean;
}

// Currency Settings Panel
export function CurrencySettingsPanel({ 
  settings, 
  onUpdate, 
  saving 
}: { 
  settings: CurrencySettings; 
  onUpdate: (updates: Partial<CurrencySettings>) => void;
  saving: boolean;
}) {
  const [exchangeRateStatus, setExchangeRateStatus] = useState<string>('');
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [showAllRates, setShowAllRates] = useState(false);
  const [customCurrencies, setCustomCurrencies] = useState<CustomCurrency[]>([]);
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [newCurrencyForm, setNewCurrencyForm] = useState({
    code: '',
    name: '',
    symbol: ''
  });
  const [currencyStatus, setCurrencyStatus] = useState<string>('');

  const allCurrencies: Array<{code: SupportedCurrency, name: string, symbol: string}> = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  ];

  // Main currencies (only USD and EUR allowed for calculations)
  const mainCurrencies: Array<{code: MainCurrency, name: string, symbol: string}> = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ];

  // Load exchange rates and custom currencies on component mount
  useEffect(() => {
    loadExchangeRates();
    loadCustomCurrencies();
  }, []);

  const loadExchangeRates = async () => {
    try {
      const response = await fetch('/api/exchange-rates');
      if (response.ok) {
        const data = await response.json();
        setExchangeRates(data.rates || []);
      }
    } catch (error) {
      console.error('Error loading exchange rates:', error);
    }
  };

  const updateExchangeRates = async () => {
    setIsUpdatingRates(true);
    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update' })
      });
      
      if (response.ok) {
        setExchangeRateStatus('Exchange rates updated successfully!');
        await loadExchangeRates();
      } else {
        setExchangeRateStatus('Failed to update exchange rates');
      }
    } catch (error) {
      setExchangeRateStatus('Error updating exchange rates');
    } finally {
      setIsUpdatingRates(false);
      setTimeout(() => setExchangeRateStatus(''), 3000);
    }
  };

  const loadCustomCurrencies = async () => {
    try {
      const response = await fetch('/api/custom-currencies');
      if (response.ok) {
        const data = await response.json();
        setCustomCurrencies(data.data || []);
      }
    } catch (error) {
      console.error('Error loading custom currencies:', error);
    }
  };

  const addCustomCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCurrencyForm.code || !newCurrencyForm.name || !newCurrencyForm.symbol) {
      setCurrencyStatus('All fields are required');
      setTimeout(() => setCurrencyStatus(''), 3000);
      return;
    }

    try {
      const response = await fetch('/api/custom-currencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCurrencyForm)
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrencyStatus(`${result.data.code} added successfully! Updating exchange rates...`);
        setNewCurrencyForm({ code: '', name: '', symbol: '' });
        setShowAddCurrency(false);
        await loadCustomCurrencies();
        
        // Automatically update exchange rates to include the new custom currency
        try {
          await updateExchangeRates();
          setCurrencyStatus(`${result.data.code} added successfully! Exchange rates updated.`);
        } catch (error) {
          setCurrencyStatus(`${result.data.code} added successfully! Note: Exchange rate update failed.`);
        }
      } else {
        setCurrencyStatus(result.error || 'Failed to add currency');
      }
    } catch (error) {
      setCurrencyStatus('Error adding currency');
    } finally {
      setTimeout(() => setCurrencyStatus(''), 3000);
    }
  };



  const deleteCustomCurrency = async (id: number, code: string) => {
    if (confirm(`Are you sure you want to delete custom currency ${code}?`)) {
      try {
        const response = await fetch(`/api/custom-currencies/${id}`, {
          method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
          setCurrencyStatus(`${code} deleted successfully`);
          await loadCustomCurrencies();
        } else {
          setCurrencyStatus(result.error || 'Failed to delete currency');
        }
      } catch (error) {
        setCurrencyStatus('Error deleting currency');
      } finally {
        setTimeout(() => setCurrencyStatus(''), 3000);
      }
    }
  };

  const currentSupported = settings.supportedCurrencies || [];
  const recentRates = exchangeRates.slice(0, 6); // Show first 6 rates

  // Ensure main and secondary currencies are always in supported list
  const ensureRequiredCurrencies = () => {
    const required = [settings.mainCurrency, settings.secondaryCurrency];
    const allAvailableCodes = [
      ...allCurrencies.map(c => c.code),
      ...customCurrencies.map(c => c.code)
    ];
    
    // Only add to supported if the currency actually exists (built-in or custom)
    const validRequired = required.filter(curr => allAvailableCodes.includes(curr));
    const missing = validRequired.filter(curr => !currentSupported.includes(curr));
    
    if (missing.length > 0) {
      const updatedSupported = [...currentSupported, ...missing];
      onUpdate({ supportedCurrencies: updatedSupported });
    }
  };

  // Auto-fix supported currencies on component mount and when custom currencies change
  useEffect(() => {
    ensureRequiredCurrencies();
  }, [settings.mainCurrency, settings.secondaryCurrency, customCurrencies]);

  // Get available currencies for dropdowns (major currencies should always be available)
  const getAvailableCurrencies = () => {
    const majorCurrencies = ['USD', 'EUR', 'PLN', 'GBP'];
    const availableCodes = Array.from(new Set([...currentSupported, ...majorCurrencies]));
    
    // Include built-in currencies
    const builtInCurrencies = allCurrencies.filter(c => availableCodes.includes(c.code));
    
    // Include custom currencies that are active
    const customCurrencyOptions = customCurrencies.map(c => ({
      code: c.code as any, // Type assertion since custom currencies can be any valid currency code
      name: c.name,
      symbol: c.symbol
    }));
    
    // Combine and deduplicate
    const allOptions = [...builtInCurrencies, ...customCurrencyOptions];
    const uniqueOptions = allOptions.filter((currency, index, self) => 
      index === self.findIndex(c => c.code === currency.code)
    );
    
    return uniqueOptions;
  };

  return (
    <ThemedCard>
      <h2 className="text-xl font-semibold text-btc-text-primary mb-6">
        Currency Settings
      </h2>
      
      <div className="space-y-6">
        {/* Main Currency */}
        <div>
          <label className="block text-sm font-medium text-btc-text-secondary mb-2">
            Main Currency (for calculations)
          </label>
          <select
            value={settings.mainCurrency}
            onChange={(e) => onUpdate({ mainCurrency: e.target.value as MainCurrency })}
            className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded-md text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange focus:border-transparent"
            disabled={saving}
          >
            {mainCurrencies.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.name} ({currency.code})
              </option>
            ))}
          </select>
          <ThemedText variant="muted" size="sm" className="mt-1">
            All calculations and database storage will use this currency. Only USD and EUR are supported for main currency.
          </ThemedText>
        </div>

        {/* Secondary Currency */}
        <div>
          <label className="block text-sm font-medium text-btc-text-secondary mb-2">
            Secondary Currency (for display)
          </label>
          <select
            value={settings.secondaryCurrency}
            onChange={(e) => onUpdate({ secondaryCurrency: e.target.value as SupportedCurrency })}
            className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded-md text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange focus:border-transparent"
            disabled={saving}
          >
            {getAvailableCurrencies().map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.name} ({currency.code})
              </option>
            ))}
          </select>
          <ThemedText variant="muted" size="sm" className="mt-1">
            Values will be converted and shown in this currency alongside main currency
          </ThemedText>
        </div>

        {/* Supported Currencies */}
        <div>
          <label className="block text-sm font-medium text-btc-text-secondary mb-3">
            Supported Currencies
          </label>
          <div className="grid grid-cols-2 gap-2">
            {allCurrencies.map((currency) => {
              const isSupported = currentSupported.includes(currency.code);
              const isRequired = currency.code === settings.mainCurrency || currency.code === settings.secondaryCurrency;
              
              return (
                <label key={currency.code} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSupported}
                    onChange={() => {
                      const newSupported = isSupported 
                        ? currentSupported.filter(c => c !== currency.code) 
                        : [...currentSupported, currency.code];
                      onUpdate({ supportedCurrencies: newSupported });
                    }}
                    disabled={isRequired || saving}
                    className="w-4 h-4 text-btc-orange bg-btc-bg-tertiary border-btc-border-primary rounded focus:ring-btc-orange disabled:opacity-50"
                  />
                  <span className={`text-sm ${isSupported ? 'text-btc-text-primary' : 'text-btc-text-muted'}`}>
                    {currency.symbol} {currency.code}
                  </span>
                  {isRequired && (
                    <span className="text-xs text-btc-orange">(required)</span>
                  )}
                </label>
              );
            })}
          </div>
          <ThemedText variant="muted" size="sm" className="mt-2">
            Select currencies you want to use for transactions and display
          </ThemedText>
        </div>

        {/* Custom Currencies */}
        <div className="pt-6 border-t border-btc-border-secondary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-btc-text-secondary">Custom Currencies</h3>
            <ThemedButton
              onClick={() => setShowAddCurrency(!showAddCurrency)}
              variant="secondary"
              size="sm"
              disabled={saving}
            >
              {showAddCurrency ? 'Cancel' : '+ Add Currency'}
            </ThemedButton>
          </div>

          <div className="mb-4 space-y-2">
            <ThemedText variant="muted" size="sm">
              Add custom currencies not available in the built-in list (e.g., INR, BRL, KRW, USDT)
            </ThemedText>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <div className="flex items-start space-x-2">
                <span className="text-amber-500 text-sm">[WARN]</span>
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  <strong>Exchange Rate Limitation:</strong> Custom currencies may not have live exchange rates available. 
                  They will use fallback rates (1.0) for conversions until rates are manually added or a compatible exchange rate source is found.
                </div>
              </div>
            </div>
          </div>

          {/* Add Currency Form */}
          {showAddCurrency && (
            <div className="mb-4 p-4 bg-btc-bg-tertiary rounded-md border border-btc-border-primary">
              <div className="mb-3">
                <div className="text-xs text-btc-text-muted">
                  [IDEA] <strong>Tip:</strong> Enter the currency code first - symbols and names will be automatically suggested from our comprehensive ISO 4217 database.
                </div>
              </div>
              <form onSubmit={addCustomCurrency} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-btc-text-secondary mb-1">
                      Code (3-4 letters)
                    </label>
                    <input
                      type="text"
                      value={newCurrencyForm.code}
                      onChange={(e) => {
                        const code = e.target.value.toUpperCase();
                        setNewCurrencyForm(prev => ({ ...prev, code }));
                        
                        if (code.length >= 3) {
                          // Auto-fetch symbol and name if code is 3-4 characters
                          const symbol = CurrencySymbolService.getCurrencySymbol(code);
                          const name = CurrencySymbolService.getCurrencyName(code);
                          
                          // Only auto-fill if we found a valid currency (symbol different from code)
                          if (symbol !== code) {
                            setNewCurrencyForm(prev => ({ 
                              ...prev, 
                              symbol: prev.symbol || symbol, // Only set if symbol is still empty
                              name: prev.name || (name !== code ? name : '') // Only set if name is different from code
                            }));
                          }
                        } else if (code.length === 0) {
                          // Clear symbol and name when code is completely deleted
                          setNewCurrencyForm(prev => ({ 
                            ...prev, 
                            symbol: '',
                            name: ''
                          }));
                        }
                      }}
                      placeholder="INR"
                      maxLength={4}
                      className="w-full px-2 py-1 text-sm bg-btc-bg-primary border border-btc-border-secondary rounded text-btc-text-primary focus:outline-none focus:ring-1 focus:ring-btc-orange"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-btc-text-secondary mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newCurrencyForm.name}
                      onChange={(e) => setNewCurrencyForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Indian Rupee"
                      className="w-full px-2 py-1 text-sm bg-btc-bg-primary border border-btc-border-secondary rounded text-btc-text-primary focus:outline-none focus:ring-1 focus:ring-btc-orange"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-btc-text-secondary mb-1">
                      Symbol
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newCurrencyForm.symbol}
                        onChange={(e) => setNewCurrencyForm(prev => ({ ...prev, symbol: e.target.value }))}
                        placeholder={newCurrencyForm.code ? CurrencySymbolService.getCurrencySymbol(newCurrencyForm.code) : "₹"}
                        maxLength={5}
                        className="w-full px-2 py-1 text-sm bg-btc-bg-primary border border-btc-border-secondary rounded text-btc-text-primary focus:outline-none focus:ring-1 focus:ring-btc-orange"
                        required

                      />
                    </div>
                    {newCurrencyForm.code && !newCurrencyForm.symbol && (
                      <div className="mt-1 text-xs text-btc-text-muted">
                        Suggested: {CurrencySymbolService.getCurrencySymbol(newCurrencyForm.code)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <ThemedButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={saving}
                  >
                    Add Currency
                  </ThemedButton>
                  {currencyStatus && (
                    <span className={`text-xs ${currencyStatus.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                      {currencyStatus}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Custom Currencies List */}
          {customCurrencies.length > 0 ? (
            <div className="space-y-2">
              {customCurrencies.map((currency) => (
                <div key={currency.id} className="flex items-center justify-between p-2 bg-btc-bg-tertiary rounded border border-btc-border-secondary">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm font-medium text-btc-text-primary">
                      {currency.code}
                    </span>
                    <span className="text-sm text-btc-text-secondary">
                      {currency.symbol} {currency.name}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteCustomCurrency(currency.id, currency.code)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-btc-text-muted text-sm">
              No custom currencies added yet
            </div>
          )}
        </div>

        {/* Exchange Rate Settings */}
        <div className="pt-6 border-t border-btc-border-secondary">
          <h3 className="text-sm font-medium text-btc-text-secondary mb-4">Exchange Rate Settings</h3>
          
          <div className="mb-4 p-3 bg-btc-bg-tertiary rounded-md">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-btc-text-primary">Data Source:</span>
              <span className="text-sm text-btc-orange">ExchangeRate-API.com</span>
            </div>
            <ThemedText variant="muted" size="sm">
              Free, reliable exchange rates updated multiple times daily. USD ↔ EUR rates are always fetched automatically since these are the only allowed main currencies.
            </ThemedText>
          </div>

          {/* Auto Update */}
          <div className="flex items-center space-x-3 mb-4">
            <input
              type="checkbox"
              checked={settings.autoUpdateRates}
              onChange={(e) => onUpdate({ autoUpdateRates: e.target.checked })}
              disabled={saving}
              className="w-4 h-4 text-btc-orange bg-btc-bg-tertiary border-btc-border-primary rounded focus:ring-btc-orange"
            />
            <label className="text-sm font-medium text-btc-text-secondary">
              Automatically update exchange rates
            </label>
          </div>

          {/* Update Interval */}
          {settings.autoUpdateRates && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                Update Interval
              </label>
              <select
                value={settings.rateUpdateInterval}
                onChange={(e) => onUpdate({ rateUpdateInterval: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded-md text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange focus:border-transparent"
                disabled={saving}
              >
                <option value={1}>Every hour</option>
                <option value={4}>Every 4 hours (recommended)</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Once daily</option>
              </select>
            </div>
          )}

          {/* Manual Update */}
          <div className="flex items-center space-x-3 mb-4">
            <ThemedButton
              onClick={updateExchangeRates}
              disabled={isUpdatingRates || saving}
              variant="secondary"
              size="sm"
            >
              {isUpdatingRates ? 'Updating...' : 'Update Exchange Rates Now'}
            </ThemedButton>
            {exchangeRateStatus && (
              <span className={`text-sm ${exchangeRateStatus.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                {exchangeRateStatus}
              </span>
            )}
          </div>

          {/* Current Exchange Rates Preview */}
          {exchangeRates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-btc-text-secondary">Current Exchange Rates</h4>
                <button
                  onClick={() => setShowAllRates(!showAllRates)}
                  className="text-xs text-btc-orange hover:text-btc-orange-light"
                >
                  {showAllRates ? 'Show Less' : 'Show All'}
                </button>
              </div>
              <div className="bg-btc-bg-tertiary rounded-md p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  {(showAllRates ? exchangeRates : recentRates).map((rate, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-btc-text-muted">{rate.from_currency}/{rate.to_currency}:</span>
                      <span className="text-btc-text-primary font-mono">{rate.rate.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
                {exchangeRates.length > 0 && (
                  <div className="text-btc-text-muted mt-2 text-center">
                    Last updated: {new Date(exchangeRates[0].last_updated).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ThemedCard>
  );
}

// Price Data Settings Panel
export function PriceDataSettingsPanel({ settings, onUpdate, saving }: SettingsPanelProps<PriceDataSettings>) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field: keyof PriceDataSettings, value: any) => {
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
    onUpdate(newSettings);
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-btc-text-primary mb-2">
          Price Data Settings
        </h3>
        <ThemedText variant="secondary">
          Configure how Bitcoin price data is collected and stored
        </ThemedText>
      </div>

      <div className="space-y-6">
        {/* Live Price Updates */}
        <ThemedCard>
          <div className="mb-4">
            <h4 className="font-medium text-btc-text-primary mb-2">Live Price Updates</h4>
            <ThemedText variant="muted" size="sm">
              How often to fetch current Bitcoin price
            </ThemedText>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                Update Interval
              </label>
              <select
                value={localSettings.liveUpdateInterval}
                onChange={(e) => handleChange('liveUpdateInterval', parseInt(e.target.value))}
                disabled={saving}
                className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary disabled:opacity-50"
              >
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
              </select>
            </div>
          </div>
        </ThemedCard>

        {/* Historical Data */}
        <ThemedCard>
          <div className="mb-4">
            <h4 className="font-medium text-btc-text-primary mb-2">Historical Data</h4>
            <ThemedText variant="muted" size="sm">
              Configure historical price data collection for charts and analysis
            </ThemedText>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                Historical Data Period
              </label>
              <select
                value={localSettings.historicalDataPeriod}
                onChange={(e) => handleChange('historicalDataPeriod', e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary disabled:opacity-50"
              >
                <option value="3M">3 months</option>
                <option value="6M">6 months</option>
                <option value="1Y">1 year (recommended)</option>
                <option value="2Y">2 years</option>
                <option value="5Y">5 years</option>
                <option value="ALL">All available data</option>
              </select>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Longer periods may take more time to download initially
              </ThemedText>
            </div>

            <div>
              <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                Data Retention Policy
              </label>
              <select
                value={localSettings.dataRetentionDays}
                onChange={(e) => handleChange('dataRetentionDays', parseInt(e.target.value))}
                disabled={saving}
                className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary disabled:opacity-50"
              >
                <option value={365}>1 year</option>
                <option value={730}>2 years</option>
                <option value={1095}>3 years</option>
                <option value={1825}>5 years</option>
                <option value={-1}>Keep all data</option>
              </select>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Older data will be automatically cleaned up
              </ThemedText>
            </div>

            {/* Historical Data Actions */}
            <div className="pt-4 border-t border-btc-border-secondary">
              <div className="flex space-x-3">
                <ThemedButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    // Trigger historical data fetch (will use current settings)
                    fetch('/api/historical-data/fetch', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    }).then(response => response.json())
                      .then(result => {
                        if (result.success) {
                          alert(`Successfully fetched ${result.data.recordsAdded} records of historical data`);
                        } else {
                          alert(`Error: ${result.error}`);
                        }
                      })
                      .catch(error => {
                        console.error('Error:', error);
                        alert('Failed to start historical data fetch');
                      });
                  }}
                  disabled={saving}
                  className="bg-btc-orange hover:bg-btc-orange-dark"
                >
                  Fetch Historical Data ({localSettings.historicalDataPeriod})
                </ThemedButton>
                
                <ThemedButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // Check historical data status
                    fetch('/api/historical-data/status')
                      .then(response => response.json())
                      .then(result => {
                        if (result.success) {
                          alert(`Historical data: ${result.data.recordCount} records, last updated: ${result.data.lastUpdate}`);
                        }
                      });
                  }}
                  disabled={saving}
                >
                  Check Data Status
                </ThemedButton>
              </div>
            </div>
          </div>
        </ThemedCard>

        {/* Intraday Settings */}
        <ThemedCard>
          <div className="mb-4">
            <h4 className="font-medium text-btc-text-primary mb-2">
              Intraday Data Settings [FAST]
            </h4>
            <ThemedText variant="muted" size="sm">
              Configure detailed intraday price tracking and data collection
            </ThemedText>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={localSettings.enableIntradayData}
                  onChange={(e) => handleChange('enableIntradayData', e.target.checked)}
                  disabled={saving}
                  className="rounded border-btc-border-primary bg-btc-bg-tertiary"
                />
                <span className="text-sm font-medium text-btc-text-secondary">
                  Enable Intraday Data Collection
                </span>
              </label>
              <ThemedText variant="muted" size="xs" className="mt-1 ml-6">
                Collect Bitcoin price data every few minutes for detailed charts
              </ThemedText>
            </div>

            <div>
              <label className="block text-sm font-medium text-btc-text-secondary mb-2">
                Intraday Configuration
              </label>
              <div className="p-3 bg-btc-bg-tertiary border border-btc-border-primary rounded">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-btc-text-primary">[UP] Hourly data collection (24 points/day)</span>
                </div>
                <div className="flex items-center space-x-2 text-sm mt-1">
                  <span className="text-btc-text-secondary">🗑️ Auto-cleanup daily (current day only)</span>
                </div>
              </div>
              <ThemedText variant="muted" size="xs" className="mt-1">
                Intraday data is collected hourly and automatically cleared daily to optimize storage
              </ThemedText>
            </div>

            {/* System Controls */}
            <div className="pt-4 border-t border-btc-border-secondary">
              <div className="flex space-x-3">
                <ThemedButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    // Trigger manual data update
                    fetch('/api/system/scheduler', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'update' })
                    }).then(response => response.json())
                      .then(result => {
                        if (result.success) {
                          alert('Data update completed successfully!');
                        } else {
                          alert(`Error: ${result.error}`);
                        }
                      })
                      .catch(error => {
                        console.error('Error:', error);
                        alert('Failed to trigger data update');
                      });
                  }}
                  disabled={saving}
                  className="bg-btc-orange hover:bg-btc-orange-dark"
                >
                  Update Now
                </ThemedButton>
                
                <ThemedButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // Check system status
                    fetch('/api/system/status')
                      .then(response => response.json())
                      .then(result => {
                        if (result.success) {
                          const status = result.status;
                          const message = `
System Status:
• App Initialized: ${status.app.isInitialized ? '[OK]' : '[ERROR]'}
• Scheduler Running: ${status.app.scheduler?.isRunning ? '[OK]' : '[ERROR]'}
• Database: ${status.database.status === 'connected' ? '[OK]' : '[ERROR]'}
• Intraday Records: ${status.database.stats?.intradayRecords || 0}
• Current Price: ${status.priceData.currentPrice ? '$' + status.priceData.currentPrice.price.toLocaleString() : 'No data'}
• Last Update: ${status.priceData.currentPrice?.lastUpdate ? new Date(status.priceData.currentPrice.lastUpdate).toLocaleString() : 'Never'}
                          `.trim();
                          alert(message);
                        }
                      });
                  }}
                  disabled={saving}
                >
                  System Status
                </ThemedButton>
              </div>
            </div>
          </div>
        </ThemedCard>
      </div>
    </div>
  );
}

// Display Settings Panel
export function DisplaySettingsPanel({ 
  settings, 
  onUpdate, 
  saving 
}: { 
  settings: DisplaySettings; 
  onUpdate: (updates: Partial<DisplaySettings>) => void;
  saving: boolean;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <ThemedCard>
      <div className="flex items-center space-x-3 mb-6">
        <AdjustmentsHorizontalIcon className="h-6 w-6 text-btc-500" />
        <h2 className="text-xl font-semibold text-btc-text-primary">
          Display Settings
        </h2>
      </div>
      
      <div className="space-y-6">
        {/* Currently Implemented */}
        <div>
          <label className="block text-sm font-medium text-btc-text-secondary mb-2">
            Theme
          </label>
          <select
            value={theme}
            onChange={(e) => {
              const newTheme = e.target.value as 'dark' | 'light';
              setTheme(newTheme);
              onUpdate({ theme: newTheme });
            }}
            className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded-md text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange focus:border-transparent"
            disabled={saving}
          >
            <option value="dark">🌙 Dark Mode</option>
            <option value="light">☀️ Light Mode</option>
          </select>
          <ThemedText variant="muted" size="sm" className="mt-1">
            Theme changes are saved automatically and persist across sessions
          </ThemedText>
        </div>
      </div>
    </ThemedCard>
  );
}

// Notification Settings Panel
export function NotificationSettingsPanel({ 
  settings, 
  onUpdate, 
  saving 
}: { 
  settings: NotificationSettings; 
  onUpdate: (updates: Partial<NotificationSettings>) => void;
  saving: boolean;
}) {
  return (
    <ThemedCard>
      <h2 className="text-xl font-semibold text-btc-text-primary mb-6">
        [ALERT] Notification Settings
      </h2>
      
      <div className="space-y-6">
        {/* Future Features - Coming Soon */}
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🚧</div>
          <h3 className="text-lg font-medium text-btc-text-secondary mb-2">
            Notifications Coming Soon
          </h3>
          <ThemedText variant="muted">
            Price alerts, portfolio notifications, and email/push notifications will be available in a future update.
          </ThemedText>
        </div>

        <div className="opacity-50 space-y-6">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                disabled
                className="w-4 h-4 text-btc-orange bg-btc-bg-tertiary border-btc-border-primary rounded cursor-not-allowed"
              />
              <label className="text-sm font-medium text-btc-text-muted">
                Enable price alerts
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 ml-7">
              <div>
                <label className="block text-xs font-medium text-btc-text-muted mb-1">
                  High Price Alert ($)
                </label>
                <input
                  type="number"
                  disabled
                  value="120000"
                  className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded-md text-btc-text-muted cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-btc-text-muted mb-1">
                  Low Price Alert ($)
                </label>
                <input
                  type="number"
                  disabled
                  value="80000"
                  className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded-md text-btc-text-muted cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                disabled
                className="w-4 h-4 text-btc-orange bg-btc-bg-tertiary border-btc-border-primary rounded cursor-not-allowed"
              />
              <label className="text-sm font-medium text-btc-text-muted">
                Enable portfolio performance alerts
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                disabled
                className="w-4 h-4 text-btc-orange bg-btc-bg-tertiary border-btc-border-primary rounded cursor-not-allowed"
              />
              <label className="text-sm font-medium text-btc-text-muted">
                Email notifications
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                disabled
                className="w-4 h-4 text-btc-orange bg-btc-bg-tertiary border-btc-border-primary rounded cursor-not-allowed"
              />
              <label className="text-sm font-medium text-btc-text-muted">
                Browser push notifications
              </label>
            </div>
          </div>
        </div>
      </div>
    </ThemedCard>
  );
}

// User Account Settings Panel
export function UserAccountSettingsPanel() {
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Form states
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user')
      if (response.ok) {
        const data = await response.json()
        setUserData(data)
        setName(data.name || '')
        setDisplayName(data.displayName || '')
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_name', name: name.trim() })
      })

      const data = await response.json()
      if (response.ok) {
        showMessage('success', data.message)
        await fetchUserData()
      } else {
        showMessage('error', data.error)
      }
    } catch (error) {
      showMessage('error', 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault()

    setSaving(true)
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_display_name', displayName: displayName.trim() })
      })

      const data = await response.json()
      if (response.ok) {
        showMessage('success', data.message)
        await fetchUserData()
      } else {
        showMessage('error', data.error)
      }
    } catch (error) {
      showMessage('error', 'Failed to update display name')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (response.ok) {
        showMessage('success', data.message)
        await fetchUserData()
      } else {
        showMessage('error', data.error)
      }
    } catch (error) {
      showMessage('error', 'Failed to upload profile picture')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/user/avatar', {
        method: 'DELETE'
      })

      const data = await response.json()
      if (response.ok) {
        showMessage('success', data.message)
        await fetchUserData()
      } else {
        showMessage('error', data.error)
      }
    } catch (error) {
      showMessage('error', 'Failed to remove profile picture')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) return

    if (newPassword !== confirmPassword) {
      showMessage('error', 'New passwords do not match')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'change_password', 
          currentPassword, 
          newPassword 
        })
      })

      const data = await response.json()
      if (response.ok) {
        showMessage('success', data.message)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        showMessage('error', data.error)
      }
    } catch (error) {
      showMessage('error', 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPin || !confirmPin) return

    if (newPin !== confirmPin) {
      showMessage('error', 'PINs do not match')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_pin', newPin })
      })

      const data = await response.json()
      if (response.ok) {
        showMessage('success', data.message)
        setNewPin('')
        setConfirmPin('')
        await fetchUserData()
      } else {
        showMessage('error', data.error)
      }
    } catch (error) {
      showMessage('error', 'Failed to set PIN')
    } finally {
      setSaving(false)
    }
  }

  const handleRemovePin = async () => {
    if (!confirm('Are you sure you want to remove your PIN? You will only be able to sign in with your password.')) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_pin' })
      })

      const data = await response.json()
      if (response.ok) {
        showMessage('success', data.message)
        await fetchUserData()
      } else {
        showMessage('error', data.error)
      }
    } catch (error) {
      showMessage('error', 'Failed to remove PIN')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-btc-orange"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-btc-text-primary mb-2">
          Account Settings
        </h3>
        <ThemedText variant="secondary">
          Manage your account information and security settings
        </ThemedText>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile & Account Information */}
      <ThemedCard>
        <h4 className="font-medium text-btc-text-primary mb-4">Profile & Account Information</h4>
        
        <div className="space-y-6">
          {/* Profile Picture Section */}
          <div>
            <label className="block text-sm font-medium text-btc-text-secondary mb-3">
              Profile Picture
            </label>
            <div className="flex items-center space-x-4">
              <UserAvatar 
                src={userData?.profilePicture}
                name={userData?.displayName || userData?.name}
                email={userData?.email}
                size="lg"
              />
                             <div className="flex-1">
                 <div className="flex space-x-2 mb-2">
                   <ThemedButton
                     variant="secondary"
                     size="sm"
                     onClick={() => setShowAvatarModal(true)}
                     disabled={uploading}
                   >
                     {uploading ? 'Uploading...' : 'Upload Picture'}
                   </ThemedButton>
                   {userData?.profilePicture && (
                     <ThemedButton
                       variant="secondary"
                       size="sm"
                       onClick={handleRemoveAvatar}
                       disabled={saving}
                       className="text-red-600 hover:text-red-700"
                     >
                       Remove
                     </ThemedButton>
                   )}
                 </div>
                 <ThemedText variant="muted" size="xs">
                   JPG, PNG, or WebP. Max 5MB.
                 </ThemedText>
               </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={userData?.email || ''}
              disabled
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-btc-border-primary rounded text-btc-text-muted cursor-not-allowed"
            />
            <ThemedText variant="muted" size="xs" className="mt-1">
              Email cannot be changed
            </ThemedText>
          </div>

          <form onSubmit={handleUpdateDisplayName}>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              Display Name
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange"
                placeholder="Enter a personalized display name"
              />
              <ThemedButton
                type="submit"
                variant="secondary"
                size="sm"
                disabled={saving || displayName.trim() === (userData?.displayName || '')}
              >
                {saving ? 'Saving...' : 'Update'}
              </ThemedButton>
            </div>
            <ThemedText variant="muted" size="xs" className="mt-1">
              This is how you&apos;ll appear throughout the app
            </ThemedText>
          </form>

          <form onSubmit={handleUpdateName}>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              Full Name
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange"
                placeholder="Enter your full name"
              />
              <ThemedButton
                type="submit"
                variant="secondary"
                size="sm"
                disabled={saving || !name.trim() || name === userData?.name}
              >
                {saving ? 'Saving...' : 'Update'}
              </ThemedButton>
            </div>
          </form>

          <div className="text-xs text-btc-text-muted">
            Member since: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Unknown'}
          </div>
        </div>
      </ThemedCard>

      {/* Change Password */}
      <ThemedCard>
        <h4 className="font-medium text-btc-text-primary mb-4">Change Password</h4>
        
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange"
              placeholder="Enter new password"
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange"
              placeholder="Confirm new password"
              minLength={6}
            />
          </div>

          <ThemedButton
            type="submit"
            variant="primary"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          >
            {saving ? 'Changing Password...' : 'Change Password'}
          </ThemedButton>
        </form>
      </ThemedCard>

      {/* PIN Settings */}
      <ThemedCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-btc-text-primary">PIN Authentication</h4>
            <ThemedText variant="muted" size="sm">
              {userData?.hasPin ? 'PIN is currently set' : 'No PIN set'}
            </ThemedText>
          </div>
          {userData?.hasPin && (
            <ThemedButton
              variant="secondary"
              size="sm"
              onClick={handleRemovePin}
              disabled={saving}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Remove PIN
            </ThemedButton>
          )}
        </div>

        <form onSubmit={handleSetPin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              {userData?.hasPin ? 'New PIN (4-6 digits)' : 'Set PIN (4-6 digits)'}
            </label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange text-center text-xl tracking-widest"
              placeholder="••••"
              minLength={4}
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-btc-text-secondary mb-1">
              Confirm PIN
            </label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 bg-btc-bg-tertiary border border-btc-border-primary rounded text-btc-text-primary focus:outline-none focus:ring-2 focus:ring-btc-orange text-center text-xl tracking-widest"
              placeholder="••••"
              minLength={4}
              maxLength={6}
            />
          </div>

          <ThemedButton
            type="submit"
            variant="primary"
            disabled={saving || !newPin || !confirmPin || newPin.length < 4}
          >
            {saving ? 'Setting PIN...' : (userData?.hasPin ? 'Update PIN' : 'Set PIN')}
          </ThemedButton>
        </form>

        <ThemedText variant="muted" size="xs" className="mt-2">
          PIN allows for quick access to your account. Use 4-6 digits that you can easily remember.
        </ThemedText>
      </ThemedCard>

      {/* Avatar Upload Modal */}
      <AvatarUploadModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onUpload={handleAvatarUpload}
        currentAvatar={userData?.profilePicture}
        userName={userData?.displayName || userData?.name}
        userEmail={userData?.email}
      />
    </div>
  )
} 