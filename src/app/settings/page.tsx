'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/types';
import { CurrencySettingsPanel, PriceDataSettingsPanel, DisplaySettingsPanel, NotificationSettingsPanel, UserAccountSettingsPanel } from '@/components/SettingsPanels';
import AdminPanel from '@/components/AdminPanel';
import ExchangeConnectionsPanel from '@/components/ExchangeConnectionsPanel';
import WalletsPanel from '@/components/WalletsPanel';
import ApiKeysPanel from '@/components/ApiKeysPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingsIcon, UserIcon, DollarSignIcon, BarChart3Icon, MonitorIcon, BellIcon, ShieldIcon, ArrowLeftRightIcon, WalletIcon, KeyIcon, PlusIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import packageJson from '../../../package.json';

type SettingsTab = 'currency' | 'priceData' | 'display' | 'notifications' | 'account' | 'exchanges' | 'admin' | 'wallets' | 'apiKeys';

interface SettingsResponse {
  success: boolean;
  data: AppSettings;
  message: string;
  error?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  // Primary action for the encapsulated header, registered by the active panel
  const [headerAction, setHeaderAction] = useState<{ label: string; onClick: () => void } | null>(null);

  useEffect(() => {
    loadSettings();
    loadUserData();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
      } else {
        toast({ title: 'Failed to load settings', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({ title: 'Error loading settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const updateSettings = async (category: string, updates: any) => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, updates }),
      });

      const result: SettingsResponse = await response.json();
      
      if (result.success) {
        setSettings(result.data);
        toast({ title: 'Settings saved' });
      } else {
        toast({ title: result.error || 'Failed to update settings', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({ title: 'Failed to update settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', { method: 'POST' });
      const result: SettingsResponse = await response.json();
      
      if (result.success) {
        setSettings(result.data);
        toast({ title: 'Settings reset to defaults' });
      } else {
        toast({ title: 'Failed to reset settings', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast({ title: 'Failed to reset settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Failed to load settings</p>
        </div>
    );
  }

  const tabs = [
    { id: 'account', label: 'Account', icon: UserIcon },
    { id: 'wallets', label: 'Wallets', icon: WalletIcon },
    { id: 'apiKeys', label: 'API Access', icon: KeyIcon },
    { id: 'currency', label: 'Currency', icon: DollarSignIcon },
    { id: 'priceData', label: 'Price Data', icon: BarChart3Icon },
    { id: 'exchanges', label: 'Exchanges', icon: ArrowLeftRightIcon },
    { id: 'display', label: 'Display', icon: MonitorIcon },
    ...(userData?.isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldIcon }] : [])
  ];

  // Title + description for the single encapsulated header (reflects the active tab)
  const tabMeta: Record<string, { title: string; description: string }> = {
    account: { title: 'Account', description: 'Manage your account information and security' },
    wallets: { title: 'Wallets', description: 'Manage your cold and hot storage wallets' },
    apiKeys: { title: 'API Access', description: 'Manage API keys for automation integrations' },
    currency: { title: 'Currency', description: 'Configure currencies for your portfolio' },
    priceData: { title: 'Price Data', description: 'Configure how Bitcoin price data is collected and stored' },
    exchanges: { title: 'Exchanges', description: 'Connect exchanges to auto-sync your trades' },
    display: { title: 'Display', description: 'Customize the appearance of your tracker' },
    admin: { title: 'Admin', description: 'Manage users and system settings' },
  };
  const activeMeta = tabMeta[activeTab] ?? { title: 'Settings', description: 'Configure your Bitcoin tracker' };

  return (
      <div className="px-3 pt-0 pb-6">
        {/* Encapsulated header */}
        <div className="glass-widget rounded-2xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{activeMeta.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{activeMeta.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerAction && (
              <Button size="sm" onClick={headerAction.onClick}>
                <PlusIcon className="size-4 mr-1" />
                {headerAction.label}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={resetToDefaults} disabled={saving}>
              Reset to Defaults
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 items-start">
          {/* Mobile Tab Navigation — glass segmented control */}
          <div className="lg:hidden w-full glass-widget rounded-2xl p-1.5 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    )}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Settings Navigation — floating glass sidebar */}
          <div className="hidden lg:flex w-60 shrink-0 flex-col glass-widget rounded-2xl p-3 lg:sticky lg:top-0">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                    )}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 pt-4 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground text-center">Settings auto-save on change</p>
              <p className="text-xs text-muted-foreground text-center">
                Version: {packageJson.version}{packageJson.version.includes('69') && ' 😏'}
              </p>
            </div>
          </div>

          {/* Main Settings Content — open canvas */}
          <div className="flex-1 min-w-0">
          {activeTab === 'account' && (
            <UserAccountSettingsPanel />
          )}

          {activeTab === 'wallets' && (
            <WalletsPanel onHeaderAction={setHeaderAction} />
          )}

          {activeTab === 'apiKeys' && (
            <ApiKeysPanel onHeaderAction={setHeaderAction} />
          )}

          {activeTab === 'currency' && (
            <CurrencySettingsPanel
              settings={settings.currency}
              onUpdate={(updates: any) => updateSettings('currency', updates)}
              saving={saving}
            />
          )}
          
          {activeTab === 'priceData' && (
            <PriceDataSettingsPanel
              settings={settings.priceData}
              onUpdate={(updates: any) => updateSettings('priceData', updates)}
              saving={saving}
            />
          )}
          
          {activeTab === 'exchanges' && (
            <ExchangeConnectionsPanel onHeaderAction={setHeaderAction} />
          )}

          {activeTab === 'display' && (
            <DisplaySettingsPanel
              settings={settings.display}
              onUpdate={(updates: any) => updateSettings('display', updates)}
              saving={saving}
            />
          )}
          
          {activeTab === 'notifications' && (
            <NotificationSettingsPanel
              settings={settings.notifications}
              onUpdate={(updates: any) => updateSettings('notifications', updates)}
              saving={saving}
            />
          )}

          {activeTab === 'admin' && userData?.isAdmin && (
            <AdminPanel />
          )}
          </div>
        </div>
      </div>
  );
}
