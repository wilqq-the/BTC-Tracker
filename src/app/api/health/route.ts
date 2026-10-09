import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AppInitializationService } from '@/lib/app-initialization'
import packageJson from '../../../../package.json'

export async function GET() {
  try {
    // Ensure app is initialized (this will be a no-op if already initialized)
    await AppInitializationService.initialize();
    
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      // package.json, not npm_package_version: Docker runs the server without npm
      version: packageJson.version,
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