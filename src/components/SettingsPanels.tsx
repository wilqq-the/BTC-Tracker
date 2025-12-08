'use client';

import React, { useState, useEffect } from 'react';
import { CurrencySettings, PriceDataSettings, DisplaySettings, NotificationSettings, MainCurrency, SupportedCurrency } from '@/lib/types';
import { CustomCurrency } from '@/lib/custom-currency-service';
import { CurrencySymbolService } from '@/lib/currency-symbol-service';
import UserAvatar from './UserAvatar';
import AvatarUploadModal from './AvatarUploadModal';
import SystemStatusDialog from './SystemStatusDialog';
import { useTheme } from './ui/ThemeProvider';
import { useDarkThemePreset } from '@/hooks/use-dark-theme-preset';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

// Icons
import { 
  DollarSignIcon, 
  RefreshCwIcon, 
  PlusIcon, 
  TrashIcon,
  AlertTriangleIcon,
  LightbulbIcon,
  CheckIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  BellOffIcon,
  UserIcon,
  LockIcon,
  KeyIcon,
  CameraIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ActivityIcon,
  DatabaseIcon,
  ClockIcon,
  ServerIcon,
  PaletteIcon
} from 'lucide-react';

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

  const mainCurrencies: Array<{code: MainCurrency, name: string, symbol: string}> = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ];

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
  const recentRates = exchangeRates.slice(0, 6);

  const ensureRequiredCurrencies = () => {
    const required = [settings.mainCurrency, settings.secondaryCurrency];
    const allAvailableCodes = [
      ...allCurrencies.map(c => c.code),
      ...customCurrencies.map(c => c.code)
    ];
    
    const validRequired = required.filter(curr => allAvailableCodes.includes(curr));
    const missing = validRequired.filter(curr => !currentSupported.includes(curr));
    
    if (missing.length > 0) {
      const updatedSupported = [...currentSupported, ...missing];
      onUpdate({ supportedCurrencies: updatedSupported });
    }
  };

  useEffect(() => {
    ensureRequiredCurrencies();
  }, [settings.mainCurrency, settings.secondaryCurrency, customCurrencies]);

  const getAvailableCurrencies = () => {
    const majorCurrencies = ['USD', 'EUR', 'PLN', 'GBP'];
    const availableCodes = Array.from(new Set([...currentSupported, ...majorCurrencies]));
    
    const builtInCurrencies = allCurrencies.filter(c => availableCodes.includes(c.code));
    
    const customCurrencyOptions = customCurrencies.map(c => ({
      code: c.code as any,
      name: c.name,
      symbol: c.symbol
    }));
    
    const allOptions = [...builtInCurrencies, ...customCurrencyOptions];
    const uniqueOptions = allOptions.filter((currency, index, self) => 
      index === self.findIndex(c => c.code === currency.code)
    );
    
    return uniqueOptions;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Currency Settings</h3>
        <p className="text-muted-foreground">Configure currencies for your portfolio</p>
      </div>
      
      {/* Main & Secondary Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSignIcon className="size-4" />
            Currency Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mainCurrency">Main Currency (for calculations)</Label>
            <select
              id="mainCurrency"
              value={settings.mainCurrency}
              onChange={(e) => onUpdate({ mainCurrency: e.target.value as MainCurrency })}
              className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={saving}
            >
              {mainCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              All calculations and database storage will use this currency. Only USD and EUR are supported.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryCurrency">Secondary Currency (for display)</Label>
            <select
              id="secondaryCurrency"
              value={settings.secondaryCurrency}
              onChange={(e) => onUpdate({ secondaryCurrency: e.target.value as SupportedCurrency })}
              className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={saving}
            >
              {getAvailableCurrencies().map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Values will be converted and shown in this currency alongside main currency
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Supported Currencies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supported Currencies</CardTitle>
          <CardDescription>Select currencies you want to use for transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {allCurrencies.map((currency) => {
              const isSupported = currentSupported.includes(currency.code);
              const isRequired = currency.code === settings.mainCurrency || currency.code === settings.secondaryCurrency;
              
              return (
                <label 
                  key={currency.code} 
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                    isSupported ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50",
                    isRequired && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <Checkbox
                    checked={isSupported}
                    onCheckedChange={() => {
                      if (isRequired) return;
                      const newSupported = isSupported 
                        ? currentSupported.filter(c => c !== currency.code) 
                        : [...currentSupported, currency.code];
                      onUpdate({ supportedCurrencies: newSupported });
                    }}
                    disabled={isRequired || saving}
                  />
                  <span className="text-sm">
                    {currency.symbol} {currency.code}
                  </span>
                  {isRequired && (
                    <span className="text-xs text-primary ml-auto">(required)</span>
                  )}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Currencies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Custom Currencies</CardTitle>
              <CardDescription>Add currencies not in the built-in list</CardDescription>
            </div>
            <Button
              variant={showAddCurrency ? "outline" : "default"}
              size="sm"
              onClick={() => setShowAddCurrency(!showAddCurrency)}
              disabled={saving}
            >
              {showAddCurrency ? (
                <>
                  <XIcon className="size-4 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <PlusIcon className="size-4 mr-1" />
                  Add Currency
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangleIcon className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <strong>Exchange Rate Limitation:</strong> Custom currencies may not have live exchange rates. 
              They will use fallback rates (1.0) until rates are manually added.
            </p>
          </div>

          {/* Add Form */}
          {showAddCurrency && (
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-2 mb-3">
                <LightbulbIcon className="size-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Enter the currency code first - symbols and names will be automatically suggested.
                </p>
              </div>
              <form onSubmit={addCustomCurrency} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Code (3-4 letters)</Label>
                    <Input
                      value={newCurrencyForm.code}
                      onChange={(e) => {
                        const code = e.target.value.toUpperCase();
                        setNewCurrencyForm(prev => ({ ...prev, code }));
                        
                        if (code.length >= 3) {
                          const symbol = CurrencySymbolService.getCurrencySymbol(code);
                          const name = CurrencySymbolService.getCurrencyName(code);
                          
                          if (symbol !== code) {
                            setNewCurrencyForm(prev => ({ 
                              ...prev, 
                              symbol: prev.symbol || symbol,
                              name: prev.name || (name !== code ? name : '')
                            }));
                          }
                        } else if (code.length === 0) {
                          setNewCurrencyForm(prev => ({ ...prev, symbol: '', name: '' }));
                        }
                      }}
                      placeholder="INR"
                      maxLength={4}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={newCurrencyForm.name}
                      onChange={(e) => setNewCurrencyForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Indian Rupee"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Symbol</Label>
                    <Input
                      value={newCurrencyForm.symbol}
                      onChange={(e) => setNewCurrencyForm(prev => ({ ...prev, symbol: e.target.value }))}
                      placeholder={newCurrencyForm.code ? CurrencySymbolService.getCurrencySymbol(newCurrencyForm.code) : "₹"}
                      maxLength={5}
                      required
                    />
                    {newCurrencyForm.code && !newCurrencyForm.symbol && (
                      <p className="text-xs text-muted-foreground">
                        Suggested: {CurrencySymbolService.getCurrencySymbol(newCurrencyForm.code)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" disabled={saving}>
                    <PlusIcon className="size-4 mr-1" />
                    Add Currency
                  </Button>
                  {currencyStatus && (
                    <span className={cn(
                      "text-xs",
                      currencyStatus.includes('success') ? 'text-profit' : 'text-destructive'
                    )}>
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
                <div key={currency.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{currency.code}</span>
                    <span className="text-sm text-muted-foreground">
                      {currency.symbol} {currency.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCustomCurrency(currency.id, currency.code)}
                    disabled={saving}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground text-sm">
              No custom currencies added yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCwIcon className="size-4" />
            Exchange Rate Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">Data Source:</span>
              <span className="text-sm text-primary">ExchangeRate-API.com</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Free, reliable exchange rates updated multiple times daily.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="autoUpdateRates"
              checked={settings.autoUpdateRates}
              onCheckedChange={(checked) => onUpdate({ autoUpdateRates: checked as boolean })}
              disabled={saving}
            />
            <Label htmlFor="autoUpdateRates" className="cursor-pointer">
              Automatically update exchange rates
            </Label>
          </div>

          {settings.autoUpdateRates && (
            <div className="space-y-2">
              <Label htmlFor="rateUpdateInterval">Update Interval</Label>
              <select
                id="rateUpdateInterval"
                value={settings.rateUpdateInterval}
                onChange={(e) => onUpdate({ rateUpdateInterval: parseInt(e.target.value) })}
                className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={saving}
              >
                <option value={1}>Every hour</option>
                <option value={4}>Every 4 hours (recommended)</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Once daily</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={updateExchangeRates}
              disabled={isUpdatingRates || saving}
            >
              {isUpdatingRates ? (
                <>
                  <RefreshCwIcon className="size-4 mr-1 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCwIcon className="size-4 mr-1" />
                  Update Now
                </>
              )}
            </Button>
            {exchangeRateStatus && (
              <span className={cn(
                "text-sm",
                exchangeRateStatus.includes('success') ? 'text-profit' : 'text-destructive'
              )}>
                {exchangeRateStatus}
              </span>
            )}
          </div>

          {/* Current Rates */}
          {exchangeRates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Current Exchange Rates</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllRates(!showAllRates)}
                  className="text-xs"
                >
                  {showAllRates ? (
                    <>
                      <ChevronUpIcon className="size-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="size-3 mr-1" />
                      Show All
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(showAllRates ? exchangeRates : recentRates).map((rate, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-muted-foreground">{rate.from_currency}/{rate.to_currency}:</span>
                      <span className="font-mono">{rate.rate.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
                {exchangeRates.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Last updated: {new Date(exchangeRates[0].last_updated).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Price Data Settings Panel
export function PriceDataSettingsPanel({ settings, onUpdate, saving }: SettingsPanelProps<PriceDataSettings>) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [showSystemStatus, setShowSystemStatus] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field: keyof PriceDataSettings, value: any) => {
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
    onUpdate(newSettings);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Price Data Settings</h3>
        <p className="text-muted-foreground">Configure how Bitcoin price data is collected and stored</p>
      </div>

      {/* Historical Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DatabaseIcon className="size-4" />
            Historical Data
          </CardTitle>
          <CardDescription>Configure historical price data collection for charts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="historicalDataPeriod">Historical Data Period</Label>
            <select
              id="historicalDataPeriod"
              value={localSettings.historicalDataPeriod}
              onChange={(e) => handleChange('historicalDataPeriod', e.target.value)}
              disabled={saving}
              className="w-full h-10 px-3 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="3M">3 months</option>
              <option value="6M">6 months</option>
              <option value="1Y">1 year (recommended)</option>
              <option value="2Y">2 years</option>
              <option value="5Y">5 years</option>
              <option value="ALL">All available data</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Longer periods may take more time to download initially
            </p>
          </div>

          <div className="pt-4 border-t flex gap-3">
            <Button
              size="sm"
              onClick={() => {
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
            >
              <DatabaseIcon className="size-4 mr-1" />
              Fetch Historical Data ({localSettings.historicalDataPeriod})
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
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
              Check Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Intraday Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClockIcon className="size-4" />
            Intraday Data Settings
          </CardTitle>
          <CardDescription>Configure detailed intraday price tracking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="enableIntradayData"
              checked={localSettings.enableIntradayData}
              onCheckedChange={(checked) => handleChange('enableIntradayData', checked as boolean)}
              disabled={saving}
            />
            <div>
              <Label htmlFor="enableIntradayData" className="cursor-pointer">
                Enable Intraday Data Collection
              </Label>
              <p className="text-xs text-muted-foreground">
                Collect Bitcoin price data every few minutes for detailed charts
              </p>
            </div>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="text-sm">Hourly data collection (24 points/day)</p>
            <p className="text-xs text-muted-foreground">Auto-cleanup daily (current day only)</p>
          </div>

          <div className="pt-4 border-t flex gap-3">
            <Button
              size="sm"
              onClick={() => {
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
            >
              <RefreshCwIcon className="size-4 mr-1" />
              Update Now
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSystemStatus(true)}
              disabled={saving}
            >
              <ServerIcon className="size-4 mr-1" />
              System Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status Dialog */}
      <SystemStatusDialog 
        open={showSystemStatus} 
        onOpenChange={setShowSystemStatus} 
      />
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
  const { 
    darkPresetId, 
    lightPresetId, 
    setDarkPreset, 
    setLightPreset, 
    darkPresets, 
    lightPresets, 
    mounted 
  } = useDarkThemePreset();
  
  const currentPresets = theme === 'dark' ? darkPresets : lightPresets;
  const currentPresetId = theme === 'dark' ? darkPresetId : lightPresetId;
  const setCurrentPreset = theme === 'dark' ? setDarkPreset : setLightPreset;
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Display Settings</h3>
        <p className="text-muted-foreground">Customize the appearance of your tracker</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="size-4" />
            Theme Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setTheme('light');
                onUpdate({ theme: 'light' });
              }}
              disabled={saving}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                theme === 'light' 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <SunIcon className="size-5" />
              <span className="font-medium">Light</span>
              {theme === 'light' && <CheckIcon className="size-4 text-primary" />}
            </button>
            <button
              onClick={() => {
                setTheme('dark');
                onUpdate({ theme: 'dark' });
              }}
              disabled={saving}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                theme === 'dark' 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <MoonIcon className="size-5" />
              <span className="font-medium">Dark</span>
              {theme === 'dark' && <CheckIcon className="size-4 text-primary" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Theme Style - Shows for both light and dark modes */}
      {mounted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PaletteIcon className="size-4" />
              {theme === 'dark' ? 'Dark' : 'Light'} Theme Style
            </CardTitle>
            <CardDescription>
              Choose a color scheme for {theme === 'dark' ? 'dark' : 'light'} mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setCurrentPreset(preset.id)}
                  className={cn(
                    "relative flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                    currentPresetId === preset.id 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {/* Color preview dots */}
                  <div className="flex gap-1 mb-2">
                    <div 
                      className="size-3 rounded-full border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: `hsl(${preset.colors.background})` }}
                    />
                    <div 
                      className="size-3 rounded-full border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: `hsl(${preset.colors.card})` }}
                    />
                    <div 
                      className="size-3 rounded-full border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: `hsl(${preset.colors.border})` }}
                    />
                  </div>
                  <span className="font-medium text-sm">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                  {currentPresetId === preset.id && (
                    <CheckIcon className="absolute top-2 right-2 size-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Theme style is saved automatically and persists across sessions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
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
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Notification Settings</h3>
        <p className="text-muted-foreground">Configure alerts and notifications</p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="size-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <BellOffIcon className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Notifications Coming Soon</h4>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Price alerts, portfolio notifications, and email/push notifications will be available in a future update.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview of upcoming features */}
      <Card className="opacity-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellIcon className="size-4" />
            Price Alerts (Coming Soon)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox disabled />
            <Label className="text-muted-foreground">Enable price alerts</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">High Price Alert ($)</Label>
              <Input disabled value="120000" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Low Price Alert ($)</Label>
              <Input disabled value="80000" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox disabled />
            <Label className="text-muted-foreground">Enable portfolio performance alerts</Label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Checkbox disabled />
              <Label className="text-muted-foreground">Email notifications</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox disabled />
              <Label className="text-muted-foreground">Browser push notifications</Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// User Account Settings Panel
export function UserAccountSettingsPanel() {
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  
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
        toast({ title: data.message })
        await fetchUserData()
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to update name', variant: 'destructive' })
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
        toast({ title: data.message })
        await fetchUserData()
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to update display name', variant: 'destructive' })
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
        toast({ title: data.message })
        await fetchUserData()
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to upload profile picture', variant: 'destructive' })
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
        toast({ title: data.message })
        await fetchUserData()
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to remove profile picture', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) return

    if (newPassword !== confirmPassword) {
      toast({ title: 'New passwords do not match', variant: 'destructive' })
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
        toast({ title: data.message })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to change password', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPin || !confirmPin) return

    if (newPin !== confirmPin) {
      toast({ title: 'PINs do not match', variant: 'destructive' })
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
        toast({ title: data.message })
        setNewPin('')
        setConfirmPin('')
        await fetchUserData()
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to set PIN', variant: 'destructive' })
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
        toast({ title: data.message })
        await fetchUserData()
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to remove PIN', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Account Settings</h3>
        <p className="text-muted-foreground">Manage your account information and security</p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="size-4" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div>
            <Label className="mb-3 block">Profile Picture</Label>
            <div className="flex items-center gap-4">
              <UserAvatar 
                src={userData?.profilePicture}
                name={userData?.displayName || userData?.name}
                email={userData?.email}
                size="lg"
              />
              <div>
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAvatarModal(true)}
                    disabled={uploading}
                  >
                    <CameraIcon className="size-4 mr-1" />
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                  {userData?.profilePicture && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      <TrashIcon className="size-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, or WebP. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              type="email"
              value={userData?.email || ''}
              disabled
              className="opacity-60"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          {/* Display Name */}
          <form onSubmit={handleUpdateDisplayName} className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter a personalized display name"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={saving || displayName.trim() === (userData?.displayName || '')}
              >
                {saving ? 'Saving...' : 'Update'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is how you&apos;ll appear throughout the app
            </p>
          </form>

          {/* Full Name */}
          <form onSubmit={handleUpdateName} className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="flex gap-2">
              <Input
                id="fullName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={saving || !name.trim() || name === userData?.name}
              >
                {saving ? 'Saving...' : 'Update'}
              </Button>
            </div>
          </form>

          <p className="text-xs text-muted-foreground">
            Member since: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Unknown'}
          </p>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LockIcon className="size-4" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            >
              {saving ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* PIN Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyIcon className="size-4" />
                PIN Authentication
              </CardTitle>
              <CardDescription>
                {userData?.hasPin ? 'PIN is currently set' : 'No PIN set'}
              </CardDescription>
            </div>
            {userData?.hasPin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemovePin}
                disabled={saving}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <TrashIcon className="size-4 mr-1" />
                Remove PIN
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPin">
                {userData?.hasPin ? 'New PIN (4-6 digits)' : 'Set PIN (4-6 digits)'}
              </Label>
              <Input
                id="newPin"
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                minLength={4}
                maxLength={6}
                className="text-center text-xl tracking-widest"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirm PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                minLength={4}
                maxLength={6}
                className="text-center text-xl tracking-widest"
              />
            </div>

            <Button
              type="submit"
              disabled={saving || !newPin || !confirmPin || newPin.length < 4}
            >
              {saving ? 'Setting PIN...' : (userData?.hasPin ? 'Update PIN' : 'Set PIN')}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4">
            PIN allows for quick access to your account. Use 4-6 digits that you can easily remember.
          </p>
        </CardContent>
      </Card>

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
