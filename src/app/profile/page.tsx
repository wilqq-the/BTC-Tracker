'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// Icons
import {
  MailIcon,
  DollarSignIcon,
  ShieldCheckIcon,
  LockIcon,
  KeyIcon,
  DownloadIcon,
  TrashIcon,
  LogOutIcon,
  CameraIcon,
  CheckIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  WalletIcon,
  SnowflakeIcon,
  FlameIcon,
  ArrowLeftRightIcon,
  EditIcon,
} from 'lucide-react';

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
      const response = await fetch('/api/portfolio-metrics?detailed=true');
      const result = await response.json();
      
      if (result.success && result.data) {
        const memberSince = session?.user?.email ? new Date().toISOString() : new Date().toISOString();
        
        setUserStats({
          memberSince,
          lastLogin: new Date().toISOString(),
          totalTransactions: result.data.totalTransactions || 0,
          firstTransaction: null,
          lastTransaction: null,
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
        loadUserData();
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
        loadUserData();
      } else {
        setPinError(result.error || 'Failed to remove PIN');
      }
    } catch (error) {
      setPinError('An error occurred while removing PIN');
    }
  };

  const handleAvatarChange = async () => {
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
          loadUserData();
        } else {
          console.error('Failed to upload avatar:', result.error);
        }
      } catch (error) {
        console.error('Error uploading avatar:', error);
      }
    };

    input.click();
  };

  const exportTransactions = async () => {
    try {
      const response = await fetch('/api/transactions/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bitcoin-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting transactions:', error);
    }
  };

  const getUserInitials = () => {
    if (userData?.displayName) {
      return userData.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (userData?.name) {
      return userData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (session?.user?.email) {
      return session.user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const netHoldings = (userStats?.totalBtcBought || 0) - (userStats?.totalBtcSold || 0);

  if (loading || status === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Profile</h1>
          <p className="text-muted-foreground">Manage your account and view your statistics</p>
        </div>

        {/* User Profile Card */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Avatar className="size-24 border-4 border-muted shadow-lg">
                    <AvatarImage src={userData?.profilePicture || ''} alt={userData?.displayName || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <button 
                    onClick={handleAvatarChange}
                    className="absolute -bottom-1 -right-1 size-8 bg-background border border-border rounded-full flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                  >
                    <CameraIcon className="size-4 text-muted-foreground" />
                  </button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={handleAvatarChange}>
                  <EditIcon className="size-3 mr-1" />
                  Change Photo
                </Button>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    {userData?.displayName || userData?.name || session?.user?.email?.split('@')[0] || 'User'}
                  </h2>
                  <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-1 mt-1">
                    <MailIcon className="size-4" />
                    {session?.user?.email || 'Not available'}
                  </p>
                </div>

                {/* Quick Stats Badges */}
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <Badge variant="secondary" className="gap-1">
                    <DollarSignIcon className="size-3" />
                    {userStats?.preferredCurrency || 'USD'}
                  </Badge>
                  <Badge className="bg-profit/10 text-profit border-profit/20 gap-1">
                    <div className="size-2 bg-profit rounded-full animate-pulse" />
                    Active
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRightIcon className="size-5" />
              Trading Statistics
            </CardTitle>
            <CardDescription>Your Bitcoin trading activity overview</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-muted/50 rounded-xl border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Transactions</p>
                <p className="text-3xl font-bold">{userStats?.totalTransactions || 0}</p>
              </div>
              
              <div className="text-center p-4 bg-profit/5 rounded-xl border border-profit/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-center gap-1">
                  <TrendingUpIcon className="size-3 text-profit" />
                  Total Bought
                </p>
                <p className="text-2xl font-bold font-mono text-profit">
                  {userStats?.totalBtcBought.toFixed(4) || '0.0000'} <span className="text-sm">₿</span>
                </p>
              </div>
              
              <div className="text-center p-4 bg-loss/5 rounded-xl border border-loss/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-center gap-1">
                  <TrendingDownIcon className="size-3 text-loss" />
                  Total Sold
                </p>
                <p className="text-2xl font-bold font-mono text-loss">
                  {userStats?.totalBtcSold.toFixed(4) || '0.0000'} <span className="text-sm">₿</span>
                </p>
              </div>
              
              <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-center gap-1">
                  <WalletIcon className="size-3 text-primary" />
                  Net Holdings
                </p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {netHoldings.toFixed(4)} <span className="text-sm">₿</span>
                </p>
              </div>
            </div>
            
            {/* Wallet Distribution */}
            {(userStats?.coldWalletBtc || 0) > 0 && netHoldings > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SnowflakeIcon className="size-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Cold Storage</span>
                    </div>
                    <Badge variant="outline" className="text-blue-600 border-blue-500/30">
                      {((userStats?.coldWalletBtc || 0) / netHoldings * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    {userStats?.coldWalletBtc.toFixed(8)} ₿
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(userStats?.coldWalletBtc || 0) / netHoldings * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FlameIcon className="size-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Hot Wallet</span>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-500/30">
                      {(Math.abs(userStats?.hotWalletBtc || 0) / netHoldings * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xl font-bold font-mono text-orange-600 dark:text-orange-400">
                    {Math.abs(userStats?.hotWalletBtc || 0).toFixed(8)} ₿
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-orange-500/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${Math.abs(userStats?.hotWalletBtc || 0) / netHoldings * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security & Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon className="size-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your account security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Password Section */}
              {!isChangingPassword ? (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-background rounded-full flex items-center justify-center border">
                      <LockIcon className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Password</p>
                      <p className="text-xs text-muted-foreground">Last changed: Never tracked</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        required
                      />
                    </div>
                    
                    {passwordError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                        <AlertCircleIcon className="size-4" />
                        {passwordError}
                      </div>
                    )}
                    
                    {passwordSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-profit/10 border border-profit/20 rounded-lg text-profit text-sm">
                        <CheckIcon className="size-4" />
                        {passwordSuccess}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button type="submit">Update Password</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          setPasswordError('');
                          setPasswordSuccess('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}
                
              {/* PIN Section */}
              {!isChangingPin ? (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-background rounded-full flex items-center justify-center border">
                      <KeyIcon className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">PIN Authentication</p>
                      <p className="text-xs text-muted-foreground">
                        {userData?.hasPin ? 'PIN is configured' : 'No PIN set'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsChangingPin(true)}>
                      {userData?.hasPin ? 'Change' : 'Set PIN'}
                    </Button>
                    {userData?.hasPin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePin}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                  <form onSubmit={handlePinChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPin">New PIN (4-6 digits)</Label>
                      <Input
                        id="newPin"
                        type="password"
                        value={pinData.newPin}
                        onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })}
                        placeholder="Enter 4-6 digit PIN"
                        maxLength={6}
                        className="text-center text-xl tracking-widest"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPin">Confirm PIN</Label>
                      <Input
                        id="confirmPin"
                        type="password"
                        value={pinData.confirmPin}
                        onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })}
                        placeholder="Confirm PIN"
                        maxLength={6}
                        className="text-center text-xl tracking-widest"
                        required
                      />
                    </div>
                    
                    {pinError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                        <AlertCircleIcon className="size-4" />
                        {pinError}
                      </div>
                    )}
                    
                    {pinSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-profit/10 border border-profit/20 rounded-lg text-profit text-sm">
                        <CheckIcon className="size-4" />
                        {pinSuccess}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button type="submit">{userData?.hasPin ? 'Update PIN' : 'Set PIN'}</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsChangingPin(false);
                          setPinData({ newPin: '', confirmPin: '' });
                          setPinError('');
                          setPinSuccess('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data & Session */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DownloadIcon className="size-5" />
                Data & Session
              </CardTitle>
              <CardDescription>Export transactions or manage your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Export Transactions */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-background rounded-full flex items-center justify-center border">
                    <DownloadIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Export Transactions</p>
                    <p className="text-xs text-muted-foreground">Download all your transactions as CSV</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={exportTransactions}>
                  Export
                </Button>
              </div>
              
              {/* Delete Account */}
              <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-destructive/10 rounded-full flex items-center justify-center">
                    <TrashIcon className="size-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-destructive">Delete Account</p>
                    <p className="text-xs text-muted-foreground">Permanently delete all your data</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  Delete
                </Button>
              </div>
              
              {/* Sign Out */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = '/api/auth/signout'}
                >
                  <LogOutIcon className="size-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
