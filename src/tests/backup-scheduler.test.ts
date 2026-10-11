/**
 * BackupScheduler tests (isolated temp dir, fake timers for interval behaviour).
 */

import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { setupTestDatabase } from './test-db'
import { BackupService } from '../lib/backup-service'
import { BackupScheduler } from '../lib/backup-scheduler'

let tmpDir: string
let tempDbUrl: string
let originalDbUrl: string | undefined

describe('BackupScheduler', () => {
  beforeAll(async () => {
    await setupTestDatabase()
    originalDbUrl = process.env.DATABASE_URL
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'btc-backup-sched-'))
    await fs.copyFile(BackupService.resolveDbPath(), path.join(tmpDir, 'test.db'))
    tempDbUrl = `file:${path.join(tmpDir, 'test.db')}`
    process.env.DATABASE_URL = tempDbUrl
  }, 30000)

  afterAll(async () => {
    process.env.DATABASE_URL = originalDbUrl
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    process.env.DATABASE_URL = tempDbUrl
    BackupScheduler.stop()
    await fs.rm(BackupService.getBackupDir(), { recursive: true, force: true })
  })

  afterEach(() => {
    BackupScheduler.stop()
    jest.useRealTimers()
  })

  it('does not schedule when disabled', async () => {
    await BackupService.saveConfig({ enabled: false })
    await BackupScheduler.start()
    expect(BackupScheduler.getStatus().scheduled).toBe(false)
  })

  it('schedules an interval when enabled', async () => {
    jest.useFakeTimers()
    await BackupService.saveConfig({ enabled: true, intervalHours: 1 })
    await BackupScheduler.start()
    expect(BackupScheduler.getStatus().scheduled).toBe(true)
    BackupScheduler.stop()
    expect(BackupScheduler.getStatus().scheduled).toBe(false)
  })

  it('runNow creates a scheduled snapshot and applies retention', async () => {
    await BackupService.saveConfig({ enabled: true, gzip: false, retention: { keepLast: 2, keepDays: null } })

    const a = await BackupScheduler.runNow()
    const b = await BackupScheduler.runNow()
    const c = await BackupScheduler.runNow()

    expect(a.kind).toBe('scheduled')
    const remaining = (await BackupService.listSnapshots()).filter((s) => s.kind === 'scheduled')
    // keepLast=2 → only the two newest scheduled survive.
    expect(remaining).toHaveLength(2)
    expect(remaining.map((s) => s.filename)).toContain(c.filename)
    expect(remaining.map((s) => s.filename)).not.toContain(a.filename)

    const cfg = await BackupService.getConfig()
    expect(cfg.lastRunAt).not.toBeNull()
    expect(cfg.lastError).toBeNull()
  })
})
