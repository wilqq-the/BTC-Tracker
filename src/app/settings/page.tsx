'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '@/lib/types';
import { CurrencySettingsPanel, PriceDataSettingsPanel, DisplaySettingsPanel, NotificationSettingsPanel, UserAccountSettingsPanel } from '@/components/SettingsPanels';
import AdminPanel from '@/components/AdminPanel';
import BackupRestorePanel from '@/components/BackupRestorePanel';
import ExchangeConnectionsPanel from '@/components/ExchangeConnectionsPanel';
import WalletsPanel from '@/components/WalletsPanel';
import ApiKeysPanel from '@/components/ApiKeysPanel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { UserIcon, DollarSignIcon, BarChart3Icon, MonitorIcon, ShieldIcon, ArrowLeftRightIcon, WalletIcon, KeyIcon, PlusIcon, DatabaseIcon, RotateCcwIcon } from 'lucide-react';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/hooks/use-toast';
import packageJson from '../../../package.json';

type SettingsTab = 'currency' | 'priceData' | 'display' | 'notifications' | 'account' | 'exchanges' | 'admin' | 'wallets' | 'apiKeys' | 'backup';

interface SettingsResponse {
  success: boolean;
  data: AppSettings;
  message: string;
  error?: string;
}

// Settings that POST /api/settings resets (the whole AppSettings record)
const RESETTABLE_TABS: SettingsTab[] = ['currency', 'priceData', 'display'];

/** Nearest ancestor that actually scrolls vertically. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  // Primary action for the encapsulated header, registered by the active panel
  const [headerAction, setHeaderAction] = useState<{ label: string; onClick: () => void } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Each tab opens at the top. The page itself doesn't scroll: the app shell is
  // h-screen overflow-hidden and AppLayout's <main> is the scroller, so
  // window.scrollTo would do nothing.
  useEffect(() => {
    const scroller = findScrollParent(rootRef.current);
    if (scroller && scroller.scrollTop > 0) scroller.scrollTop = 0;
  }, [activeTab]);

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
    const ok = await confirm({
      title: 'Reset settings to defaults?',
      description: 'Currency, price data and display settings go back to their defaults. Your account, wallets, transactions and API keys are not touched.',
      confirmText: 'Reset',
      destructive: true,
    });
    if (!ok) return;
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
      <div className="flex h-96 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading settings" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Settings couldn&apos;t load.</p>
        <p className="text-sm text-muted-foreground">Check that the server is running, then reload the page.</p>
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: 'account', label: 'Account', icon: UserIcon },
    { id: 'wallets', label: 'Wallets', icon: WalletIcon },
    { id: 'apiKeys', label: 'API access', icon: KeyIcon },
    { id: 'currency', label: 'Currency', icon: DollarSignIcon },
    { id: 'priceData', label: 'Price data', icon: BarChart3Icon },
    { id: 'exchanges', label: 'Exchanges', icon: ArrowLeftRightIcon },
    { id: 'display', label: 'Display', icon: MonitorIcon },
    ...(userData?.isAdmin ? [
      { id: 'backup' as const, label: 'Backup', icon: DatabaseIcon },
      { id: 'admin' as const, label: 'Admin', icon: ShieldIcon },
    ] : []),
  ];

  // Title + description for the page title row (reflects the active tab)
  const tabMeta: Record<SettingsTab, { title: string; description: string }> = {
    account: { title: 'Account', description: 'Your profile, password, PIN and two-factor sign-in.' },
    wallets: { title: 'Wallets', description: 'The cold storage and hot wallets your bitcoin lives in.' },
    apiKeys: { title: 'API access', description: 'Keys that let scripts and automations use your tracker.' },
    currency: { title: 'Currency', description: 'Which currencies your portfolio is calculated and shown in.' },
    priceData: { title: 'Price data', description: 'How bitcoin price history is collected and stored.' },
    exchanges: { title: 'Exchanges', description: 'Connect exchanges to import your trades automatically.' },
    display: { title: 'Display', description: 'Light or dark mode and the colour scheme for each.' },
    notifications: { title: 'Notifications', description: 'Price and portfolio alerts.' },
    admin: { title: 'Admin', description: 'Users on this server and what they can do.' },
    backup: { title: 'Backup', description: 'Download, restore and schedule full database backups.' },
  };
  const activeMeta = tabMeta[activeTab];
  const canReset = RESETTABLE_TABS.includes(activeTab);

  return (
    <div ref={rootRef} className="space-y-4 pb-6">
      {/* Title row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight">{activeMeta.title}</h1>
          <p className="text-[13px] text-muted-foreground">{activeMeta.description}</p>
        </div>
        {(headerAction || canReset) && (
          <div className="flex shrink-0 items-center gap-2">
            {canReset && (
              <Button variant="outline" size="sm" className="rounded-full bg-card font-semibold" onClick={resetToDefaults} disabled={saving}>
                <RotateCcwIcon className="mr-1.5 size-4" />
                Reset to defaults
              </Button>
            )}
            {headerAction && (
              <Button size="sm" className="rounded-full font-semibold" onClick={headerAction.onClick}>
                <PlusIcon className="mr-1.5 size-4" />
                {headerAction.label}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        {/* Settings menu: horizontal scroller on phones, a column on desktop */}
        <Card className="w-full gap-0 rounded-2xl p-1.5 lg:sticky lg:top-0 lg:w-56 lg:shrink-0 lg:p-2">
          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors lg:w-full lg:py-2.5',
                    isActive
                      ? 'bg-tint-orange text-primary-strong'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-3 hidden space-y-1 border-t border-border/60 px-3 pb-1 pt-3 text-xs text-muted-foreground lg:block">
            <p>Changes save automatically.</p>
            <p className="tabular-nums">Version {packageJson.version}</p>
          </div>
        </Card>

        {/* Active tab content */}
        <div className="w-full min-w-0 flex-1">
          {activeTab === 'account' && <UserAccountSettingsPanel />}

          {activeTab === 'wallets' && <WalletsPanel onHeaderAction={setHeaderAction} />}

          {activeTab === 'apiKeys' && <ApiKeysPanel onHeaderAction={setHeaderAction} />}

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

          {activeTab === 'exchanges' && <ExchangeConnectionsPanel onHeaderAction={setHeaderAction} />}

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

          {activeTab === 'backup' && userData?.isAdmin && <BackupRestorePanel />}

          {activeTab === 'admin' && userData?.isAdmin && <AdminPanel onHeaderAction={setHeaderAction} />}
        </div>
      </div>
    </div>
  );
}
