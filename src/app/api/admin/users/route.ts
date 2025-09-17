import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth-helpers';
import bcrypt from 'bcryptjs';

// GET - List all users (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (adminUserId, adminUser) => {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';
    
    const users = await prisma.user.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Include basic user stats (no financial data)
        _count: {
          select: {
            transactions: true,
            customCurrencies: true
          }
        }
      },
      orderBy: [
        { isAdmin: 'desc' }, // Admins first
        { createdAt: 'asc' }  // Then by creation date
      ]
    });

    return NextResponse.json({
      success: true,
      data: users,
      message: `Retrieved ${users.length} users`
    });
  });
}

// POST - Create new user (admin only)
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (adminUserId, adminUser) => {
    try {
      const body = await request.json();
      const { email, password, name, displayName, isAdmin = false } = body;

      // Validate required fields
      if (!email || !password) {
        return NextResponse.json({
          success: false,
          error: 'Email and password are required'
        }, { status: 400 });
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return NextResponse.json({
          success: false,
          error: 'User with this email already exists'
        }, { status: 409 });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: name || null,
          displayName: displayName || null,
          isAdmin: Boolean(isAdmin),
          isActive: true
        },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          isAdmin: true,
          isActive: true,
          createdAt: true
        }
      });

      return NextResponse.json({
        success: true,
        data: newUser,
        message: 'User created successfully'
      }, { status: 201 });

    } catch (error) {
      console.error('Error creating user:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create user'
      }, { status: 500 });
    }
  });
}
