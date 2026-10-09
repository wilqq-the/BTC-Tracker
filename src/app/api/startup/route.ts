import { NextRequest, NextResponse } from 'next/server';
import { AppInitializationService } from '@/lib/app-initialization';
import { withAdminAuth, withAuth } from '@/lib/auth-helpers';

/**
 * Startup API endpoint
 * Triggers app initialization when called
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(request, () => runStartup());
}

async function runStartup() {
  try {
    await AppInitializationService.initialize();
    
    const status = AppInitializationService.getStatus();
    return NextResponse.json({
      success: true,
      message: 'Application initialized successfully',
      status
    });
  } catch (error) {
    console.error('Startup initialization failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Application initialization failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get initialization status
 */
export async function GET(request: NextRequest) {
  return withAuth(request, () => getStartupStatus());
}

async function getStartupStatus() {
  try {
    const status = AppInitializationService.getStatus();
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 