/**
 * BackupService unit tests
 *
 * Runs against an isolated temp directory (DATABASE_URL is pointed at a copy of
 * the test DB) so it never touches real backups or the production database.
 */

import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { gunzipSync } from 'zlib'
import { PrismaClient } from '@prisma/client'
import { setupTestDatabase } from './test-db'
import { BackupService } from '../lib/backup-service'

const SQLITE_MAGIC = 'SQLite format 3\0'

let tmpDir: string
let tempDbUrl: string
let originalDbUrl: string | undefined

async function makeFakeSnapshot(filename: string, kind: string, createdAt: string) {
  const dir = BackupService.getBackupDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, filename), SQLITE_MAGIC + 'fakedata')
  const meta = { filename, sizeBytes: 16, createdAt, appVersion: 'x', schemaVersion: 'y', gzip: filename.endsWith('.gz'), kind }
  await fs.writeFile(path.join(dir, `${filename}.json`), JSON.stringify(meta))
}

describe('BackupService', () => {
  beforeAll(async () => {
    await setupTestDatabase()

    originalDbUrl = process.env.DATABASE_URL
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'btc-backup-test-'))

    // Copy the real test DB (resolved the way Prisma resolves it) so
    // resolveDbPath()/stat() see a real file, then isolate to the temp dir.
    const realDb = BackupService.resolveDbPath()
    await fs.copyFile(realDb, path.join(tmpDir, 'test.db'))
    tempDbUrl = `file:${path.join(tmpDir, 'test.db')}`
    process.env.DATABASE_URL = tempDbUrl
  }, 30000)

  afterAll(async () => {
    process.env.DATABASE_URL = originalDbUrl
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    // Reset env first (a test that overrides DATABASE_URL and throws must not
    // leak it) and isolate each test by wiping the backup dir.
    process.env.DATABASE_URL = tempDbUrl
    await fs.rm(BackupService.getBackupDir(), { recursive: true, force: true })
  })

  describe('path resolution', () => {
    it('resolves absolute file: URLs as-is', () => {
      process.env.DATABASE_URL = 'file:/var/data/app.db'
      expect(BackupService.resolveDbPath()).toBe('/var/data/app.db')
      expect(BackupService.getBackupDir()).toBe(path.join('/var/data', 'backups'))
    })

    it('resolves relative file: URLs against the prisma schema dir', () => {
      // `file:./test.db` actually lives at `prisma/test.db` (Prisma resolves
      // relative SQLite paths against the schema dir).
      process.env.DATABASE_URL = 'file:./test.db'
      expect(BackupService.resolveDbPath()).toBe(path.resolve(process.cwd(), 'prisma', 'test.db'))
    })

    it('rejects non-file URLs', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/db'
      expect(() => BackupService.resolveDbPath()).toThrow()
    })

    it('guards getSnapshotPath against traversal', () => {
      expect(() => BackupService.getSnapshotPath('../../etc/passwd')).toThrow()
      expect(() => BackupService.getSnapshotPath('sub/dir.db')).toThrow()
      const ok = BackupService.getSnapshotPath('btc-backup-x.db')
      expect(ok.startsWith(BackupService.getBackupDir())).toBe(true)
    })
  })

  describe('createSnapshot', () => {
    it('produces a valid SQLite snapshot with metadata sidecar', async () => {
      const meta = await BackupService.createSnapshot({ kind: 'manual', gzip: false })

      expect(meta.kind).toBe('manual')
      expect(meta.gzip).toBe(false)
      expect(meta.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(meta.sizeBytes).toBeGreaterThan(0)

      const buf = await BackupService.readSnapshot(meta.filename)
      expect(buf.subarray(0, SQLITE_MAGIC.length).toString('binary')).toBe(SQLITE_MAGIC)

      // Sidecar exists and round-trips.
      const sidecar = JSON.parse(await fs.readFile(path.join(BackupService.getBackupDir(), `${meta.filename}.json`), 'utf-8'))
      expect(sidecar.filename).toBe(meta.filename)
    })

    it('gzips and the snapshot gunzips back to a valid SQLite file', async () => {
      const meta = await BackupService.createSnapshot({ kind: 'scheduled', gzip: true })
      expect(meta.filename.endsWith('.db.gz')).toBe(true)

      const gz = await BackupService.readSnapshot(meta.filename)
      const plain = gunzipSync(gz)
      expect(plain.subarray(0, SQLITE_MAGIC.length).toString('binary')).toBe(SQLITE_MAGIC)
    })

    it('aborts when there is not enough disk space', async () => {
      const spy = jest.spyOn(BackupService, 'freeDiskBytes').mockResolvedValue(0)
      await expect(BackupService.createSnapshot({ kind: 'manual' })).rejects.toThrow(/disk space/i)
      spy.mockRestore()
    })
  })

  describe('list / delete', () => {
    it('lists snapshots newest-first and synthesizes metadata for orphans', async () => {
      await makeFakeSnapshot('btc-backup-2024-01-01.db', 'manual', '2024-01-01T00:00:00.000Z')
      await makeFakeSnapshot('btc-backup-2024-03-01.db', 'manual', '2024-03-01T00:00:00.000Z')
      // Orphan with no sidecar:
      const dir = BackupService.getBackupDir()
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, 'btc-backup-orphan.db'), SQLITE_MAGIC)

      const list = await BackupService.listSnapshots()
      expect(list).toHaveLength(3)
      expect(list[0].createdAt >= list[1].createdAt).toBe(true)
      const orphan = list.find((s) => s.filename === 'btc-backup-orphan.db')
      expect(orphan?.appVersion).toBe('unknown')
    })

    it('deletes a snapshot and its sidecar', async () => {
      await makeFakeSnapshot('btc-backup-del.db', 'manual', '2024-01-01T00:00:00.000Z')
      await BackupService.deleteSnapshot('btc-backup-del.db')
      const list = await BackupService.listSnapshots()
      expect(list).toHaveLength(0)
      await expect(fs.access(path.join(BackupService.getBackupDir(), 'btc-backup-del.db.json'))).rejects.toThrow()
    })
  })

  describe('applyRetention', () => {
    it('keeps the newest N scheduled and never deletes manual/safety', async () => {
      await makeFakeSnapshot('btc-backup-auto-1.db', 'scheduled', '2024-01-01T00:00:00.000Z')
      await makeFakeSnapshot('btc-backup-auto-2.db', 'scheduled', '2024-02-01T00:00:00.000Z')
      await makeFakeSnapshot('btc-backup-auto-3.db', 'scheduled', '2024-03-01T00:00:00.000Z')
      await makeFakeSnapshot('btc-backup-manual.db', 'manual', '2020-01-01T00:00:00.000Z')
      await makeFakeSnapshot('pre-restore-x.db', 'safety', '2020-01-01T00:00:00.000Z')

      const deleted = await BackupService.applyRetention({ keepLast: 2 })
      expect(deleted).toEqual(['btc-backup-auto-1.db'])

      const remaining = (await BackupService.listSnapshots()).map((s) => s.filename).sort()
      expect(remaining).toContain('btc-backup-manual.db')
      expect(remaining).toContain('pre-restore-x.db')
      expect(remaining).not.toContain('btc-backup-auto-1.db')
    })

    it('deletes scheduled snapshots older than keepDays', async () => {
      const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
      const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      await makeFakeSnapshot('btc-backup-auto-old.db', 'scheduled', old)
      await makeFakeSnapshot('btc-backup-auto-recent.db', 'scheduled', recent)

      const deleted = await BackupService.applyRetention({ keepDays: 30 })
      expect(deleted).toEqual(['btc-backup-auto-old.db'])
    })
  })

  describe('config', () => {
    it('returns defaults when no config file exists', async () => {
      const cfg = await BackupService.getConfig()
      expect(cfg.enabled).toBe(false)
      expect(cfg.retention.keepLast).toBe(7)
    })

    it('persists and deep-merges retention on save', async () => {
      await BackupService.saveConfig({ enabled: true, retention: { keepLast: 3 } })
      const cfg = await BackupService.getConfig()
      expect(cfg.enabled).toBe(true)
      expect(cfg.retention.keepLast).toBe(3)
      expect(cfg.retention.keepDays).toBe(30) // default preserved
    })
  })

  describe('restore validation', () => {
    // These reject during validation, BEFORE any destructive action (safety
    // backup / file swap), so they never touch the live DB.

    it('rejects a non-SQLite upload and releases the lock', async () => {
      await expect(BackupService.restoreFromBuffer(Buffer.from('definitely not a sqlite database')))
        .rejects.toThrow(/not a SQLite/i)
      expect(BackupService.isRestoreInProgress()).toBe(false)
    })

    it('rejects a SQLite db missing required tables', async () => {
      // Build a minimal valid SQLite file that lacks our schema.
      const emptyPath = path.join(tmpDir, 'empty.db')
      const p = new PrismaClient({ datasources: { db: { url: `file:${emptyPath}` } } })
      await p.$executeRawUnsafe('CREATE TABLE dummy (id INTEGER)')
      await p.$disconnect()

      const buf = await fs.readFile(emptyPath)
      await expect(BackupService.restoreFromBuffer(buf)).rejects.toThrow(/missing required table/i)
      expect(BackupService.isRestoreInProgress()).toBe(false)
      await fs.rm(emptyPath, { force: true })
    })
  })
})
