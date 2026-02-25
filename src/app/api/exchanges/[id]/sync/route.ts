/**
 * Exchange Sync API
 * POST - Trigger manual sync for a specific exchange connection
 * 
 * Query params:
 *   ?fullSync=true  - Ignore lastSyncAt and fetch all trades from the beginning
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';
import { ExchangeSyncService } from '@/lib/exchange-sync-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Read fullSync from query param BEFORE entering withAuth
  const fullSync = request.nextUrl.searchParams.get('fullSync') === 'true';

  return withAuth(request, async (userId) => {
    const { id } = await params;
    const connectionId = parseInt(id);

    if (isNaN(connectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid connection ID' }, { status: 400 });
    }

    try {
      const result = await ExchangeSyncService.syncExchange(connectionId, userId, fullSync);

      return NextResponse.json({
        success: result.success,
        data: {
          exchangeName: result.exchangeName,
          totalFetched: result.totalFetched,
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
          syncedAt: result.syncedAt.toISOString(),
        },
        message: result.success
          ? `Synced ${result.imported} new transactions (${result.skipped} duplicates skipped)`
          : `Sync failed: ${result.errors[0] || 'Unknown error'}`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }
  });
}
