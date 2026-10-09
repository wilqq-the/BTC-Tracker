/**
 * Backup → restore integrity tests.
 *
 * These exercise the REAL destructive path (createSnapshotFrom + restoreCore:
 * validate → safety backup → file swap → reconnect → migrate/rollback) against
 * fully isolated throwaway databases and dedicated PrismaClients, so the shared
 * test DB and the global Prisma singleton are never touched.
 */

import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { gunzipSync } from 'zlib'
import { PrismaClient } from '@prisma/client'
import { setupTestDatabase } from './test-db'
import { BackupService } from '../lib/backup-service'

let baseDb: string
let migLatest: string
let migOlder: string
let tmpRoot: string

/** Make an isolated copy of the schema'd test DB with a chosen migration marker. */
async function isolatedDb(file: string, migration: string, markerEmail?: string): Promise<PrismaClient> {
  await fs.copyFile(baseDb, file)
  const client = new PrismaClient({ datasources: { db: { url: `file:${file}` } } })
  await client.$connect()
  await client.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "_prisma_migrations" ("id" TEXT PRIMARY KEY, "migration_name" TEXT NOT NULL, "finished_at" DATETIME)')
  await client.$executeRawUnsafe('DELETE FROM "_prisma_migrations"')
  await client.$executeRawUnsafe(`INSERT INTO "_prisma_migrations" ("id","migration_name","finished_at") VALUES ('${migration}','${migration}', CURRENT_TIMESTAMP)`)
  if (markerEmail) await client.user.create({ data: { email: markerEmail, passwordHash: 'x' } })
  return client
}

const hasUser = async (client: PrismaClient, email: string) =>
  (await client.user.findUnique({ where: { email } })) !== null

describe('Backup → restore integrity', () => {
  beforeAll(async () => {
    await setupTestDatabase()
    baseDb = BackupService.resolveDbPath()
    const migs = (await fs.readdir(path.join(process.cwd(), 'prisma', 'migrations'), { withFileTypes: true }))
      .filter((d) => d.isDirectory()).map((d) => d.name).sort()
    migLatest = migs[migs.length - 1]
    migOlder = migs[0]
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'btc-restore-'))
  }, 30000)

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('round-trips data: snapshot → delete → restore brings it back', async () => {
    const dir = await fs.mkdtemp(path.join(tmpRoot, 'rt-'))
    const file = path.join(dir, 'db.db')
    const backupDir = path.join(dir, 'backups')
    const client = await isolatedDb(file, migLatest, 'rt-marker@test.com')

    try {
      const snap = await BackupService.createSnapshotFrom({ client, dbPath: file, backupDir, gzip: false })

      await client.user.deleteMany({ where: { email: 'rt-marker@test.com' } })
      expect(await hasUser(client, 'rt-marker@test.com')).toBe(false)

      const staged = path.join(dir, 'staged.db')
      await fs.copyFile(path.join(backupDir, snap.filename), staged)

      const result = await BackupService.restoreCore({ stagedPath: staged, client, dbPath: file, backupDir })
      expect(result.upgraded).toBe(false)
      expect(await hasUser(client, 'rt-marker@test.com')).toBe(true)
    } finally {
      await client.$disconnect()
    }
  })

  it('round-trips a gzip snapshot', async () => {
    const dir = await fs.mkdtemp(path.join(tmpRoot, 'gz-'))
    const file = path.join(dir, 'db.db')
    const backupDir = path.join(dir, 'backups')
    const client = await isolatedDb(file, migLatest, 'gz-marker@test.com')

    try {
      const snap = await BackupService.createSnapshotFrom({ client, dbPath: file, backupDir, gzip: true })
      expect(snap.filename.endsWith('.db.gz')).toBe(true)

      await client.user.deleteMany({ where: { email: 'gz-marker@test.com' } })

      // Decompress like the upload path does, then restore.
      const staged = path.join(dir, 'staged.db')
      await fs.writeFile(staged, gunzipSync(await fs.readFile(path.join(backupDir, snap.filename))))

      await BackupService.restoreCore({ stagedPath: staged, client, dbPath: file, backupDir })
      expect(await hasUser(client, 'gz-marker@test.com')).toBe(true)
    } finally {
      await client.$disconnect()
    }
  })

  it('runs the migration upgrade hook when the backup is older', async () => {
    const dir = await fs.mkdtemp(path.join(tmpRoot, 'up-'))
    const file = path.join(dir, 'db.db')
    const backupDir = path.join(dir, 'backups')
    const current = await isolatedDb(file, migLatest)            // live DB at latest migration
    const sourceFile = path.join(dir, 'src.db')
    const source = await isolatedDb(sourceFile, migOlder)        // backup from an older migration

    try {
      const snap = await BackupService.createSnapshotFrom({ client: source, dbPath: sourceFile, backupDir, gzip: false })
      await source.$disconnect()

      const staged = path.join(dir, 'staged.db')
      await fs.copyFile(path.join(backupDir, snap.filename), staged)

      const runMigrations = jest.fn().mockResolvedValue(undefined)
      const result = await BackupService.restoreCore({ stagedPath: staged, client: current, dbPath: file, backupDir, runMigrations })

      expect(result.upgraded).toBe(true)
      expect(runMigrations).toHaveBeenCalledTimes(1)
    } finally {
      await current.$disconnect()
    }
  })

  it('rolls back to the safety backup (restoring original data) when restore fails', async () => {
    const dir = await fs.mkdtemp(path.join(tmpRoot, 'rb-'))
    const file = path.join(dir, 'db.db')
    const backupDir = path.join(dir, 'backups')
    const current = await isolatedDb(file, migLatest, 'CURRENT@test.com')   // live data we must not lose
    const sourceFile = path.join(dir, 'src.db')
    const source = await isolatedDb(sourceFile, migOlder, 'OTHER@test.com')  // older → triggers migrate hook

    try {
      const snap = await BackupService.createSnapshotFrom({ client: source, dbPath: sourceFile, backupDir, gzip: false })
      await source.$disconnect()

      const staged = path.join(dir, 'staged.db')
      await fs.copyFile(path.join(backupDir, snap.filename), staged)

      // Migration hook throws AFTER the swap → must roll back to the safety backup.
      const runMigrations = jest.fn().mockRejectedValue(new Error('boom'))
      await expect(
        BackupService.restoreCore({ stagedPath: staged, client: current, dbPath: file, backupDir, runMigrations })
      ).rejects.toThrow(/rolled back/i)

      // Original data is back; the failed restore's data is not present.
      expect(await hasUser(current, 'CURRENT@test.com')).toBe(true)
      expect(await hasUser(current, 'OTHER@test.com')).toBe(false)
    } finally {
      await current.$disconnect()
    }
  })
})
