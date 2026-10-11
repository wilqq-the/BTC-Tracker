'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheckIcon, ShieldOffIcon, TrashIcon, UserCheckIcon, UserXIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface AdminPanelProps {
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function AdminPanel({ onHeaderAction }: AdminPanelProps) {
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

  // Surface the primary action in the settings page title row
  useEffect(() => {
    onHeaderAction?.({ label: 'Add user', onClick: () => setShowCreateForm(true) });
    return () => onHeaderAction?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        toast({ title: 'User created' });
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
        toast({ title: !isActive ? 'User activated' : 'User deactivated' });
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
        toast({ title: !isAdmin ? 'Admin rights granted' : 'Admin rights removed' });
        loadData();
      } else {
        toast({ title: result.error || 'Failed to update admin status', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to update admin status', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const user = users.find((u) => u.id === userId);
    const who = user ? (user.displayName || user.name || user.email) : 'this user';
    if (!(await confirm({ title: `Delete ${who}?`, description: 'Their account and all of their transactions are deleted. This can’t be undone.', confirmText: 'Delete', destructive: true }))) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'User deleted' });
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
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading users" />
      </div>
    );
  }

  const figures = stats
    ? [
        {
          label: 'Users',
          value: stats.users.total,
          note: `${plural(stats.users.active, 'active', 'active')}, ${plural(stats.users.admins, 'admin', 'admins')}`,
        },
        { label: 'Users with data', value: stats.system.activeUsers, note: 'Have at least one transaction' },
        { label: 'Transactions', value: stats.system.totalTransactions, note: 'Recorded across all users' },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Figures */}
      {stats && (
        <Card>
          <CardContent>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {figures.map((f) => (
                <div key={f.label}>
                  <dt className="text-[13px] font-semibold text-muted-foreground">{f.label}</dt>
                  <dd className={cn('mt-1 text-2xl font-extrabold tracking-tight tabular-nums', f.value === 0 && 'text-muted-foreground')}>
                    {f.value.toLocaleString()}
                  </dd>
                  <dd className="text-xs text-muted-foreground">{f.note}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">New user</CardTitle>
            <CardDescription className="text-[13px]">They can sign in with this email and password straight away.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="newUserEmail">Email</Label>
                  <Input
                    id="newUserEmail"
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newUserPassword">Password</Label>
                  <Input
                    id="newUserPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newUserName">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="newUserName"
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newUserDisplayName">Display name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="newUserDisplayName"
                    type="text"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  />
                </div>
              </div>
              <label htmlFor="isAdmin" className="flex cursor-pointer items-center gap-3 rounded-2xl bg-secondary p-3">
                <Checkbox
                  id="isAdmin"
                  checked={createForm.isAdmin}
                  onCheckedChange={(checked) => setCreateForm({ ...createForm, isAdmin: checked === true })}
                />
                <span className="text-sm font-semibold">Make this user an admin</span>
              </label>
              <div className="flex gap-2">
                <Button type="submit" className="rounded-full font-semibold">Create user</Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full font-semibold"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users */}
      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Users</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <ul className="divide-y divide-border/60">
            {users.map((user) => {
              const name = user.displayName || user.name || user.email;
              const initial = (user.displayName?.[0] || user.name?.[0] || user.email[0]).toUpperCase();
              const isOwner = user.id === 1;
              return (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className={cn('flex min-w-0 items-center gap-3', !user.isActive && 'opacity-60')}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint-orange text-sm font-bold text-primary-strong">
                      {initial}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-semibold">{name}</span>
                        {user.isAdmin && (
                          <span className="rounded-full bg-tint-purple px-2 py-0.5 text-xs font-semibold text-tint-purple-fg">Admin</span>
                        )}
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          user.isActive ? 'bg-tint-green text-tint-green-fg' : 'bg-tint-red text-tint-red-fg'
                        )}>
                          {user.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </div>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {name !== user.email && <>{user.email}, </>}
                        <span className={cn(user._count.transactions === 0 && 'text-muted-foreground')}>
                          {plural(user._count.transactions, 'transaction', 'transactions')}
                        </span>
                        , joined {new Date(user.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full text-muted-foreground hover:text-foreground"
                      onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                      title={user.isActive ? 'Deactivate user' : 'Activate user'}
                      aria-label={user.isActive ? `Deactivate ${name}` : `Activate ${name}`}
                    >
                      {user.isActive ? <UserXIcon className="size-4" /> : <UserCheckIcon className="size-4" />}
                    </Button>
                    {!isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                        title={user.isAdmin ? 'Remove admin rights' : 'Make admin'}
                        aria-label={user.isAdmin ? `Remove admin rights from ${name}` : `Make ${name} an admin`}
                      >
                        {user.isAdmin ? <ShieldOffIcon className="size-4" /> : <ShieldCheckIcon className="size-4" />}
                      </Button>
                    )}
                    {!isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full text-muted-foreground hover:bg-tint-red hover:text-tint-red-fg"
                        onClick={() => handleDeleteUser(user.id)}
                        title="Delete user"
                        aria-label={`Delete ${name}`}
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
