import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { BackupService, BackupConfig } from '@/lib/backup-service';
import { BackupScheduler } from '@/lib/backup-scheduler';

export const runtime = 'nodejs';

/**
 * GET /api/backup/schedule
 * Return the current backup schedule/retention config plus scheduler status.
 */
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const config = await BackupService.getConfig();
      return NextResponse.json({ success: true, data: { config, status: BackupScheduler.getStatus() } });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to load schedule', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  });
}

/**
 * PUT /api/backup/schedule
 * Update the schedule/retention config and (re)start the scheduler.
 * Body: { enabled?, intervalHours?, gzip?, retention?: { keepLast?, keepDays? } }
 */
export async function PUT(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const body = (await request.json().catch(() => ({}))) as Partial<BackupConfig>;

      const updates: Partial<BackupConfig> = {};
      if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
      if (typeof body.gzip === 'boolean') updates.gzip = body.gzip;
      if (body.intervalHours !== undefined) {
        const h = Number(body.intervalHours);
        if (!Number.isFinite(h) || h < 1) {
          return NextResponse.json({ success: false, error: 'intervalHours must be a number >= 1' }, { status: 400 });
        }
        updates.intervalHours = h;
      }
      if (body.retention) {
        updates.retention = {};
        if (body.retention.keepLast !== undefined && body.retention.keepLast !== null) {
          const n = Number(body.retention.keepLast);
          if (!Number.isInteger(n) || n < 0) {
            return NextResponse.json({ success: false, error: 'retention.keepLast must be a non-negative integer' }, { status: 400 });
          }
          updates.retention.keepLast = n;
        }
        if (body.retention.keepDays !== undefined && body.retention.keepDays !== null) {
          const n = Number(body.retention.keepDays);
          if (!Number.isInteger(n) || n < 0) {
            return NextResponse.json({ success: false, error: 'retention.keepDays must be a non-negative integer' }, { status: 400 });
          }
          updates.retention.keepDays = n;
        }
      }

      const config = await BackupService.saveConfig(updates);
      await BackupScheduler.restart();

      return NextResponse.json({ success: true, data: { config, status: BackupScheduler.getStatus() }, message: 'Schedule updated' });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update schedule', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  });
}
