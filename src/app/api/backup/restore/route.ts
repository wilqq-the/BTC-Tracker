import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { BackupService } from '@/lib/backup-service';

export const runtime = 'nodejs';

/**
 * POST /api/backup/restore  (DESTRUCTIVE — replaces ALL data)
 * Accepts either:
 *  - multipart/form-data with a `file` field (uploaded backup), or
 *  - JSON `{ filename }` to restore an existing server-side snapshot.
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async () => {
    if (BackupService.isRestoreInProgress()) {
      return NextResponse.json({ success: false, error: 'A restore is already in progress' }, { status: 409 });
    }

    try {
      const contentType = request.headers.get('content-type') || '';
      let result;

      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') {
          return NextResponse.json({ success: false, error: 'No backup file provided' }, { status: 400 });
        }
        const buffer = Buffer.from(await (file as File).arrayBuffer());
        result = await BackupService.restoreFromBuffer(buffer, { sourceName: (file as File).name });
      } else {
        const body = await request.json().catch(() => ({} as { filename?: string }));
        if (!body?.filename) {
          return NextResponse.json({ success: false, error: 'filename is required' }, { status: 400 });
        }
        result = await BackupService.restoreFromServerSnapshot(body.filename);
      }

      return NextResponse.json({ success: true, data: result, message: 'Restore complete' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (/RESTORE_IN_PROGRESS/.test(msg)) {
        return NextResponse.json({ success: false, error: 'A restore is already in progress' }, { status: 409 });
      }
      if (/not a SQLite|missing required table|newer app version|Invalid backup filename/i.test(msg)) {
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
      }
      console.error('Restore failed:', error);
      return NextResponse.json({ success: false, error: 'Restore failed', message: msg }, { status: 500 });
    }
  });
}
