import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { BackupService } from '@/lib/backup-service';

export const runtime = 'nodejs';

/**
 * GET /api/backup/export
 * Create a fresh full-database snapshot on the fly and stream it to the browser.
 * The snapshot is NOT retained server-side (use POST /api/backup for that).
 * Query: ?gzip=true to gzip the download.
 */
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const gzip = new URL(request.url).searchParams.get('gzip') === 'true';
      const meta = await BackupService.createSnapshot({ kind: 'manual', gzip });
      const buffer = await BackupService.readSnapshot(meta.filename);
      // On-the-fly export: remove the server copy after reading it into memory.
      await BackupService.deleteSnapshot(meta.filename).catch(() => {});

      // Node Buffer is a valid body at runtime; cast past the DOM BodyInit type.
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${meta.filename}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch (error) {
      console.error('Backup export failed:', error);
      return NextResponse.json(
        { success: false, error: 'Backup export failed', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  });
}
