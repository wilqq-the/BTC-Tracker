'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    onHeaderAction?.({ label: 'Generate New Key', onClick: () => setShowGenerateModal(true) });
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
      setApiKeyError('Label is required');
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
      setApiKeyError('An error occurred while generating key');
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
      // fallback: select text
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

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          {apiKeysLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <KeyIcon className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No API keys yet. Generate one to automate transactions.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-2xl',
                    key.isActive ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{key.label}</span>
                      {!key.isActive && (
                        <Badge variant="secondary" className="text-xs">Revoked</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">btct_{key.keyPrefix}…</span>
                      <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.lastUsedAt && (
                        <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      )}
                      {key.expiresAt && (
                        <span>
                          {new Date(key.expiresAt) < new Date()
                            ? 'Expired'
                            : `Expires ${new Date(key.expiresAt).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {key.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-2 shrink-0"
                      onClick={() => handleRevokeKey(key.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate API Key Modal */}
      <Dialog open={showGenerateModal} onOpenChange={(open) => { if (!open) handleCloseGenerateModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for automation integrations.
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-sm flex gap-2">
                <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
                <span>Save this key now — it will not be shown again.</span>
              </div>
              <div className="space-y-1">
                <Label>Your new API key</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={generatedKey}
                    className="font-mono text-xs"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyKey}>
                    {keyCopied ? <CheckIcon className="size-4 text-profit" /> : <CopyIcon className="size-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this key as a Bearer token: <code className="bg-muted px-1 rounded">Authorization: Bearer {generatedKey.slice(0, 16)}…</code>
              </p>
              <DialogFooter>
                <Button onClick={handleCloseGenerateModal} className="w-full">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyLabel">Label</Label>
                <Input
                  id="keyLabel"
                  placeholder="e.g. n8n automation, home server"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyExpiry">Expiry</Label>
                <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                  <SelectTrigger id="keyExpiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="90d">90 days</SelectItem>
                    <SelectItem value="1y">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {apiKeyError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                  <AlertCircleIcon className="size-4" />
                  {apiKeyError}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCloseGenerateModal}>Cancel</Button>
                <Button onClick={handleGenerateKey} disabled={generatingKey}>
                  {generatingKey ? (
                    <span className="flex items-center gap-2">
                      <div className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </span>
                  ) : (
                    'Generate Key'
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
