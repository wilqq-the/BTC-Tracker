import { NextRequest, NextResponse } from 'next/server';
import { AppInitializationService } from '@/lib/app-initialization';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  try {
    // Require authentication for scheduler control
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
      }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'restart':
        console.log('🔄 Manual scheduler restart requested by user:', session.user?.email);
        await AppInitializationService.restart();
        return NextResponse.json({
          success: true,
          message: 'Scheduler restarted successfully',
          data: AppInitializationService.getStatus(),
        });

      case 'update':
        console.log('🔄 Manual data update requested by user:', session.user?.email);
        await AppInitializationService.triggerDataUpdate();
        return NextResponse.json({
          success: true,
          message: 'Data update completed successfully',
        });

      case 'initialize':
        console.log('🚀 Manual initialization requested by user:', session.user?.email);
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