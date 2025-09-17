import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Log the database URL to ensure connection is proper
    console.log('[AUTH CHECK] Checking for existing users...');
    
    // Get all users count and first user info using Prisma
    const users = await prisma.user.findMany({
      select: {
        email: true,
        pinHash: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    console.log(`[AUTH CHECK] Found ${users.length} users in database`);

    if (users.length === 0) {
      // Double-check by counting
      const userCount = await prisma.user.count();
      console.log(`[AUTH CHECK] User count verification: ${userCount}`);
      
      if (userCount > 0) {
        // There are users but query failed, don't redirect to signup
        console.error('[AUTH CHECK] Users exist but query failed, returning error');
        return NextResponse.json({ 
          error: 'Database query issue, please refresh' 
        }, { status: 500 })
      }
      
      return NextResponse.json({
        singleUser: false,
        email: null,
        hasPin: false,
        noUsers: true
      })
    }

    if (users.length === 1) {
      return NextResponse.json({
        singleUser: true,
        email: users[0].email,
        hasPin: users[0].pinHash !== null
      })
    }

    return NextResponse.json({
      singleUser: false,
      email: null,
      hasPin: false,
      multipleUsers: true
    })

  } catch (error) {
    console.error('[AUTH CHECK] Critical error checking user info:', error)
    // Don't redirect to signup on error - might just be a temporary issue
    return NextResponse.json({ 
      error: 'Database connection issue, please refresh',
      temporary: true 
    }, { status: 503 }) // 503 Service Unavailable
  }
} 