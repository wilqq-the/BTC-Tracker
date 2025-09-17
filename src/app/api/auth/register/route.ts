import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email, password, name } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Check if this is the first user (should be admin)
    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || email.split('@')[0],
        isAdmin: isFirstUser, // First user is automatically admin
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        isActive: true
      }
    })

    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: newUser
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 