/**
 * Backup API tests
 *
 * Uses real auth (admin vs non-admin JWTs) so 401/403 are genuinely exercised,
 * and isolates snapshots to a temp dir so the repo/prod DB are never touched.
 */

import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { testDb, setupTestDatabase, cleanTestDatabase } from '../test-db'
import { generateTestToken } from '../test-helpers'
import { BackupService } from '../../lib/backup-service'
import { GET as listGET, POST as createPOST } from '../../app/api/backup/route'
import { GET as exportGET } from '../../app/api/backup/export/route'
import { GET as downloadGET } from '../../app/api/backup/[filename]/download/route'
import { DELETE as deleteDELETE } from '../../app/api/backup/[filename]/route'
import { POST as restorePOST } from '../../app/api/backup/restore/route'

let tmpDir: string
let tempDbUrl: string
let originalDbUrl: string | undefined
let adminToken: string
let userToken: string

function req(method: string, url: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  return new NextRequest(`http://localhost:3000${url}`, init as ConstructorParameters<typeof NextRequest>[1])
}

const fileParams = (filename: string) => ({ params: Promise.resolve({ filename }) })

describe('Backup API', () => {
  beforeAll(async () => {
    await setupTestDatabase()
    originalDbUrl = process.env.DATABASE_URL
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'btc-backup-api-'))
    await fs.copyFile(BackupService.resolveDbPath(), path.join(tmpDir, 'test.db'))
    tempDbUrl = `file:${path.join(tmpDir, 'test.db')}`
    process.env.DATABASE_URL = tempDbUrl
  }, 30000)

  afterAll(async () => {
    process.env.DATABASE_URL = originalDbUrl
    await fs.rm(tmpDir, { recursive: true, force: true })
    await testDb.$disconnect()
  })

  beforeEach(async () => {
    process.env.DATABASE_URL = tempDbUrl
    await fs.rm(BackupService.getBackupDir(), { recursive: true, force: true })
    await cleanTestDatabase()

    const hash = await bcrypt.hash('pw', 10)
    const admin = await testDb.user.create({ data: { email: 'admin@test.com', passwordHash: hash, name: 'Admin', isAdmin: true, isActive: true } })
    const user = await testDb.user.create({ data: { email: 'user@test.com', passwordHash: hash, name: 'User', isAdmin: false, isActive: true } })
    adminToken = generateTestToken(admin)
    userToken = generateTestToken(user)
  })

  describe('auth', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await listGET(req('GET', '/api/backup'))
      expect(res.status).toBe(401)
    })

    it('rejects non-admin requests with 403', async () => {
      const res = await listGET(req('GET', '/api/backup', userToken))
      expect(res.status).toBe(403)
    })
  })

  describe('create / list', () => {
    it('creates a server snapshot (201) and lists it', async () => {
      const createRes = await createPOST(req('POST', '/api/backup', adminToken, { gzip: false }))
      expect(createRes.status).toBe(201)
      const created = await createRes.json()
      expect(created.success).toBe(true)
      expect(created.data.filename).toMatch(/\.db$/)

      // File really exists on disk.
      await expect(fs.access(BackupService.getSnapshotPath(created.data.filename))).resolves.toBeUndefined()

      const listRes = await listGET(req('GET', '/api/backup', adminToken))
      expect(listRes.status).toBe(200)
      const list = await listRes.json()
      expect(list.data.map((s: { filename: string }) => s.filename)).toContain(created.data.filename)
    })
  })

  describe('export', () => {
    it('streams an on-the-fly snapshot as an attachment', async () => {
      const res = await exportGET(req('GET', '/api/backup/export', adminToken))
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/octet-stream')
      expect(res.headers.get('content-disposition')).toMatch(/attachment; filename=/)
      // Not retained server-side.
      const list = await BackupService.listSnapshots()
      expect(list).toHaveLength(0)
    })
  })

  describe('download', () => {
    it('downloads an existing snapshot', async () => {
      const created = await (await createPOST(req('POST', '/api/backup', adminToken, { gzip: false }))).json()
      const res = await downloadGET(req('GET', `/api/backup/${created.data.filename}/download`, adminToken), fileParams(created.data.filename))
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/octet-stream')
    })

    it('returns 404 for a missing snapshot', async () => {
      const res = await downloadGET(req('GET', '/api/backup/nope.db/download', adminToken), fileParams('nope.db'))
      expect(res.status).toBe(404)
    })

    it('rejects path traversal with 400', async () => {
      const res = await downloadGET(req('GET', '/api/backup/x/download', adminToken), fileParams('../../etc/passwd'))
      expect(res.status).toBe(400)
    })
  })

  describe('delete', () => {
    it('deletes a snapshot', async () => {
      const created = await (await createPOST(req('POST', '/api/backup', adminToken, { gzip: false }))).json()
      const res = await deleteDELETE(req('DELETE', `/api/backup/${created.data.filename}`, adminToken), fileParams(created.data.filename))
      expect(res.status).toBe(200)
      expect(await BackupService.listSnapshots()).toHaveLength(0)
    })

    it('rejects path traversal with 400', async () => {
      const res = await deleteDELETE(req('DELETE', '/api/backup/x', adminToken), fileParams('../../etc/passwd'))
      expect(res.status).toBe(400)
    })
  })

  describe('restore', () => {
    it('rejects non-admin with 403', async () => {
      const res = await restorePOST(req('POST', '/api/backup/restore', userToken, { filename: 'x.db' }))
      expect(res.status).toBe(403)
    })

    it('returns 400 when no filename is provided (JSON body)', async () => {
      const res = await restorePOST(req('POST', '/api/backup/restore', adminToken, {}))
      expect(res.status).toBe(400)
    })

    it('returns 409 when a restore is already in progress', async () => {
      const spy = jest.spyOn(BackupService, 'isRestoreInProgress').mockReturnValue(true)
      const res = await restorePOST(req('POST', '/api/backup/restore', adminToken, { filename: 'x.db' }))
      expect(res.status).toBe(409)
      spy.mockRestore()
    })
  })
})
