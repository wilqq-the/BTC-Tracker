import { NextResponse } from 'next/server';
import { AppInitializationService } from '@/lib/app-initialization';

/**
 * Startup API endpoint
 * Triggers app initialization when called
 */
export async function POST() {
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
export async function GET() {
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