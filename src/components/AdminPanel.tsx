'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText, ThemedButton } from '@/components/ui/ThemeProvider';
import { UserIcon, ShieldCheckIcon, TrashIcon, PencilIcon, PlusIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface User {
  id: number;
  email: string;
  name: string | null;
  displayName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    transactions: number;
    customCurrencies: number;
  };
}

interface AdminStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
  };
  system: {
    totalTransactions: number;
    activeUsers: number;
  };
}

interface CreateUserForm {
  email: string;
  password: string;
  name: string;
  displayName: string;
  isAdmin: boolean;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    name: '',
    displayName: '',
    isAdmin: false
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/stats')
      ]);

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.data || []);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      showMessage('error', 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', 'User created successfully');
        setShowCreateForm(false);
        setCreateForm({ email: '', password: '', name: '', displayName: '', isAdmin: false });
        loadData();
      } else {
        showMessage('error', result.error || 'Failed to create user');
      }
    } catch (error) {
      showMessage('error', 'Failed to create user');
    }
  };

  const handleToggleUserStatus = async (userId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', `User ${!isActive ? 'activated' : 'deactivated'} successfully`);
        loadData();
      } else {
        showMessage('error', result.error || 'Failed to update user');
      }
    } catch (error) {
      showMessage('error', 'Failed to update user');
    }
  };

  const handleToggleAdmin = async (userId: number, isAdmin: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !isAdmin })
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', `Admin status ${!isAdmin ? 'granted' : 'revoked'} successfully`);
        loadData();
      } else {
        showMessage('error', result.error || 'Failed to update admin status');
      }
    } catch (error) {
      showMessage('error', 'Failed to update admin status');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', 'User deleted successfully');
        loadData();
      } else {
        showMessage('error', result.error || 'Failed to delete user');
      }
    } catch (error) {
      showMessage('error', 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-btc-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ThemedCard>
            <div className="p-6">
              <div className="flex items-center">
                <UserIcon className="h-10 w-10 text-btc-500" />
                <div className="ml-4 space-y-2">
                  <div>
                    <ThemedText variant="muted" size="sm" className="font-medium uppercase tracking-wide block">
                      Total Users
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText variant="primary" size="xl" className="font-bold block">
                      {stats.users.total}
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText variant="muted" size="sm" className="block">
                      {stats.users.active} active, {stats.users.admins} admins
                    </ThemedText>
                  </div>
                </div>
              </div>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-6">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-btc-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📊</span>
                </div>
                <div className="ml-4 space-y-2">
                  <div>
                    <ThemedText variant="muted" size="sm" className="font-medium uppercase tracking-wide block">
                      System Activity
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText variant="primary" size="xl" className="font-bold block">
                      {stats.system.totalTransactions}
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText variant="muted" size="sm" className="block">
                      Total transactions recorded
                    </ThemedText>
                  </div>
                </div>
              </div>
            </div>
          </ThemedCard>

          <ThemedCard>
            <div className="p-6">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <div className="ml-4 space-y-2">
                  <div>
                    <ThemedText variant="muted" size="sm" className="font-medium uppercase tracking-wide block">
                      Active Users
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText variant="primary" size="xl" className="font-bold block">
                      {stats.system.activeUsers}
                    </ThemedText>
                  </div>
                  <div>
                    <ThemedText variant="muted" size="sm" className="block">
                      Users with data
                    </ThemedText>
                  </div>
                </div>
              </div>
            </div>
          </ThemedCard>
        </div>
      )}

      {/* User Management */}
      <ThemedCard>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-btc-text-primary">User Management</h3>
            <ThemedButton
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add User</span>
            </ThemedButton>
          </div>

          {/* Create User Form */}
          {showCreateForm && (
            <div className="mb-8 p-6 border border-btc-border-secondary rounded-lg bg-btc-bg-secondary/30">
              <h4 className="text-lg font-semibold text-btc-text-primary mb-6">Create New User</h4>
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-btc-text-secondary mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-btc-border-secondary rounded-md bg-btc-background-primary text-btc-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-btc-text-secondary mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-btc-border-secondary rounded-md bg-btc-background-primary text-btc-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-btc-text-secondary mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-btc-border-secondary rounded-md bg-btc-background-primary text-btc-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-btc-text-secondary mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={createForm.displayName}
                      onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                      className="w-full px-3 py-2 border border-btc-border-secondary rounded-md bg-btc-background-primary text-btc-text-primary"
                    />
                  </div>
                </div>
                <div className="flex items-center p-3 bg-btc-bg-secondary rounded-lg">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={createForm.isAdmin}
                    onChange={(e) => setCreateForm({ ...createForm, isAdmin: e.target.checked })}
                    className="mr-3 h-4 w-4"
                  />
                  <label htmlFor="isAdmin" className="text-sm font-medium text-btc-text-secondary">
                    Grant admin privileges
                  </label>
                </div>
                <div className="flex space-x-3 pt-2">
                  <ThemedButton type="submit" className="px-6 py-2">Create User</ThemedButton>
                  <ThemedButton 
                    type="button" 
                    variant="secondary"
                    onClick={() => setShowCreateForm(false)}
                    className="px-6 py-2"
                  >
                    Cancel
                  </ThemedButton>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-btc-border-secondary">
                  <th className="text-left py-4 px-2 text-btc-text-secondary font-semibold">User</th>
                  <th className="text-left py-4 px-2 text-btc-text-secondary font-semibold">Status</th>
                  <th className="text-left py-4 px-2 text-btc-text-secondary font-semibold">Transactions</th>
                  <th className="text-left py-4 px-2 text-btc-text-secondary font-semibold">Created</th>
                  <th className="text-right py-4 px-2 text-btc-text-secondary font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-btc-border-secondary/50 hover:bg-btc-bg-secondary/50">
                    <td className="py-4 px-2">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-btc-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {user.displayName?.[0] || user.name?.[0] || user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center space-x-2 mb-1">
                            <ThemedText variant="primary" className="font-semibold">
                              {user.displayName || user.name || user.email}
                            </ThemedText>
                            {user.isAdmin && (
                              <ShieldCheckIcon className="h-4 w-4 text-yellow-500" title="Admin" />
                            )}
                          </div>
                          <ThemedText variant="muted" size="sm">{user.email}</ThemedText>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <ThemedText variant="primary" className="font-semibold">{user._count.transactions}</ThemedText>
                    </td>
                    <td className="py-4 px-2">
                      <ThemedText variant="muted" size="sm" className="font-medium">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </ThemedText>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                          className="p-2 rounded-lg text-btc-text-secondary hover:text-btc-text-primary hover:bg-btc-bg-secondary transition-colors"
                          title={user.isActive ? 'Deactivate user' : 'Activate user'}
                        >
                          {user.isActive ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                        {user.id !== 1 && (
                          <button
                            onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                            className="p-2 rounded-lg text-btc-text-secondary hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                            title={user.isAdmin ? 'Remove admin' : 'Make admin'}
                          >
                            <ShieldCheckIcon className="h-5 w-5" />
                          </button>
                        )}
                        {user.id !== 1 && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 rounded-lg text-btc-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete user"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ThemedCard>
    </div>
  );
}
