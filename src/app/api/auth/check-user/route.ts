import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
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

    if (users.length === 0) {
      return NextResponse.json({
        singleUser: false,
        email: null,
        hasPin: false
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
      hasPin: false
    })

  } catch (error) {
    console.error('Error checking user info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 