import { prisma } from './prisma';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { promises as fsp } from 'fs';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { createGzip, gunzipSync } from 'zlib';
import { pipeline } from 'stream/promises';

/**
 * BackupService
 *
 * Full-database (file-level) snapshot management for the single SQLite database.
 * Snapshots are produced with SQLite `VACUUM INTO`, which checkpoints WAL into a
 * clean, consistent single file (a naive copy could be torn while WAL is active).
 *
 * Restore mechanics live in the same class (see restore-* methods) but are kept
 * separate from the read-only snapshot surface for clarity.
 */

export type BackupKind = 'manual' | 'scheduled' | 'safety';

export interface SnapshotMetadata {
  filename: string;
  sizeBytes: number;
  createdAt: string;       // ISO
  appVersion: string;
  schemaVersion: string;   // latest applied prisma migration name
  gzip: boolean;
  kind: BackupKind;
  sha256?: string;
  label?: string;
}

export interface RetentionPolicy {
  keepLast?: number | null;
  keepDays?: number | null;
}

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  gzip: boolean;
  retention: RetentionPolicy;
  lastRunAt: string | null;
  lastError: string | null;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: false,
  intervalHours: 24,
  gzip: true,
  retention: { keepLast: 7, keepDays: 30 },
  lastRunAt: null,
  lastError: null,
};

export interface RestoreResult {
  success: boolean;
  restoredFrom: string;
  safetyBackup: string;
  upgraded: boolean;
}

// Process-global restore guard. All deploy targets are single-process
// (Docker standalone / Electron-spawned server / `next start`), so an in-memory
// flag is authoritative. (A clustered multi-worker deployment would defeat this.)
let RESTORE_LOCK = false;

export class BackupService {
  private static readonly CONFIG_FILENAME = 'backup-config.json';

  // ---------------------------------------------------------------------------
  // Paths
  // ---------------------------------------------------------------------------

  /**
   * Resolve the absolute filesystem path of the live SQLite database from
   * DATABASE_URL (format `file:<path>`). Relative paths are resolved against the
   * process working directory, matching how Prisma/`scripts/migrate.js` treat them.
   */
  static resolveDbPath(): string {
    const url = process.env.DATABASE_URL || '';
    if (!url.startsWith('file:')) {
      throw new Error(`Unsupported DATABASE_URL for backups (expected file: URL): "${url}"`);
    }
    const raw = url.replace('file:', '').trim();
    if (path.isAbsolute(raw)) return raw;

    // Prisma resolves relative SQLite paths relative to the schema directory
    // (`prisma/`), not the cwd — e.g. `file:./test.db` lives at `prisma/test.db`
    // and `file:./prisma/dev.db` at `prisma/prisma/dev.db`. Prefer the schema-dir
    // location, falling back to cwd-relative if that's where the file actually is.
    const candidates = [
      path.resolve(process.cwd(), 'prisma', raw),
      path.resolve(process.cwd(), raw),
    ];
    return candidates.find((c) => existsSync(c)) ?? candidates[0];
  }

  /**
   * Backups live next to the database file (`<dbDir>/backups`) so they land on the
   * same volume/filesystem as the DB — important for atomic renames during restore
   * and for the Docker volume / Electron userData dir.
   */
  static getBackupDir(): string {
    return path.join(path.dirname(this.resolveDbPath()), 'backups');
  }

  static getStagingDir(): string {
    return path.join(this.getBackupDir(), '.staging');
  }

  static async ensureBackupDir(): Promise<void> {
    await fsp.mkdir(this.getBackupDir(), { recursive: true });
  }

  /**
   * Resolve a snapshot filename to an absolute path, guarding against path
   * traversal (only basenames inside the backup dir are ever accessed).
   */
  static getSnapshotPath(filename: string): string {
    const base = path.basename(filename);
    // Reject anything that isn't a bare filename (no separators, no traversal).
    if (!base || base !== filename || base === '.' || base === '..') {
      throw new Error(`Invalid backup filename: ${filename}`);
    }
    return path.join(this.getBackupDir(), base);
  }

  // ---------------------------------------------------------------------------
  // Snapshot creation
  // ---------------------------------------------------------------------------

  /**
   * Copy the live DB into `targetPath` as a consistent single file.
   * Prefers `VACUUM INTO`; falls back to a WAL checkpoint + file copy if the
   * driver refuses VACUUM inside an implicit transaction.
   */
  static async vacuumInto(targetPath: string): Promise<void> {
    const escaped = targetPath.replace(/'/g, "''");
    try {
      await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/transaction/i.test(msg)) {
        // Fallback: force a full checkpoint then copy the (now consistent) file.
        await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
        await fsp.copyFile(this.resolveDbPath(), targetPath);
        return;
      }
      throw error;
    }
  }

  static async createSnapshot(opts: { kind?: BackupKind; gzip?: boolean; label?: string } = {}): Promise<SnapshotMetadata> {
    const kind: BackupKind = opts.kind ?? 'manual';
    const gzip = opts.gzip ?? false;

    await this.ensureBackupDir();
    const backupDir = this.getBackupDir();
    const dbPath = this.resolveDbPath();

    // Disk-space guard: the VACUUM/copy step writes a full-size file first
    // (gzip only shrinks it afterwards), so require ~1.2x the DB size either way.
    const dbSize = (await fsp.stat(dbPath)).size;
    const needed = Math.ceil(dbSize * 1.2);
    const free = await this.freeDiskBytes(backupDir);
    if (free < needed) {
      throw new Error(`Not enough disk space for backup: need ~${needed} bytes, have ${free} bytes free`);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = kind === 'safety' ? 'pre-restore' : kind === 'scheduled' ? 'btc-backup-auto' : 'btc-backup';
    const filename = `${prefix}-${stamp}.db${gzip ? '.gz' : ''}`;
    const finalPath = path.join(backupDir, filename);
    const tmpPath = path.join(backupDir, `.tmp-${stamp}.db`);

    try {
      await this.vacuumInto(tmpPath);

      if (gzip) {
        await pipeline(createReadStream(tmpPath), createGzip(), createWriteStream(finalPath));
        await fsp.unlink(tmpPath);
      } else {
        await fsp.rename(tmpPath, finalPath);
      }

      const sha256 = await this.sha256File(finalPath);
      const sizeBytes = (await fsp.stat(finalPath)).size;

      const metadata: SnapshotMetadata = {
        filename,
        sizeBytes,
        createdAt: new Date().toISOString(),
        appVersion: await this.getAppVersion(),
        schemaVersion: await this.getSchemaVersion(),
        gzip,
        kind,
        sha256,
        ...(opts.label ? { label: opts.label } : {}),
      };

      await fsp.writeFile(`${finalPath}.json`, JSON.stringify(metadata, null, 2), 'utf-8');
      return metadata;
    } catch (error) {
      // Best-effort cleanup of partial artifacts.
      await fsp.unlink(tmpPath).catch(() => {});
      await fsp.unlink(finalPath).catch(() => {});
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Listing / reading / deleting
  // ---------------------------------------------------------------------------

  static async listSnapshots(): Promise<SnapshotMetadata[]> {
    await this.ensureBackupDir();
    const backupDir = this.getBackupDir();
    const entries = await fsp.readdir(backupDir);

    const snapshots: SnapshotMetadata[] = [];
    for (const name of entries) {
      if (!this.isSnapshotFile(name)) continue;
      const full = path.join(backupDir, name);

      let meta: SnapshotMetadata | null = null;
      try {
        const sidecar = await fsp.readFile(`${full}.json`, 'utf-8');
        meta = JSON.parse(sidecar) as SnapshotMetadata;
      } catch {
        meta = null;
      }

      if (!meta) {
        // Synthesize metadata for orphaned/manually-added snapshot files.
        const stat = await fsp.stat(full);
        meta = {
          filename: name,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          appVersion: 'unknown',
          schemaVersion: 'unknown',
          gzip: name.endsWith('.gz'),
          kind: this.inferKind(name),
        };
      }
      snapshots.push(meta);
    }

    return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static async readSnapshot(filename: string): Promise<Buffer> {
    return fsp.readFile(this.getSnapshotPath(filename));
  }

  static async deleteSnapshot(filename: string): Promise<void> {
    const p = this.getSnapshotPath(filename);
    await fsp.unlink(p);
    await fsp.unlink(`${p}.json`).catch(() => {});
  }

  /**
   * Apply a retention policy to AUTOMATIC (scheduled) snapshots only.
   * Manual and safety backups are never removed by retention.
   */
  static async applyRetention(policy: RetentionPolicy): Promise<string[]> {
    const scheduled = (await this.listSnapshots())
      .filter((s) => s.kind === 'scheduled')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // NOTE: avoid Set iteration/spread here — the project's tsconfig targets ES5
    // without downlevelIteration, under which ts-jest mis-compiles `[...set]`/
    // `for..of set`. Use a plain array with manual dedup instead.
    const toDelete: string[] = [];
    const mark = (filename: string) => {
      if (toDelete.indexOf(filename) === -1) toDelete.push(filename);
    };

    if (policy.keepLast != null && policy.keepLast >= 0) {
      scheduled.slice(policy.keepLast).forEach((s) => mark(s.filename));
    }
    if (policy.keepDays != null && policy.keepDays >= 0) {
      const cutoff = Date.now() - policy.keepDays * 24 * 60 * 60 * 1000;
      scheduled
        .filter((s) => new Date(s.createdAt).getTime() < cutoff)
        .forEach((s) => mark(s.filename));
    }

    const deleted: string[] = [];
    for (let i = 0; i < toDelete.length; i++) {
      try {
        await this.deleteSnapshot(toDelete[i]);
        deleted.push(toDelete[i]);
      } catch {
        // ignore individual deletion errors during the retention sweep
      }
    }
    return deleted;
  }

  // ---------------------------------------------------------------------------
  // Restore (destructive — replaces the live database)
  // ---------------------------------------------------------------------------

  static isRestoreInProgress(): boolean {
    return RESTORE_LOCK;
  }

  /** Restore from an uploaded backup buffer (gzip auto-detected). */
  static async restoreFromBuffer(buffer: Buffer, opts: { sourceName?: string } = {}): Promise<RestoreResult> {
    await fsp.mkdir(this.getStagingDir(), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const staged = path.join(this.getStagingDir(), `upload-${stamp}.db`);

    const isGzip = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    if (isGzip) {
      await fsp.writeFile(staged, gunzipSync(buffer));
    } else {
      await fsp.writeFile(staged, buffer);
    }

    return this.performRestore(staged, opts.sourceName || 'upload');
  }

  /** Restore from a snapshot already stored on the server. */
  static async restoreFromServerSnapshot(filename: string): Promise<RestoreResult> {
    const buffer = await this.readSnapshot(filename); // also runs the traversal guard
    return this.restoreFromBuffer(buffer, { sourceName: filename });
  }

  /**
   * The destructive core. Sequence: validate (out-of-band) → safety backup →
   * stop schedulers → disconnect → swap file (+ clear WAL sidecars) → reconnect
   * → migrate up if older → restart services. Rolls back to the safety backup on
   * any post-swap failure.
   */
  private static async performRestore(stagedPath: string, sourceName: string): Promise<RestoreResult> {
    if (RESTORE_LOCK) {
      await fsp.unlink(stagedPath).catch(() => {});
      throw new Error('RESTORE_IN_PROGRESS');
    }
    RESTORE_LOCK = true;

    const dbPath = this.resolveDbPath();
    const { prisma } = await import('./prisma');

    try {
      // 1. Validate the staged file without touching the live connection.
      const { stagedLatest } = await this.validateStagedDb(stagedPath);
      const currentLatest = await this.getSchemaVersion();
      const needsUpgrade = stagedLatest !== 'unknown' && stagedLatest !== currentLatest;

      // 2. Safety backup of the CURRENT database. Abort if it can't be made.
      let safety: SnapshotMetadata;
      try {
        safety = await this.createSnapshot({ kind: 'safety', gzip: false });
      } catch (e) {
        throw new Error(`Aborting restore: failed to create safety backup: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      // 3. Stop background work that touches the DB.
      await this.stopSchedulers();

      // 4. Swap the file in, then bring the schema up to date if the backup is older.
      try {
        await prisma.$disconnect();
        await this.swapInFile(stagedPath, dbPath);
        await prisma.$connect();
        await prisma.$queryRawUnsafe('SELECT 1');
        if (needsUpgrade) await this.runMigrations();
        await this.restartServices();
        return { success: true, restoredFrom: sourceName, safetyBackup: safety.filename, upgraded: needsUpgrade };
      } catch (err) {
        // 5. Roll back to the safety backup.
        try {
          await prisma.$disconnect().catch(() => {});
          await this.swapInFile(this.getSnapshotPath(safety.filename), dbPath);
          await prisma.$connect();
          await this.restartServices();
        } catch (rollbackErr) {
          throw new Error(
            `Restore FAILED and automatic rollback also FAILED. Your data may be inconsistent. ` +
            `Restore the safety backup "${safety.filename}" manually. Original error: ${err instanceof Error ? err.message : 'unknown'}; ` +
            `rollback error: ${rollbackErr instanceof Error ? rollbackErr.message : 'unknown'}`
          );
        }
        throw new Error(`Restore failed (rolled back to safety backup "${safety.filename}"): ${err instanceof Error ? err.message : 'unknown'}`);
      }
    } finally {
      RESTORE_LOCK = false;
      await fsp.unlink(stagedPath).catch(() => {});
    }
  }

  /** Validate an uploaded/staged SQLite file out-of-band (never via the live client). */
  private static async validateStagedDb(stagedPath: string): Promise<{ stagedLatest: string }> {
    // Cheap magic-header check first.
    const fd = await fsp.open(stagedPath, 'r');
    try {
      const head = Buffer.alloc(16);
      await fd.read(head, 0, 16, 0);
      if (head.toString('binary', 0, 15) !== 'SQLite format 3') {
        throw new Error('Uploaded file is not a SQLite database');
      }
    } finally {
      await fd.close();
    }

    const probe = new PrismaClient({ datasources: { db: { url: `file:${stagedPath}` } } });
    try {
      await probe.$connect();

      const required = ['users', 'bitcoin_transactions', 'app_settings', '_prisma_migrations'];
      for (let i = 0; i < required.length; i++) {
        const rows = await probe.$queryRawUnsafe(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${required[i]}'`
        );
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error(`Backup is missing required table: ${required[i]}`);
        }
      }

      const appliedRows = await probe.$queryRawUnsafe(
        'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC'
      );
      const applied: string[] = Array.isArray(appliedRows)
        ? appliedRows.map((r: { migration_name: string }) => r.migration_name)
        : [];

      const known = await this.knownMigrations();
      if (known.length) {
        for (let i = 0; i < applied.length; i++) {
          if (known.indexOf(applied[i]) === -1) {
            throw new Error(`Backup was created by a newer app version (unknown migration "${applied[i]}"). Refusing to restore.`);
          }
        }
      }

      return { stagedLatest: applied[0] || 'unknown' };
    } finally {
      await probe.$disconnect().catch(() => {});
    }
  }

  private static async knownMigrations(): Promise<string[]> {
    try {
      const dir = path.join(process.cwd(), 'prisma', 'migrations');
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  /** Atomically replace the DB file with `source`, clearing WAL sidecars first. */
  private static async swapInFile(source: string, dbPath: string): Promise<void> {
    await fsp.rm(`${dbPath}-wal`, { force: true });
    await fsp.rm(`${dbPath}-shm`, { force: true });
    await fsp.rm(`${dbPath}-journal`, { force: true });
    const tmp = `${dbPath}.restore-tmp`;
    await fsp.copyFile(source, tmp);
    await fsp.rename(tmp, dbPath);
  }

  private static async stopSchedulers(): Promise<void> {
    // Literal import paths (not a variable) so the bundler can resolve them and
    // doesn't emit a "request of a dependency is an expression" warning.
    try { (await import('./price-scheduler')).PriceScheduler?.stop?.(); } catch { /* noop */ }
    try { (await import('./dca-scheduler')).DCAScheduler?.stop?.(); } catch { /* noop */ }
    try { (await import('./backup-scheduler')).BackupScheduler?.stop?.(); } catch { /* noop */ }
  }

  private static async restartServices(): Promise<void> {
    try {
      const { AppInitializationService } = await import('./app-initialization');
      await AppInitializationService.restart();
    } catch (e) {
      console.error('Failed to restart services after restore:', e);
    }
  }

  private static runMigrations(): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', 'migrate.js')], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      });
      child.on('error', reject);
      child.on('exit', (code: number) => (code === 0 ? resolve() : reject(new Error(`migrate.js exited with code ${code}`))));
    });
  }

  // ---------------------------------------------------------------------------
  // Schedule / retention config (stored on disk, not in the DB, so a restore
  // can't silently overwrite the backup schedule).
  // ---------------------------------------------------------------------------

  static getConfigPath(): string {
    return path.join(this.getBackupDir(), this.CONFIG_FILENAME);
  }

  static async getConfig(): Promise<BackupConfig> {
    try {
      const raw = await fsp.readFile(this.getConfigPath(), 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_BACKUP_CONFIG,
        ...parsed,
        retention: { ...DEFAULT_BACKUP_CONFIG.retention, ...(parsed.retention || {}) },
      };
    } catch {
      return { ...DEFAULT_BACKUP_CONFIG, retention: { ...DEFAULT_BACKUP_CONFIG.retention } };
    }
  }

  static async saveConfig(updates: Partial<BackupConfig>): Promise<BackupConfig> {
    const current = await this.getConfig();
    const merged: BackupConfig = {
      ...current,
      ...updates,
      retention: { ...current.retention, ...(updates.retention || {}) },
    };
    await this.ensureBackupDir();
    await fsp.writeFile(this.getConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }

  // ---------------------------------------------------------------------------
  // Metadata helpers
  // ---------------------------------------------------------------------------

  static async getAppVersion(): Promise<string> {
    try {
      const v = await fsp.readFile(path.join(process.cwd(), 'VERSION'), 'utf-8');
      const trimmed = v.trim();
      if (trimmed) return trimmed;
    } catch {
      /* fall through */
    }
    try {
      const pkg = await fsp.readFile(path.join(process.cwd(), 'package.json'), 'utf-8');
      return JSON.parse(pkg).version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  static async getSchemaVersion(): Promise<string> {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
        'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1'
      );
      return rows[0]?.migration_name ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Free bytes available on the filesystem holding `dir`. Returns Infinity if the
   * platform/runtime doesn't support statfs, so the disk-space guard never blocks
   * a backup just because it can't measure.
   */
  static async freeDiskBytes(dir: string): Promise<number> {
    try {
      const stats = await (fsp as unknown as { statfs: (p: string) => Promise<{ bavail: number; bsize: number }> }).statfs(dir);
      return stats.bavail * stats.bsize;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private static isSnapshotFile(name: string): boolean {
    if (name.startsWith('.tmp-')) return false;
    if (name.endsWith('.json')) return false;
    return name.endsWith('.db') || name.endsWith('.db.gz');
  }

  private static inferKind(name: string): BackupKind {
    if (name.startsWith('pre-restore')) return 'safety';
    if (name.startsWith('btc-backup-auto')) return 'scheduled';
    return 'manual';
  }

  private static sha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}
