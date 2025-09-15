'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import { AppSettings, CurrencySettings, PriceDataSettings, DisplaySettings, NotificationSettings } from '@/lib/types';
import { CurrencySettingsPanel, PriceDataSettingsPanel, DisplaySettingsPanel, NotificationSettingsPanel, UserAccountSettingsPanel } from '@/components/SettingsPanels';
import AppLayout from '@/components/AppLayout';

type SettingsTab = 'currency' | 'priceData' | 'display' | 'notifications' | 'account';

interface SettingsResponse {
  success: boolean;
  data: AppSettings;
  message: string;
  error?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('currency');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
      } else {
        showMessage('error', 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('error', 'Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (category: string, updates: any) => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category, updates }),
      });

      const result: SettingsResponse = await response.json();
      
      if (result.success) {
        setSettings(result.data);
        showMessage('success', result.message);
      } else {
        showMessage('error', result.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showMessage('error', 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
      });

      const result: SettingsResponse = await response.json();
      
      if (result.success) {
        setSettings(result.data);
        showMessage('success', 'Settings reset to defaults');
      } else {
        showMessage('error', 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      showMessage('error', 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <ThemedText variant="secondary">Loading settings...</ThemedText>
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <ThemedText variant="secondary">Failed to load settings</ThemedText>
        </div>
      </AppLayout>
    );
  }

  const tabs = [
    { id: 'account', label: 'Account' },
    { id: 'currency', label: 'Currency' },
    { id: 'priceData', label: 'Price Data' },
    { id: 'display', label: 'Display' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <AppLayout>
      {/* Message Bar */}
      {message && (
        <div className={`p-4 ${message.type === 'success' ? 'bg-profit' : 'bg-loss'} text-white`}>
          <div className="max-w-7xl mx-auto">
            <ThemedText className="text-white">
              {message.text}
            </ThemedText>
          </div>
        </div>
      )}

      {/* Settings Content with Secondary Sidebar */}
      <div className="flex flex-col lg:flex-row h-full">
        {/* Mobile Tab Navigation */}
        <div className="lg:hidden bg-btc-bg-secondary border-b border-btc-border-secondary p-4 overflow-x-auto">
          <div className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-bitcoin text-white'
                    : 'bg-btc-bg-tertiary text-btc-text-secondary hover:text-btc-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Desktop Settings Navigation Sidebar */}
        <div className="hidden lg:block w-64 bg-btc-bg-secondary border-r border-btc-border-secondary p-6 overflow-y-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-btc-text-primary">
                Settings
              </h2>
              <ThemedButton
                variant="secondary"
                size="sm"
                onClick={resetToDefaults}
                disabled={saving}
              >
                Reset
              </ThemedButton>
            </div>
            <ThemedText variant="muted" size="sm">
              Configure your Bitcoin tracker
            </ThemedText>
          </div>

          {/* Settings Navigation */}
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-btc-text-secondary hover:text-btc-text-primary hover:bg-btc-bg-tertiary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Settings Info */}
          <div className="mt-8 pt-6 border-t border-btc-border-secondary">
            <ThemedText variant="muted" size="sm">
              Settings are automatically saved when changed
            </ThemedText>
            {settings && (
              <div className="mt-2">
                <ThemedText variant="muted" size="xs">
                  Version: {settings.version}
                </ThemedText>
              </div>
            )}
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
        </div>
      </div>
    </AppLayout>
  );
} 