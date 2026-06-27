import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { BackupService } from '@/lib/backup-service';

export const runtime = 'nodejs';

/**
 * DELETE /api/backup/:filename
 * Delete a server-side snapshot and its metadata sidecar.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAdminAuth(request, async () => {
    const { filename } = await params;
    try {
      await BackupService.deleteSnapshot(filename);
      return NextResponse.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (/Invalid backup filename/i.test(msg)) {
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
      }
      console.error('Deleting backup failed:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete backup', message: msg }, { status: 500 });
    }
  });
}
