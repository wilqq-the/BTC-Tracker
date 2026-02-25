/**
 * Exchange Connection Test API
 * POST - Test connection credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';
import { ExchangeSyncService } from '@/lib/exchange-sync-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId) => {
    const { id } = await params;
    const connectionId = parseInt(id);

    if (isNaN(connectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid connection ID' }, { status: 400 });
    }

    try {
      const result = await ExchangeSyncService.testConnection(connectionId, userId);

      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Connection successful' : `Connection failed: ${result.error}`,
        error: result.error,
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
