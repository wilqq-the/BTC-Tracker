'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserIcon, ShieldCheckIcon, TrashIcon, PlusIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';

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
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/users?include_inactive=true'),
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
      toast({ title: 'Failed to load admin data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
        toast({ title: 'User created successfully' });
        setShowCreateForm(false);
        setCreateForm({ email: '', password: '', name: '', displayName: '', isAdmin: false });
        loadData();
      } else {
        toast({ title: result.error || 'Failed to create user', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to create user', variant: 'destructive' });
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
        toast({ title: `User ${!isActive ? 'activated' : 'deactivated'} successfully` });
        loadData();
      } else {
        toast({ title: result.error || 'Failed to update user', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to update user', variant: 'destructive' });
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
        toast({ title: `Admin status ${!isAdmin ? 'granted' : 'revoked'} successfully` });
        loadData();
      } else {
        toast({ title: result.error || 'Failed to update admin status', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to update admin status', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!(await confirm({ title: 'Delete user?', description: 'This action cannot be undone.', confirmText: 'Delete', destructive: true }))) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'User deleted successfully' });
        loadData();
      } else {
        toast({ title: result.error || 'Failed to delete user', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to delete user', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserIcon className="h-10 w-10 text-primary" />
                <div className="ml-4 space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide block">
                      Total Users
                    </span>
                  </div>
                  <div>
                    <span className="text-xl text-foreground font-bold block tabular-nums">
                      {stats.users.total}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground block">
                      {stats.users.active} active, {stats.users.admins} admins
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📊</span>
                </div>
                <div className="ml-4 space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide block">
                      System Activity
                    </span>
                  </div>
                  <div>
                    <span className="text-xl text-foreground font-bold block tabular-nums">
                      {stats.system.totalTransactions}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground block">
                      Total transactions recorded
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <div className="ml-4 space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide block">
                      Active Users
                    </span>
                  </div>
                  <div>
                    <span className="text-xl text-foreground font-bold block tabular-nums">
                      {stats.system.activeUsers}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground block">
                      Users with data
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Management */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-foreground">User Management</h3>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add User</span>
            </Button>
          </div>

          {/* Create User Form */}
          {showCreateForm && (
            <div className="mb-8 p-6 bg-muted/50 rounded-2xl">
              <h4 className="text-lg font-semibold text-foreground mb-6">Create New User</h4>
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={createForm.displayName}
                      onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                </div>
                <div className="flex items-center p-3 bg-muted/50 rounded-2xl">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={createForm.isAdmin}
                    onChange={(e) => setCreateForm({ ...createForm, isAdmin: e.target.checked })}
                    className="mr-3 h-4 w-4"
                  />
                  <label htmlFor="isAdmin" className="text-sm font-medium text-muted-foreground">
                    Grant admin privileges
                  </label>
                </div>
                <div className="flex space-x-3 pt-2">
                  <Button type="submit" className="px-6 py-2">Create User</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    className="px-6 py-2"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-4 px-2 text-muted-foreground font-semibold">User</th>
                  <th className="text-left py-4 px-2 text-muted-foreground font-semibold">Status</th>
                  <th className="text-left py-4 px-2 text-muted-foreground font-semibold">Transactions</th>
                  <th className="text-left py-4 px-2 text-muted-foreground font-semibold">Created</th>
                  <th className="text-right py-4 px-2 text-muted-foreground font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-4 px-2">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {user.displayName?.[0] || user.name?.[0] || user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-foreground font-semibold">
                              {user.displayName || user.name || user.email}
                            </span>
                            {user.isAdmin && (
                              <ShieldCheckIcon className="h-4 w-4 text-yellow-500" title="Admin" />
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">{user.email}</span>
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
                      <span className="text-foreground font-semibold tabular-nums">{user._count.transactions}</span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-sm text-muted-foreground font-medium tabular-nums">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                            className="p-2 rounded-lg text-muted-foreground hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                            title={user.isAdmin ? 'Remove admin' : 'Make admin'}
                          >
                            <ShieldCheckIcon className="h-5 w-5" />
                          </button>
                        )}
                        {user.id !== 1 && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
        </CardContent>
      </Card>
    </div>
  );
}
