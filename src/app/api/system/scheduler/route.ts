import { NextRequest, NextResponse } from 'next/server';
import { AppInitializationService } from '@/lib/app-initialization';
import { withAuth, withAdminAuth, AuthUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  return withAuth(request, () => getSchedulerStatus());
}

// Scheduler control affects the whole server, so it is admin-only.
export async function POST(request: NextRequest) {
  return withAdminAuth(request, (_userId, user) => controlScheduler(request, user));
}

async function getSchedulerStatus() {
  try {
    // Get scheduler status
    const status = AppInitializationService.getStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
    });

  } catch (error) {
    console.error('Error getting scheduler status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get scheduler status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function controlScheduler(request: NextRequest, user: AuthUser) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'restart':
        console.log('[SYNC] Manual scheduler restart requested by user:', user.email);
        await AppInitializationService.restart();
        return NextResponse.json({
          success: true,
          message: 'Scheduler restarted successfully',
          data: AppInitializationService.getStatus(),
        });

      case 'update':
        console.log('[SYNC] Manual data update requested by user:', user.email);
        await AppInitializationService.triggerDataUpdate();
        return NextResponse.json({
          success: true,
          message: 'Data update completed successfully',
        });

      case 'initialize':
        console.log('[START] Manual initialization requested by user:', user.email);
        await AppInitializationService.initialize();
        return NextResponse.json({
          success: true,
          message: 'Initialization completed successfully',
          data: AppInitializationService.getStatus(),
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: restart, update, initialize',
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error controlling scheduler:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to control scheduler',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 