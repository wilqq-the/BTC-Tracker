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
import { DatabaseIcon, DownloadIcon, UploadIcon, Trash2Icon, RotateCcwIcon, AlertTriangleIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';

const KIND_LABEL: Record<Snapshot['kind'], string> = {
  manual: 'Manual',
  scheduled: 'Automatic',
  safety: 'Safety copy before a restore',
};

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
    if (!(await confirm({ title: 'Delete this snapshot?', description: `${filename} is removed from the server.`, confirmText: 'Delete', destructive: true }))) return;
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
    return (
      <div className="flex items-center justify-center p-8">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading backups" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
      {/* Create & download */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Create a backup</CardTitle>
          <CardDescription className="text-[13px]">A copy of the whole database, with every user&apos;s data. Download it, or keep a snapshot on the server.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button className="rounded-full font-semibold" onClick={handleDownloadNew} disabled={downloading}>
            <DownloadIcon className="size-4" />
            {downloading ? 'Preparing...' : 'Download backup'}
          </Button>
          <Button variant="outline" className="rounded-full font-semibold" onClick={handleCreateServerSnapshot} disabled={creating}>
            <DatabaseIcon className="size-4" />
            {creating ? 'Creating...' : 'Save snapshot on server'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore from file */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Restore from a file</CardTitle>
          <CardDescription className="text-[13px]">
            Replaces all current data for every user. Download a backup first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelected(e.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center text-sm transition-colors ${dragOver ? 'border-primary bg-tint-orange' : 'border-border hover:bg-secondary'}`}
          >
            <UploadIcon className="size-6 mx-auto mb-2 text-muted-foreground" />
            Drop a <code>.db</code> or <code>.db.gz</code> backup here, or click to choose one
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
      </div>

      {/* Server snapshots */}
      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Snapshots on this server</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          {snapshots.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No snapshots yet. Snapshots you save, and automatic ones, will appear here.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {snapshots.map((s) => (
                <li key={s.filename} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {new Date(s.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-muted-foreground text-[13px] tabular-nums truncate">
                      {KIND_LABEL[s.kind] ?? s.kind}, {formatBytes(s.sizeBytes)}
                      {s.appVersion !== 'unknown' ? `, version ${s.appVersion}` : ''}
                    </div>
                    <div className="text-muted-foreground text-xs truncate" title={s.filename}>{s.filename}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground hover:text-foreground" title="Download" aria-label={`Download ${s.filename}`}
                      onClick={() => downloadFromUrl(`/api/backup/${encodeURIComponent(s.filename)}/download`, s.filename).catch(() => toast({ title: 'Download failed', variant: 'destructive' }))}>
                      <DownloadIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground hover:text-foreground" title="Restore" aria-label={`Restore ${s.filename}`}
                      onClick={() => { setConfirmText(''); setRestoreTarget({ type: 'server', filename: s.filename }); }}>
                      <RotateCcwIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground hover:bg-tint-red hover:text-tint-red-fg" title="Delete" aria-label={`Delete ${s.filename}`} onClick={() => handleDelete(s.filename)}>
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[17px] font-bold tracking-tight">Automatic backups</CardTitle>
            <CardDescription className="text-[13px]">Save a snapshot on the server on a schedule, and clear out old ones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="bk-enabled">Back up automatically</Label>
              <Switch id="bk-enabled" checked={config.enabled}
                onCheckedChange={(v) => saveSchedule({ enabled: v })} disabled={savingSchedule} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-interval">Every how many hours</Label>
                <Input id="bk-interval" type="number" min={1} defaultValue={config.intervalHours}
                  onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v !== config.intervalHours) saveSchedule({ intervalHours: v }); }} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-keeplast">Keep the newest</Label>
                <Input id="bk-keeplast" type="number" min={0} defaultValue={config.retention.keepLast ?? 0}
                  onBlur={(e) => saveSchedule({ retention: { ...config.retention, keepLast: Number(e.target.value) } })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-keepdays">Keep for days</Label>
                <Input id="bk-keepdays" type="number" min={0} defaultValue={config.retention.keepDays ?? 0}
                  onBlur={(e) => saveSchedule({ retention: { ...config.retention, keepDays: Number(e.target.value) } })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">0 means no limit.</p>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="bk-gzip">Compress snapshots (gzip)</Label>
              <Switch id="bk-gzip" checked={config.gzip} onCheckedChange={(v) => saveSchedule({ gzip: v })} disabled={savingSchedule} />
            </div>
            <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              {config.lastRunAt ? `Last ran ${new Date(config.lastRunAt).toLocaleString()}.` : 'Hasn’t run yet.'}
            </p>
            {config.lastError && (
              <div className="flex items-start gap-2 rounded-2xl bg-tint-red p-3 text-[13px] text-tint-red-fg">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <span>The last run failed: {config.lastError}</span>
              </div>
            )}
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
                <p>Type <strong>RESTORE</strong> to confirm.</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTORE" disabled={restoring} />
          {restoring && restoreTarget?.type === 'file' && <Progress value={restoreProgress} className="mt-2" />}

          <DialogFooter>
            <Button variant="outline" className="rounded-full font-semibold" onClick={() => setRestoreTarget(null)} disabled={restoring}>Cancel</Button>
            <Button variant="destructive" className="rounded-full font-semibold" onClick={performRestore} disabled={restoring || confirmText !== 'RESTORE'}>
              {restoring ? 'Restoring...' : 'Replace database'}
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
