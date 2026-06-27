import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { BackupService } from '@/lib/backup-service';

export const runtime = 'nodejs';

/**
 * GET /api/backup/:filename/download
 * Stream an existing server-side snapshot to the browser.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAdminAuth(request, async () => {
    const { filename } = await params;
    try {
      const buffer = await BackupService.readSnapshot(filename);
      // Node Buffer is a valid body at runtime; cast past the DOM BodyInit type.
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (/Invalid backup filename/i.test(msg)) {
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
      }
      console.error('Downloading backup failed:', error);
      return NextResponse.json({ success: false, error: 'Failed to download backup', message: msg }, { status: 500 });
    }
  });
}
