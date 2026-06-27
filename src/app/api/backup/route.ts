import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { BackupService } from '@/lib/backup-service';

export const runtime = 'nodejs';

/**
 * GET /api/backup
 * List server-side snapshots (newest first).
 */
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const data = await BackupService.listSnapshots();
      return NextResponse.json({ success: true, data });
    } catch (error) {
      console.error('Listing backups failed:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list backups', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/backup
 * Create and retain a server-side snapshot.
 * Body (optional): { gzip?: boolean, label?: string }
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const body = await request.json().catch(() => ({} as { gzip?: boolean; label?: string }));
      const gzip = typeof body?.gzip === 'boolean' ? body.gzip : (await BackupService.getConfig()).gzip;
      const meta = await BackupService.createSnapshot({ kind: 'manual', gzip, label: body?.label });
      return NextResponse.json({ success: true, data: meta, message: 'Backup created' }, { status: 201 });
    } catch (error) {
      console.error('Creating backup failed:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create backup', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  });
}
