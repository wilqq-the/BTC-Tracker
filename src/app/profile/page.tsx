'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import { formatCurrency } from '@/lib/theme';

interface UserStats {
  memberSince: string;
  lastLogin: string;
  totalTransactions: number;
  firstTransaction: string | null;
  lastTransaction: string | null;
  preferredCurrency: string;
  totalBtcBought: number;
  totalBtcSold: number;
  coldWalletBtc: number;
  hotWalletBtc: number;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [pinData, setPinData] = useState({
    newPin: '',
    confirmPin: ''
  });
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      loadUserStats();
      loadUserData();
    }
  }, [status, router]);

  const loadUserStats = async () => {
    try {
      // Load portfolio metrics for user stats
      const response = await fetch('/api/portfolio-metrics?detailed=true');
      const result = await response.json();
      
      if (result.success && result.data) {
        // Get user creation date from session or set a default
        const memberSince = session?.user?.email ? new Date().toISOString() : new Date().toISOString();
        
        setUserStats({
          memberSince,
          lastLogin: new Date().toISOString(),
          totalTransactions: result.data.totalTransactions || 0,
          firstTransaction: null, // Would need to fetch from transactions
          lastTransaction: null, // Would need to fetch from transactions
          preferredCurrency: result.data.mainCurrency || 'USD',
          totalBtcBought: result.data.totalBtcBought || 0,
          totalBtcSold: result.data.totalBtcSold || 0,
          coldWalletBtc: result.data.coldWalletBtc || 0,
          hotWalletBtc: result.data.hotWalletBtc || 0
        });
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const result = await response.json();

      if (response.ok) {
        setPasswordSuccess('Password changed successfully!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setIsChangingPassword(false);
      } else {
        setPasswordError(result.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('An error occurred while changing password');
    }
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    if (pinData.newPin !== pinData.confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    if (!/^\d{4,6}$/.test(pinData.newPin)) {
      setPinError('PIN must be 4-6 digits');
      return;
    }

    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_pin',
          newPin: pinData.newPin
        })
      });

      const result = await response.json();

      if (response.ok) {
        setPinSuccess('PIN updated successfully!');
        setPinData({ newPin: '', confirmPin: '' });
        setIsChangingPin(false);
        loadUserData(); // Refresh user data
      } else {
        setPinError(result.error || 'Failed to update PIN');
      }
    } catch (error) {
      setPinError('An error occurred while updating PIN');
    }
  };

  const handleRemovePin = async () => {
    if (!confirm('Are you sure you want to remove your PIN?')) return;

    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_pin'
        })
      });

      const result = await response.json();

      if (response.ok) {
        setPinSuccess('PIN removed successfully!');
        loadUserData(); // Refresh user data
      } else {
        setPinError(result.error || 'Failed to remove PIN');
      }
    } catch (error) {
      setPinError('An error occurred while removing PIN');
    }
  };

  const handleAvatarChange = async () => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('avatar', file);

      try {
        const response = await fetch('/api/user/avatar', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (response.ok) {
          loadUserData(); // Refresh user data to get new avatar
        } else {
          console.error('Failed to upload avatar:', result.error);
        }
      } catch (error) {
        console.error('Error uploading avatar:', error);
      }
    };

    input.click();
  };

  const exportUserData = async () => {
    try {
      const response = await fetch('/api/user/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `btc-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  if (loading || status === 'loading') {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center">
          <ThemedText>Loading profile...</ThemedText>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-btc-text-primary mb-1">
            Profile
          </h1>
          <ThemedText variant="muted" size="sm">
            Manage your account and preferences
          </ThemedText>
        </div>

        {/* User Card */}
        <ThemedCard>
          <div className="p-4">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {userData?.profilePicture ? (
                    <img 
                      src={userData.profilePicture} 
                      alt="Profile" 
                      className="h-16 w-16 rounded-full object-cover border-2 border-btc-border-secondary"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gradient-to-br from-btc-500 to-btc-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xl font-bold">
                        {session?.user?.name?.[0] || session?.user?.email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  <button 
                    onClick={handleAvatarChange}
                    className="absolute -bottom-1 -right-1 h-6 w-6 bg-btc-bg-primary border border-btc-border-secondary rounded-full flex items-center justify-center hover:bg-btc-bg-secondary transition-colors"
                  >
                    <span className="text-xs">✏️</span>
                  </button>
                </div>
                <ThemedButton 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-btc-text-muted py-1"
                  onClick={handleAvatarChange}
                >
                  Change
                </ThemedButton>
              </div>

              {/* User Info */}
              <div className="flex-1 space-y-3">
                <div>
                  <ThemedText variant="primary" className="text-xl font-bold">
                    {session?.user?.name || session?.user?.email?.split('@')[0] || 'User'}
                  </ThemedText>
                  <ThemedText variant="muted" size="xs" className="block">
                    {session?.user?.email || 'Not available'}
                  </ThemedText>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-2 bg-btc-bg-secondary/30 rounded">
                    <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-1">
                      Joined
                    </ThemedText>
                    <ThemedText variant="primary" size="sm" className="font-semibold block">
                      {userStats ? new Date(userStats.memberSince).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short'
                      }) : 'N/A'}
                    </ThemedText>
                  </div>
                  
                  <div className="p-2 bg-btc-bg-secondary/30 rounded">
                    <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-1">
                      Currency
                    </ThemedText>
                    <ThemedText variant="primary" size="sm" className="font-semibold block">
                      {userStats?.preferredCurrency || 'USD'}
                    </ThemedText>
                  </div>

                  <div className="p-2 bg-btc-bg-secondary/30 rounded">
                    <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-1">
                      Type
                    </ThemedText>
                    <ThemedText variant="primary" size="sm" className="font-semibold block">
                      Self-Hosted
                    </ThemedText>
                  </div>

                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-1">
                      Status
                    </ThemedText>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <ThemedText variant="primary" size="sm" className="font-semibold text-green-600 dark:text-green-400">
                        Active
                      </ThemedText>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ThemedCard>

        {/* Trading Statistics */}
        <ThemedCard>
          <div className="p-4">
            <h2 className="text-lg font-semibold text-btc-text-primary mb-3">
              Trading Statistics
            </h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-btc-bg-secondary rounded-lg border border-btc-border-secondary">
                <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-2">
                  Transactions
                </ThemedText>
                <ThemedText variant="primary" className="text-2xl font-bold block">
                  {userStats?.totalTransactions || 0}
                </ThemedText>
              </div>
              
              <div className="text-center p-3 bg-btc-bg-secondary rounded-lg border border-btc-border-secondary">
                <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-2">
                  Bought
                </ThemedText>
                <ThemedText variant="primary" className="text-lg font-bold block font-mono">
                  {userStats?.totalBtcBought.toFixed(4) || '0.0000'}
                </ThemedText>
              </div>
              
              <div className="text-center p-3 bg-btc-bg-secondary rounded-lg border border-btc-border-secondary">
                <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-2">
                  Sold
                </ThemedText>
                <ThemedText variant="primary" className="text-lg font-bold block font-mono">
                  {userStats?.totalBtcSold.toFixed(4) || '0.0000'}
                </ThemedText>
              </div>
              
              <div className="text-center p-3 bg-btc-bg-secondary rounded-lg border border-btc-border-secondary">
                <ThemedText variant="muted" size="xs" className="uppercase tracking-wide block mb-2">
                  Net Holdings
                </ThemedText>
                <ThemedText variant="primary" className="text-lg font-bold block font-mono">
                  {((userStats?.totalBtcBought || 0) - (userStats?.totalBtcSold || 0)).toFixed(4)}
                </ThemedText>
              </div>
            </div>
            
            {/* Cold/Hot Wallet Distribution */}
            {(userStats?.coldWalletBtc || 0) > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <ThemedText variant="muted" size="xs" className="uppercase tracking-wide text-blue-700 dark:text-blue-300">
                        Cold Wallet
                      </ThemedText>
                    </div>
                    <ThemedText variant="muted" size="xs" className="text-blue-600 dark:text-blue-400">
                      {((userStats?.coldWalletBtc || 0) / ((userStats?.totalBtcBought || 0) - (userStats?.totalBtcSold || 0)) * 100).toFixed(0)}%
                    </ThemedText>
                  </div>
                  <ThemedText variant="primary" className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                    {userStats?.coldWalletBtc.toFixed(8)} ₿
                  </ThemedText>
                </div>
                
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <ThemedText variant="muted" size="xs" className="uppercase tracking-wide text-orange-700 dark:text-orange-300">
                        Hot Wallet
                      </ThemedText>
                    </div>
                    <ThemedText variant="muted" size="xs" className="text-orange-600 dark:text-orange-400">
                      {(Math.abs(userStats?.hotWalletBtc || 0) / ((userStats?.totalBtcBought || 0) - (userStats?.totalBtcSold || 0)) * 100).toFixed(0)}%
                    </ThemedText>
                  </div>
                  <ThemedText variant="primary" className="text-base font-bold font-mono text-orange-600 dark:text-orange-400">
                    {Math.abs(userStats?.hotWalletBtc || 0).toFixed(8)} ₿
                  </ThemedText>
                </div>
              </div>
            )}
          </div>
        </ThemedCard>

        {/* Security & Data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Security Settings */}
          <ThemedCard>
            <div className="p-4">
              <h2 className="text-lg font-semibold text-btc-text-primary mb-3">
                Security
              </h2>
            
            {!isChangingPassword ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 bg-btc-bg-secondary rounded-lg border border-btc-border-secondary">
                  <div className="flex-1 min-w-0">
                    <ThemedText variant="primary" className="font-semibold text-sm block mb-1">
                      Password
                    </ThemedText>
                    <ThemedText variant="muted" size="xs" className="block">
                      Last changed: Never tracked
                    </ThemedText>
                  </div>
                  <ThemedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsChangingPassword(true)}
                    className="text-xs py-1 px-3 flex-shrink-0"
                  >
                    Change
                  </ThemedButton>
                </div>
                
                <div className="flex items-center justify-between gap-3 p-3 bg-btc-bg-secondary rounded-lg border border-btc-border-secondary">
                  <div className="flex-1 min-w-0">
                    <ThemedText variant="primary" className="font-semibold text-sm block mb-1">
                      PIN Authentication
                    </ThemedText>
                    <ThemedText variant="muted" size="xs" className="block">
                      {userData?.hasPin ? 'PIN is set' : 'No PIN set'}
                    </ThemedText>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <ThemedButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsChangingPin(true)}
                      className="text-xs py-1 px-3"
                    >
                      {userData?.hasPin ? 'Change' : 'Set'}
                    </ThemedButton>
                    {userData?.hasPin && (
                      <ThemedButton
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePin}
                        className="text-red-500 hover:text-red-600 text-xs py-1 px-2"
                      >
                        Remove
                      </ThemedButton>
                    )}
                  </div>
                </div>

                {/* PIN Change Form */}
                {isChangingPin && (
                  <div className="p-6 bg-btc-bg-secondary/30 rounded-lg">
                    <form onSubmit={handlePinChange} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-btc-text-secondary mb-3">
                          New PIN (4-6 digits)
                        </label>
                        <input
                          type="password"
                          value={pinData.newPin}
                          onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })}
                          className="w-full px-4 py-3 bg-btc-bg-primary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-btc-500 focus:border-transparent"
                          placeholder="Enter 4-6 digit PIN"
                          maxLength={6}
                          pattern="[0-9]*"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-btc-text-secondary mb-3">
                          Confirm PIN
                        </label>
                        <input
                          type="password"
                          value={pinData.confirmPin}
                          onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })}
                          className="w-full px-4 py-3 bg-btc-bg-primary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-btc-500 focus:border-transparent"
                          placeholder="Confirm PIN"
                          maxLength={6}
                          pattern="[0-9]*"
                          required
                        />
                      </div>
                      
                      {pinError && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <ThemedText variant="primary" className="text-red-700 dark:text-red-300 font-medium">
                            {pinError}
                          </ThemedText>
                        </div>
                      )}
                      
                      {pinSuccess && (
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <ThemedText variant="primary" className="text-green-700 dark:text-green-300 font-medium">
                            {pinSuccess}
                          </ThemedText>
                        </div>
                      )}
                      
                      <div className="flex gap-4 pt-4">
                        <ThemedButton type="submit" variant="primary" className="px-6 py-2">
                          {userData?.hasPin ? 'Update PIN' : 'Set PIN'}
                        </ThemedButton>
                        <ThemedButton
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setIsChangingPin(false);
                            setPinData({ newPin: '', confirmPin: '' });
                            setPinError('');
                            setPinSuccess('');
                          }}
                          className="px-6 py-2"
                        >
                          Cancel
                        </ThemedButton>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-btc-bg-secondary/30 rounded-lg">
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-btc-text-secondary mb-3">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-btc-bg-primary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-btc-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-btc-text-secondary mb-3">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-btc-bg-primary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-btc-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-btc-text-secondary mb-3">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-btc-bg-primary border border-btc-border-primary rounded-lg text-btc-text-primary focus:ring-2 focus:ring-btc-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  {passwordError && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <ThemedText variant="primary" className="text-red-700 dark:text-red-300 font-medium">
                        {passwordError}
                      </ThemedText>
                    </div>
                  )}
                  
                  {passwordSuccess && (
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <ThemedText variant="primary" className="text-green-700 dark:text-green-300 font-medium">
                        {passwordSuccess}
                      </ThemedText>
                    </div>
                  )}
                  
                  <div className="flex gap-4 pt-4">
                    <ThemedButton type="submit" variant="primary" className="px-6 py-2">
                      Update Password
                    </ThemedButton>
                    <ThemedButton
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordError('');
                        setPasswordSuccess('');
                      }}
                      className="px-6 py-2"
                    >
                      Cancel
                    </ThemedButton>
                  </div>
                </form>
              </div>
            )}
          </div>
        </ThemedCard>

          {/* Data Management */}
          <ThemedCard>
            <div className="p-4">
              <h2 className="text-lg font-semibold text-btc-text-primary mb-3">
                Data & Session
              </h2>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 bg-btc-bg-secondary rounded-lg border border-btc-border-secondary">
                  <div className="flex-1 min-w-0">
                    <ThemedText variant="primary" className="font-semibold text-sm block mb-1">
                      Export Data
                    </ThemedText>
                    <ThemedText variant="muted" size="xs" className="block">
                      Download transactions & settings
                    </ThemedText>
                  </div>
                  <ThemedButton
                    variant="secondary"
                    size="sm"
                    onClick={exportUserData}
                    className="text-xs py-1 px-3 flex-shrink-0"
                  >
                    Export
                  </ThemedButton>
                </div>
                
                <div className="flex items-center justify-between gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex-1 min-w-0">
                    <ThemedText variant="primary" className="font-semibold text-sm text-red-700 dark:text-red-300 block mb-1">
                      Delete Account
                    </ThemedText>
                    <ThemedText variant="muted" size="xs" className="text-red-600 dark:text-red-400 block">
                      Permanently delete all data
                    </ThemedText>
                  </div>
                  <ThemedButton
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 text-xs py-1 px-3 flex-shrink-0"
                  >
                    Delete
                  </ThemedButton>
                </div>
                
                <div className="pt-3 border-t border-btc-border-secondary">
                  <ThemedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.href = '/api/auth/signout'}
                    className="w-full"
                  >
                    Sign Out
                  </ThemedButton>
                </div>
              </div>
            </div>
          </ThemedCard>
        </div>
      </div>
    </AppLayout>
  );
}