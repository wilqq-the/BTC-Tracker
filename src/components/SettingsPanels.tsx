'use client';

import React, { useState, useEffect } from 'react';
import { CurrencySettings, PriceDataSettings, DisplaySettings, NotificationSettings, MainCurrency, SupportedCurrency } from '@/lib/types';
import { CustomCurrency } from '@/lib/custom-currency-service';
import { CurrencySymbolService } from '@/lib/currency-symbol-service';
import UserAvatar from './UserAvatar';
import AvatarUploadModal from './AvatarUploadModal';
import SystemStatusDialog from './SystemStatusDialog';
import TwoFactorSetup from './TwoFactorSetup';
import { useTheme } from './ui/ThemeProvider';
import { useDarkThemePreset } from '@/hooks/use-dark-theme-preset';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedControl } from '@/components/ui/segmented-control';

// Icons
import {
  RefreshCwIcon,
  PlusIcon,
  TrashIcon,
  AlertTriangleIcon,
  CheckIcon,
  BellOffIcon,
  CameraIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DatabaseIcon,
  ServerIcon,
} from 'lucide-react';

interface SettingsPanelProps<T> {
  settings: T;
  onUpdate: (updates: Partial<T>) => void;
  saving: boolean;
}

// Shared styles for the settings cards
const titleClass = 'text-[17px] font-bold tracking-tight';
const descriptionClass = 'text-[13px]';
const selectClass =
  'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50';
const hintClass = 'text-xs text-muted-foreground';

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

  /** Refresh rates from the provider. Returns whether it worked; toasts unless silent. */
  const updateExchangeRates = async (silent = false): Promise<boolean> => {
    setIsUpdatingRates(true);
    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update' })
      });

      if (response.ok) {
        await loadExchangeRates();
        if (!silent) toast({ title: 'Exchange rates updated', variant: 'success' });
        return true;
      }
      if (!silent) toast({ title: 'Couldn’t update exchange rates', description: 'The rate provider didn’t respond. Try again in a minute.', variant: 'destructive' });
      return false;
    } catch (error) {
      if (!silent) toast({ title: 'Couldn’t update exchange rates', description: 'Check your connection and try again.', variant: 'destructive' });
      return false;
    } finally {
      setIsUpdatingRates(false);
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
      toast({ title: 'Fill in the code, name and symbol', variant: 'destructive' });
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
        setNewCurrencyForm({ code: '', name: '', symbol: '' });
        setShowAddCurrency(false);
        await loadCustomCurrencies();
        const ratesUpdated = await updateExchangeRates(true);
        toast({
          title: `${result.data.code} added`,
          description: ratesUpdated ? 'Exchange rates were updated too.' : 'Exchange rates couldn’t be updated, so it converts at 1.0 for now.',
          variant: ratesUpdated ? 'success' : undefined,
        });
      } else {
        toast({ title: result.error || 'Failed to add currency', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to add currency', variant: 'destructive' });
    }
  };

  const deleteCustomCurrency = async (id: number, code: string) => {
    if (await confirm({ title: `Delete ${code}?`, description: `The custom currency ${code} will be removed.`, confirmText: 'Delete', destructive: true })) {
      try {
        const response = await fetch(`/api/custom-currencies/${id}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
          toast({ title: `${code} deleted` });
          await loadCustomCurrencies();
        } else {
          toast({ title: result.error || 'Failed to delete currency', variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: 'Failed to delete currency', variant: 'destructive' });
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
    <div className="space-y-4">
      {/* Main & Secondary Currency */}
      <Card>
        <CardHeader>
          <CardTitle className={titleClass}>Portfolio currencies</CardTitle>
          <CardDescription className={descriptionClass}>One currency to calculate in, another to show next to it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mainCurrency">Main currency</Label>
            <select
              id="mainCurrency"
              value={settings.mainCurrency}
              onChange={(e) => onUpdate({ mainCurrency: e.target.value as MainCurrency })}
              className={selectClass}
              disabled={saving}
            >
              {mainCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </option>
              ))}
            </select>
            <p className={hintClass}>
              All calculations and stored values use this currency. USD or EUR.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryCurrency">Secondary currency</Label>
            <select
              id="secondaryCurrency"
              value={settings.secondaryCurrency}
              onChange={(e) => onUpdate({ secondaryCurrency: e.target.value as SupportedCurrency })}
              className={selectClass}
              disabled={saving}
            >
              {getAvailableCurrencies().map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </option>
              ))}
            </select>
            <p className={hintClass}>
              Values are converted and shown in this currency alongside the main one.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Supported Currencies */}
      <Card>
        <CardHeader>
          <CardTitle className={titleClass}>Transaction currencies</CardTitle>
          <CardDescription className={descriptionClass}>The currencies you can enter transactions in.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {allCurrencies.map((currency) => {
              const isSupported = currentSupported.includes(currency.code);
              const isRequired = currency.code === settings.mainCurrency || currency.code === settings.secondaryCurrency;

              return (
                <label
                  key={currency.code}
                  className={cn(
                    'flex min-h-10 items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-colors',
                    isSupported ? 'bg-tint-orange' : 'bg-secondary hover:bg-accent',
                    isRequired ? 'cursor-not-allowed' : 'cursor-pointer'
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
                  <span className="text-sm font-semibold">{currency.code}</span>
                  <span className="text-sm text-muted-foreground">{currency.symbol}</span>
                  {isRequired && (
                    <span className="ml-auto text-xs font-semibold text-primary-strong">In use</span>
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className={titleClass}>Custom currencies</CardTitle>
              <CardDescription className={descriptionClass}>Add a currency that isn&apos;t in the list above.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => setShowAddCurrency(!showAddCurrency)}
              disabled={saving}
            >
              {showAddCurrency ? (
                <>
                  <XIcon className="size-4" />
                  Cancel
                </>
              ) : (
                <>
                  <PlusIcon className="size-4" />
                  Add currency
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-2xl bg-tint-orange p-3 text-[13px] text-primary-strong">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              Custom currencies may not have live exchange rates. Until a rate is available they convert at 1.0.
            </p>
          </div>

          {/* Add Form */}
          {showAddCurrency && (
            <form onSubmit={addCustomCurrency} className="space-y-3 rounded-2xl bg-secondary p-4">
              <p className={hintClass}>
                Start with the code: the name and symbol are filled in when we recognise it.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customCode">Code</Label>
                  <Input
                    id="customCode"
                    className="bg-card"
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
                <div className="space-y-1.5">
                  <Label htmlFor="customName">Name</Label>
                  <Input
                    id="customName"
                    className="bg-card"
                    value={newCurrencyForm.name}
                    onChange={(e) => setNewCurrencyForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Indian Rupee"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customSymbol">Symbol</Label>
                  <Input
                    id="customSymbol"
                    className="bg-card"
                    value={newCurrencyForm.symbol}
                    onChange={(e) => setNewCurrencyForm(prev => ({ ...prev, symbol: e.target.value }))}
                    placeholder={newCurrencyForm.code ? CurrencySymbolService.getCurrencySymbol(newCurrencyForm.code) : '₹'}
                    maxLength={5}
                    required
                  />
                  {newCurrencyForm.code && !newCurrencyForm.symbol && (
                    <p className={hintClass}>
                      Suggested: {CurrencySymbolService.getCurrencySymbol(newCurrencyForm.code)}
                    </p>
                  )}
                </div>
              </div>
              <Button type="submit" size="sm" className="rounded-full font-semibold" disabled={saving}>
                <PlusIcon className="size-4" />
                Add currency
              </Button>
            </form>
          )}

          {/* Custom Currencies List */}
          {customCurrencies.length > 0 ? (
            <div className="space-y-2">
              {customCurrencies.map((currency) => (
                <div key={currency.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-sm font-bold">{currency.code}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {currency.symbol} {currency.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${currency.code}`}
                    onClick={() => deleteCustomCurrency(currency.id, currency.code)}
                    disabled={saving}
                    className="rounded-full text-muted-foreground hover:bg-tint-red hover:text-tint-red-fg"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : !showAddCurrency && (
            <p className="py-2 text-sm text-muted-foreground">
              No custom currencies yet. Ones you add will appear here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className={titleClass}>Exchange rates</CardTitle>
              <CardDescription className={descriptionClass}>Rates come from ExchangeRate-API.com, which updates several times a day.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => updateExchangeRates()}
              disabled={isUpdatingRates || saving}
            >
              <RefreshCwIcon className={cn('size-4', isUpdatingRates && 'animate-spin')} />
              {isUpdatingRates ? 'Updating...' : 'Update now'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="autoUpdateRates"
              checked={settings.autoUpdateRates}
              onCheckedChange={(checked) => onUpdate({ autoUpdateRates: checked as boolean })}
              disabled={saving}
            />
            <Label htmlFor="autoUpdateRates" className="cursor-pointer">
              Update exchange rates automatically
            </Label>
          </div>

          {settings.autoUpdateRates && (
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="rateUpdateInterval">How often</Label>
              <select
                id="rateUpdateInterval"
                value={settings.rateUpdateInterval}
                onChange={(e) => onUpdate({ rateUpdateInterval: parseInt(e.target.value) })}
                className={selectClass}
                disabled={saving}
              >
                <option value={1}>Every hour</option>
                <option value={4}>Every 4 hours (recommended)</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Once a day</option>
              </select>
            </div>
          )}

          {/* Current Rates */}
          {exchangeRates.length > 0 && (
            <div className="rounded-2xl bg-secondary p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-[13px] font-semibold text-muted-foreground">Current rates</h4>
                {exchangeRates.length > recentRates.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllRates(!showAllRates)}
                    className="h-7 rounded-full text-xs"
                  >
                    {showAllRates ? (
                      <>
                        <ChevronUpIcon className="size-3.5" />
                        Show fewer
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="size-3.5" />
                        Show all {exchangeRates.length}
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {(showAllRates ? exchangeRates : recentRates).map((rate, index) => (
                  <div key={index} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{rate.from_currency} to {rate.to_currency}</span>
                    <span className="font-semibold tabular-nums">{rate.rate.toFixed(4)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Last updated {new Date(exchangeRates[0].last_updated).toLocaleString()}
              </p>
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
    <div className="space-y-4">

      {/* Historical Data */}
      <Card>
        <CardHeader>
          <CardTitle className={titleClass}>Price history</CardTitle>
          <CardDescription className={descriptionClass}>Daily prices used by the charts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="historicalDataPeriod">How far back</Label>
            <select
              id="historicalDataPeriod"
              value={localSettings.historicalDataPeriod}
              onChange={(e) => handleChange('historicalDataPeriod', e.target.value)}
              disabled={saving}
              className={selectClass}
            >
              <option value="3M">3 months</option>
              <option value="6M">6 months</option>
              <option value="1Y">1 year (recommended)</option>
              <option value="2Y">2 years</option>
              <option value="5Y">5 years</option>
              <option value="ALL">All available data</option>
            </select>
            <p className={hintClass}>
              Longer periods take longer to download the first time.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <Button
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => {
                fetch('/api/historical-data/fetch', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                }).then(response => response.json())
                  .then(result => {
                    if (result.success) {
                      toast({ title: 'Price history downloaded', description: `Added ${result.data.recordsAdded} daily prices.`, variant: 'success' });
                    } else {
                      toast({ title: 'Failed to download price history', description: result.error, variant: 'destructive' });
                    }
                  })
                  .catch(error => {
                    console.error('Error:', error);
                    toast({ title: 'Failed to start the price history download', variant: 'destructive' });
                  });
              }}
              disabled={saving}
            >
              <DatabaseIcon className="size-4" />
              Download price history
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => {
                fetch('/api/historical-data/status')
                  .then(response => response.json())
                  .then(result => {
                    if (result.success) {
                      toast({ title: 'Price history', description: `${result.data.recordCount} daily prices stored, last updated ${result.data.lastUpdate}.` });
                    }
                  });
              }}
              disabled={saving}
            >
              Check what&apos;s stored
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Intraday Settings */}
      <Card>
        <CardHeader>
          <CardTitle className={titleClass}>Intraday prices</CardTitle>
          <CardDescription className={descriptionClass}>Prices through the day, for the detailed 1-day chart.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="enableIntradayData"
              className="mt-0.5"
              checked={localSettings.enableIntradayData}
              onCheckedChange={(checked) => handleChange('enableIntradayData', checked as boolean)}
              disabled={saving}
            />
            <div className="space-y-0.5">
              <Label htmlFor="enableIntradayData" className="cursor-pointer">
                Collect intraday prices
              </Label>
              <p className={hintClass}>
                One price an hour (24 a day). Only the current day is kept; older points are cleaned up daily.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <Button
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => {
                fetch('/api/system/scheduler', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'update' })
                }).then(response => response.json())
                  .then(result => {
                    if (result.success) {
                      toast({ title: 'Prices updated', variant: 'success' });
                    } else {
                      toast({ title: 'Failed to update prices', description: result.error, variant: 'destructive' });
                    }
                  })
                  .catch(error => {
                    console.error('Error:', error);
                    toast({ title: 'Failed to start the price update', variant: 'destructive' });
                  });
              }}
              disabled={saving}
            >
              <RefreshCwIcon className="size-4" />
              Update now
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => setShowSystemStatus(true)}
              disabled={saving}
            >
              <ServerIcon className="size-4" />
              System status
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

  const mode: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
  const currentPresets = mode === 'dark' ? darkPresets : lightPresets;
  const currentPresetId = mode === 'dark' ? darkPresetId : lightPresetId;
  const setCurrentPreset = mode === 'dark' ? setDarkPreset : setLightPreset;

  return (
    <div className="space-y-4">

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className={titleClass}>Appearance</CardTitle>
              <CardDescription className={descriptionClass}>Each mode remembers its own colour scheme.</CardDescription>
            </div>
            {mounted && (
              <SegmentedControl
                aria-label="Appearance"
                options={[
                  { label: 'Light', value: 'light' },
                  { label: 'Dark', value: 'dark' },
                ]}
                value={mode}
                onChange={(next) => {
                  if (saving || next === mode) return;
                  setTheme(next);
                  onUpdate({ theme: next });
                }}
              />
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Theme style for the current mode */}
      {mounted && (
        <Card>
          <CardHeader>
            <CardTitle className={titleClass}>{mode === 'dark' ? 'Dark' : 'Light'} mode colours</CardTitle>
            <CardDescription className={descriptionClass}>
              Saved on this device and applied whenever you use {mode} mode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {currentPresets.map((preset) => {
                const selected = currentPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setCurrentPreset(preset.id)}
                    aria-pressed={selected}
                    className={cn(
                      'relative flex flex-col items-start gap-2.5 rounded-2xl p-2.5 text-left transition-colors',
                      selected ? 'bg-tint-orange' : 'bg-secondary hover:bg-accent'
                    )}
                  >
                    {/* Mini preview: canvas, a card on it, the accent */}
                    <div
                      aria-hidden
                      className="flex h-14 w-full items-end rounded-xl p-2 ring-1 ring-inset ring-black/5 dark:ring-white/10"
                      style={{ backgroundColor: `hsl(${preset.colors.background})` }}
                    >
                      <div
                        className="flex h-7 w-full items-center gap-1.5 rounded-lg px-2"
                        style={{ backgroundColor: `hsl(${preset.colors.card})` }}
                      >
                        <span className="h-2.5 w-8 rounded-full" style={{ backgroundColor: `hsl(${preset.colors.primary})` }} />
                        <span className="h-2 w-6 rounded-full" style={{ backgroundColor: `hsl(${preset.colors.accent})` }} />
                      </div>
                    </div>
                    <div className="px-0.5">
                      <div className="text-sm font-semibold">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                    </div>
                    {selected && (
                      <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <CheckIcon className="size-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <BellOffIcon className="size-8 text-muted-foreground" />
          <div>
            <h4 className="mb-1 font-semibold">Notifications aren&apos;t available yet</h4>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Price alerts, portfolio alerts and email or push notifications are planned for a future update.
            </p>
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

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  useEffect(() => {
    fetchUserData()
    load2FAStatus()
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

  const load2FAStatus = async () => {
    try {
      const response = await fetch('/api/auth/2fa/setup')
      if (response.ok) {
        const data = await response.json()
        setTwoFactorEnabled(data.enabled || false)
      }
    } catch (error) {
      console.error('Error loading 2FA status:', error)
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
    if (!(await confirm({ title: 'Remove PIN?', description: 'You will only be able to sign in with your password.', confirmText: 'Remove', destructive: true }))) {
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
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading account" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className={titleClass}>Profile</CardTitle>
          <CardDescription className={descriptionClass}>
            {userData?.createdAt
              ? `Member since ${new Date(userData.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'How you appear in the app.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              src={userData?.profilePicture}
              name={userData?.displayName || userData?.name}
              email={userData?.email}
              size="lg"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full font-semibold"
                  onClick={() => setShowAvatarModal(true)}
                  disabled={uploading}
                >
                  <CameraIcon className="size-4" />
                  {uploading ? 'Uploading...' : 'Change picture'}
                </Button>
                {userData?.profilePicture && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={saving}
                    className="rounded-full font-semibold text-tint-red-fg hover:bg-tint-red hover:text-tint-red-fg"
                  >
                    <TrashIcon className="size-4" />
                    Remove
                  </Button>
                )}
              </div>
              <p className={hintClass}>
                JPG, PNG or WebP, up to 5 MB.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Email */}
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userData?.email || ''}
                disabled
                className="lg:max-w-md"
              />
              <p className={hintClass}>Your email can&apos;t be changed.</p>
            </div>

            {/* Display Name */}
            <form onSubmit={handleUpdateDisplayName} className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <div className="flex gap-2">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="rounded-full font-semibold"
                  disabled={saving || displayName.trim() === (userData?.displayName || '')}
                >
                  Save
                </Button>
              </div>
              <p className={hintClass}>
                Shown in the header and around the app.
              </p>
            </form>

            {/* Full Name */}
            <form onSubmit={handleUpdateName} className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <div className="flex gap-2">
                <Input
                  id="fullName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="rounded-full font-semibold"
                  disabled={saving || !name.trim() || name === userData?.name}
                >
                  Save
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className={titleClass}>Password</CardTitle>
            <CardDescription className={descriptionClass}>At least 6 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Repeat new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="rounded-full font-semibold"
                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              >
                {saving ? 'Changing password...' : 'Change password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* PIN Settings */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className={titleClass}>PIN</CardTitle>
                <CardDescription className={descriptionClass}>
                  {userData?.hasPin
                    ? 'A PIN is set. You can sign in with it instead of your password.'
                    : 'A 4 to 6 digit PIN for signing in quickly.'}
                </CardDescription>
              </div>
              {userData?.hasPin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePin}
                  disabled={saving}
                  className="rounded-full font-semibold text-tint-red-fg hover:bg-tint-red hover:text-tint-red-fg"
                >
                  <TrashIcon className="size-4" />
                  Remove PIN
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPin">
                  {userData?.hasPin ? 'New PIN' : 'PIN'}
                </Label>
                <Input
                  id="newPin"
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••"
                  minLength={4}
                  maxLength={6}
                  className="text-center text-xl tracking-widest"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPin">Repeat PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
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
                className="rounded-full font-semibold"
                disabled={saving || !newPin || !confirmPin || newPin.length < 4}
              >
                {saving ? 'Saving PIN...' : (userData?.hasPin ? 'Change PIN' : 'Set PIN')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Two-Factor Authentication */}
      <TwoFactorSetup
        isEnabled={twoFactorEnabled}
        onStatusChange={load2FAStatus}
      />

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
