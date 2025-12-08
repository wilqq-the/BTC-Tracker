'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/types';
import { CurrencySettingsPanel, PriceDataSettingsPanel, DisplaySettingsPanel, NotificationSettingsPanel, UserAccountSettingsPanel } from '@/components/SettingsPanels';
import AdminPanel from '@/components/AdminPanel';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingsIcon, UserIcon, DollarSignIcon, BarChart3Icon, MonitorIcon, BellIcon, ShieldIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import packageJson from '../../../package.json';

type SettingsTab = 'currency' | 'priceData' | 'display' | 'notifications' | 'account' | 'admin';

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
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Failed to load settings</p>
        </div>
      </AppLayout>
    );
  }

  const tabs = [
    { id: 'account', label: 'Account', icon: UserIcon },
    { id: 'currency', label: 'Currency', icon: DollarSignIcon },
    { id: 'priceData', label: 'Price Data', icon: BarChart3Icon },
    { id: 'display', label: 'Display', icon: MonitorIcon },
    ...(userData?.isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldIcon }] : [])
  ];

  return (
    <AppLayout>
      {/* Settings Content with Secondary Sidebar */}
      <div className="flex flex-col lg:flex-row h-full">
        {/* Mobile Tab Navigation */}
        <div className="lg:hidden bg-card border-b p-4 overflow-x-auto">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className="whitespace-nowrap"
                >
                  <Icon className="size-4 mr-2" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>
        
        {/* Desktop Settings Navigation Sidebar */}
        <div className="hidden lg:block w-64 bg-card border-r p-6 overflow-y-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <SettingsIcon className="size-5" />
                Settings
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure your Bitcoin tracker
            </p>
          </div>

          {/* Settings Navigation */}
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Settings Footer */}
          <div className="mt-8 pt-6 border-t space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={saving}
              className="w-full"
            >
              Reset to Defaults
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Settings auto-save on change
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Version: {packageJson.version}
            </p>
          </div>
        </div>

        {/* Main Settings Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {activeTab === 'account' && (
            <UserAccountSettingsPanel />
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
    </AppLayout>
  );
}
