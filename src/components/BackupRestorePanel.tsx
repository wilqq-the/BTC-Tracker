'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DatabaseIcon, DownloadIcon, UploadIcon, Trash2Icon, RotateCcwIcon, AlertTriangleIcon, ClockIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Snapshot {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  appVersion: string;
  schemaVersion: string;
  gzip: boolean;
  kind: 'manual' | 'scheduled' | 'safety';
}

interface ScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  gzip: boolean;
  retention: { keepLast: number | null; keepDays: number | null };
  lastRunAt: string | null;
  lastError: string | null;
}

type RestoreTarget = { type: 'file'; file: File } | { type: 'server'; filename: string } | null;

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function downloadFromUrl(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed');
  const cd = res.headers.get('content-disposition') || '';
  const match = /filename="?([^"]+)"?/.exec(cd);
  const name = match ? match[1] : fallbackName;
  const blob = await res.blob();
  const href = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(href);
}

export default function BackupRestorePanel() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSnapshots = useCallback(async () => {
    const res = await fetch('/api/backup');
    if (res.ok) {
      const data = await res.json();
      setSnapshots(data.data || []);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    const res = await fetch('/api/backup/schedule');
    if (res.ok) {
      const data = await res.json();
      setConfig(data.data.config);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadSnapshots(), loadSchedule()]).finally(() => setLoading(false));
  }, [loadSnapshots, loadSchedule]);

  const handleDownloadNew = async () => {
    setDownloading(true);
    try {
      await downloadFromUrl('/api/backup/export', 'btc-tracker-backup.db');
      toast({ title: 'Backup downloaded' });
    } catch {
      toast({ title: 'Failed to download backup', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleCreateServerSnapshot = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Server snapshot created' });
        await loadSnapshots();
      } else {
        toast({ title: 'Failed to create snapshot', description: data.error, variant: 'destructive' });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (filename: string) => {
    const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      toast({ title: 'Snapshot deleted' });
      await loadSnapshots();
    } else {
      toast({ title: 'Failed to delete', description: data.error, variant: 'destructive' });
    }
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setConfirmText('');
    setRestoreTarget({ type: 'file', file });
  };

  const performRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreProgress(0);
    try {
      let ok = false;
      let errorMsg = 'Restore failed';

      if (restoreTarget.type === 'file') {
        const result = await uploadRestore(restoreTarget.file, setRestoreProgress);
        ok = result.status === 200 && result.json?.success;
        errorMsg = result.json?.error || errorMsg;
      } else {
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: restoreTarget.filename }),
        });
        const data = await res.json();
        ok = res.status === 200 && data.success;
        errorMsg = data.error || errorMsg;
      }

      if (ok) {
        toast({ title: 'Restore complete', description: 'Reloading — you may need to sign in again.' });
        setRestoreTarget(null);
        setTimeout(() => { window.location.href = '/auth/signin'; }, 1800);
      } else {
        toast({ title: 'Restore failed', description: errorMsg, variant: 'destructive' });
        setRestoring(false);
      }
    } catch {
      toast({ title: 'Restore failed', variant: 'destructive' });
      setRestoring(false);
    }
  };

  const saveSchedule = async (updates: Partial<ScheduleConfig>) => {
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/backup/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data.config);
        toast({ title: 'Schedule updated' });
      } else {
        toast({ title: 'Failed to update schedule', description: data.error, variant: 'destructive' });
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading backups…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <DatabaseIcon className="size-6" /> Backup &amp; Restore
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Full-database backups (all users&apos; data). Admin only.
        </p>
      </div>

      {/* Create & download */}
      <Card>
        <CardHeader>
          <CardTitle>Create a backup</CardTitle>
          <CardDescription>Download a snapshot to your computer, or keep one on the server.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleDownloadNew} disabled={downloading}>
            <DownloadIcon className="size-4 mr-2" />
            {downloading ? 'Preparing…' : 'Download backup'}
          </Button>
          <Button variant="outline" onClick={handleCreateServerSnapshot} disabled={creating}>
            <DatabaseIcon className="size-4 mr-2" />
            {creating ? 'Creating…' : 'Create server snapshot'}
          </Button>
        </CardContent>
      </Card>

      {/* Server snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Server snapshots</CardTitle>
          <CardDescription>Snapshots stored on this server.</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet.</p>
          ) : (
            <div className="space-y-2">
              {snapshots.map((s) => (
                <div key={s.filename} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.filename}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(s.createdAt).toLocaleString()} · {formatBytes(s.sizeBytes)} · {s.kind}
                      {s.appVersion !== 'unknown' ? ` · v${s.appVersion}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" title="Download"
                      onClick={() => downloadFromUrl(`/api/backup/${encodeURIComponent(s.filename)}/download`, s.filename).catch(() => toast({ title: 'Download failed', variant: 'destructive' }))}>
                      <DownloadIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Restore"
                      onClick={() => { setConfirmText(''); setRestoreTarget({ type: 'server', filename: s.filename }); }}>
                      <RotateCcwIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Delete" onClick={() => handleDelete(s.filename)}>
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore from file */}
      <Card>
        <CardHeader>
          <CardTitle>Restore from a file</CardTitle>
          <CardDescription className="text-destructive">
            This replaces ALL current data for every user. Make a backup first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelected(e.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted'}`}
          >
            <UploadIcon className="size-6 mx-auto mb-2 text-muted-foreground" />
            Drop a <code>.db</code> or <code>.db.gz</code> backup here, or click to choose
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.gz,application/octet-stream"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0] || undefined)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClockIcon className="size-5" /> Automatic backups</CardTitle>
            <CardDescription>Periodic server snapshots with retention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="bk-enabled">Enabled</Label>
              <Switch id="bk-enabled" checked={config.enabled}
                onCheckedChange={(v) => saveSchedule({ enabled: v })} disabled={savingSchedule} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="bk-interval">Every (hours)</Label>
                <Input id="bk-interval" type="number" min={1} defaultValue={config.intervalHours}
                  onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v !== config.intervalHours) saveSchedule({ intervalHours: v }); }} />
              </div>
              <div>
                <Label htmlFor="bk-keeplast">Keep last (count)</Label>
                <Input id="bk-keeplast" type="number" min={0} defaultValue={config.retention.keepLast ?? 0}
                  onBlur={(e) => saveSchedule({ retention: { ...config.retention, keepLast: Number(e.target.value) } })} />
              </div>
              <div>
                <Label htmlFor="bk-keepdays">Keep days</Label>
                <Input id="bk-keepdays" type="number" min={0} defaultValue={config.retention.keepDays ?? 0}
                  onBlur={(e) => saveSchedule({ retention: { ...config.retention, keepDays: Number(e.target.value) } })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="bk-gzip">Compress (gzip)</Label>
              <Switch id="bk-gzip" checked={config.gzip} onCheckedChange={(v) => saveSchedule({ gzip: v })} disabled={savingSchedule} />
            </div>
            <p className="text-xs text-muted-foreground">
              {config.lastRunAt ? `Last run: ${new Date(config.lastRunAt).toLocaleString()}` : 'Never run yet'}
              {config.lastError ? ` · last error: ${config.lastError}` : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Destructive restore confirmation */}
      <Dialog open={restoreTarget !== null} onOpenChange={(open) => { if (!open && !restoring) setRestoreTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="size-5" /> Confirm restore
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This will <strong>permanently replace the entire database</strong> — every user&apos;s
                  transactions, wallets, settings and accounts — with the contents of{' '}
                  <code>{restoreTarget?.type === 'file' ? restoreTarget.file.name : restoreTarget?.type === 'server' ? restoreTarget.filename : ''}</code>.
                </p>
                <p>A safety backup of the current database is taken automatically first.</p>
                <p className="text-muted-foreground">
                  Note: exchange API credentials only decrypt if this backup came from an install with the
                  same <code>NEXTAUTH_SECRET</code>. You will likely need to sign in again afterwards.
                </p>
                <p>Type <strong>RESTORE</strong> to confirm:</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTORE" disabled={restoring} />
          {restoring && restoreTarget?.type === 'file' && <Progress value={restoreProgress} className="mt-2" />}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={restoring}>Cancel</Button>
            <Button variant="destructive" onClick={performRestore} disabled={restoring || confirmText !== 'RESTORE'}>
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function uploadRestore(file: File, onProgress: (pct: number) => void): Promise<{ status: number; json: { success?: boolean; error?: string } | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/backup/restore');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let json: { success?: boolean; error?: string } | null = null;
      try { json = JSON.parse(xhr.responseText); } catch { json = null; }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error('Network error'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}
