import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, expiresIn = '7d' } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Authenticate user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate NextAuth-compatible JWT token
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Calculate expiration time
    const now = Math.floor(Date.now() / 1000)
    let exp: number
    
    if (expiresIn.endsWith('d')) {
      const days = parseInt(expiresIn.slice(0, -1))
      exp = now + (days * 24 * 60 * 60)
    } else if (expiresIn.endsWith('h')) {
      const hours = parseInt(expiresIn.slice(0, -1))
      exp = now + (hours * 60 * 60)
    } else {
      // Default to 7 days
      exp = now + (7 * 24 * 60 * 60)
    }

    // Create payload compatible with NextAuth JWT structure
    const payload = {
      sub: user.id.toString(),
      id: user.id.toString(),
      email: user.email,
      name: user.name || user.email.split('@')[0],
      iat: now,
      exp: exp,
      jti: Math.random().toString(36).substring(2, 15),
      // Mark as API token for identification
      tokenType: 'api'
    }

    const token = jwt.sign(payload, secret, { algorithm: 'HS256' })

    return NextResponse.json({
      success: true,
      token,
      tokenType: 'Bearer',
      expiresAt: new Date(exp * 1000).toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })

  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to generate token for current session user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Generate token for authenticated user
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const exp = now + (7 * 24 * 60 * 60) // 7 days

    const payload = {
      sub: user.id.toString(),
      id: user.id.toString(),
      email: user.email,
      name: user.name || user.email.split('@')[0],
      iat: now,
      exp: exp,
      jti: Math.random().toString(36).substring(2, 15),
      tokenType: 'api'
    }

    const token = jwt.sign(payload, secret, { algorithm: 'HS256' })

    return NextResponse.json({
      success: true,
      token,
      tokenType: 'Bearer',
      expiresAt: new Date(exp * 1000).toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })

  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 