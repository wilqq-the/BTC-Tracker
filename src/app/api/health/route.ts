import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AppInitializationService } from '@/lib/app-initialization'

export async function GET() {
  try {
    // Ensure app is initialized (this will be a no-op if already initialized)
    await AppInitializationService.initialize();
    
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    return NextResponse.json(health)
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      { status: 503 }
    )
  }
} 