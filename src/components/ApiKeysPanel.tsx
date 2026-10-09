'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KeyIcon, CopyIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/hooks/use-toast';

interface ApiKey {
  id: number;
  keyPrefix: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

interface ApiKeysPanelProps {
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}

export default function ApiKeysPanel({ onHeaderAction }: ApiKeysPanelProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('never');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');

  useEffect(() => {
    loadApiKeys();
  }, []);

  // Surface the primary action in the settings page header
  useEffect(() => {
    onHeaderAction?.({ label: 'Generate key', onClick: () => setShowGenerateModal(true) });
    return () => onHeaderAction?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const response = await fetch('/api/user/api-keys');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setApiKeys(result.data);
        }
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!newKeyLabel.trim()) {
      setApiKeyError('Give the key a label so you can recognise it later.');
      return;
    }
    setApiKeyError('');
    setGeneratingKey(true);
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel.trim(), expiresIn: newKeyExpiry })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setGeneratedKey(result.data.key);
        await loadApiKeys();
      } else {
        setApiKeyError(result.error || 'Failed to generate key');
      }
    } catch (error) {
      setApiKeyError('Couldn’t generate the key. Check your connection and try again.');
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: number) => {
    if (!(await confirm({
      title: 'Revoke API key?',
      description: 'This cannot be undone. Any integration using it will stop working.',
      confirmText: 'Revoke',
      destructive: true,
    }))) return;
    try {
      const response = await fetch(`/api/user/api-keys/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast({ title: 'API key revoked' });
        await loadApiKeys();
      } else {
        toast({ title: 'Failed to revoke API key', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast({ title: 'Failed to revoke API key', variant: 'destructive' });
    }
  };

  const handleCopyKey = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      toast({ title: 'Couldn’t copy the key', description: 'Select it and copy it by hand.', variant: 'destructive' });
    }
  };

  const handleCloseGenerateModal = () => {
    setShowGenerateModal(false);
    setNewKeyLabel('');
    setNewKeyExpiry('never');
    setGeneratedKey(null);
    setKeyCopied(false);
    setApiKeyError('');
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-2">
        <CardContent className="px-2">
          {apiKeysLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading API keys" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <KeyIcon className="size-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No API keys yet</p>
                <p className="text-sm text-muted-foreground">Keys you generate will appear here. Use one to add transactions from a script or automation.</p>
              </div>
              <Button size="sm" className="rounded-full font-semibold" onClick={() => setShowGenerateModal(true)}>Generate a key</Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {apiKeys.map((key) => {
                const expired = !!key.expiresAt && new Date(key.expiresAt) < new Date();
                const details = [
                  `Created ${fmtDate(key.createdAt)}`,
                  key.lastUsedAt ? `last used ${fmtDate(key.lastUsedAt)}` : 'never used',
                  key.expiresAt ? (expired ? 'expired' : `expires ${fmtDate(key.expiresAt)}`) : null,
                ].filter(Boolean).join(', ');
                return (
                  <li key={key.id} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className={cn('min-w-0 space-y-0.5', !key.isActive && 'opacity-60')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-semibold">{key.label}</span>
                        <code className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">btct_{key.keyPrefix}…</code>
                        {!key.isActive && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">Revoked</span>
                        )}
                        {key.isActive && expired && (
                          <span className="rounded-full bg-tint-red px-2 py-0.5 text-xs font-semibold text-tint-red-fg">Expired</span>
                        )}
                      </div>
                      <p className="text-[13px] text-muted-foreground">{details}</p>
                    </div>
                    {key.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 rounded-full font-semibold text-tint-red-fg hover:bg-tint-red hover:text-tint-red-fg"
                        onClick={() => handleRevokeKey(key.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Generate API Key Modal */}
      <Dialog open={showGenerateModal} onOpenChange={(open) => { if (!open) handleCloseGenerateModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{generatedKey ? 'Copy your new key' : 'Generate an API key'}</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? 'Send it as a Bearer token in the Authorization header.'
                : 'Scripts and automations use it to read and add transactions as you.'}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="flex gap-2.5 rounded-2xl bg-tint-orange p-3 text-sm text-primary-strong">
                <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
                <span>Save this key now. It won&apos;t be shown again.</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="generatedKey">Your new API key</Label>
                <div className="flex gap-2">
                  <Input
                    id="generatedKey"
                    readOnly
                    value={generatedKey}
                    className="font-mono text-xs"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button variant="outline" size="icon" className="rounded-full" aria-label="Copy key" onClick={handleCopyKey}>
                    {keyCopied ? <CheckIcon className="size-4 text-tint-green-fg" /> : <CopyIcon className="size-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Example header: <code className="rounded bg-secondary px-1">Authorization: Bearer {generatedKey.slice(0, 16)}…</code>
              </p>
              <DialogFooter>
                <Button onClick={handleCloseGenerateModal} className="w-full rounded-full font-semibold">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="keyLabel">Label</Label>
                <Input
                  id="keyLabel"
                  placeholder="n8n automation, home server"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="keyExpiry">Expires</Label>
                <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                  <SelectTrigger id="keyExpiry" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="30d">In 30 days</SelectItem>
                    <SelectItem value="90d">In 90 days</SelectItem>
                    <SelectItem value="1y">In 1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {apiKeyError && (
                <div className="flex items-center gap-2 rounded-2xl bg-tint-red p-3 text-sm text-tint-red-fg">
                  <AlertCircleIcon className="size-4 shrink-0" />
                  {apiKeyError}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-full font-semibold" onClick={handleCloseGenerateModal}>Cancel</Button>
                <Button className="rounded-full font-semibold" onClick={handleGenerateKey} disabled={generatingKey}>
                  {generatingKey ? (
                    <span className="flex items-center gap-2">
                      <div className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    'Generate key'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
