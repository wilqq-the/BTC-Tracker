import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth-helpers';
import bcrypt from 'bcryptjs';

// GET - Get specific user details (admin only)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(request, async (adminUserId, adminUser) => {
    const { id } = await context.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid user ID'
      }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Include basic stats (no sensitive financial data)
        _count: {
          select: {
            transactions: true,
            customCurrencies: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: user
    });
  });
}

// PUT - Update user (admin only)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(request, async (adminUserId, adminUser) => {
    try {
      const { id } = await context.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid user ID'
        }, { status: 400 });
      }

      const body = await request.json();
      const { email, name, displayName, isAdmin, isActive, password } = body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }

      // Prevent admin from deactivating themselves
      if (userId === adminUserId && isActive === false) {
        return NextResponse.json({
          success: false,
          error: 'Cannot deactivate your own account'
        }, { status: 400 });
      }

      // Prevent removing admin status from user ID 1 (first user)
      if (userId === 1 && isAdmin === false) {
        return NextResponse.json({
          success: false,
          error: 'Cannot remove admin status from the first user'
        }, { status: 400 });
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== existingUser.email) {
        const emailTaken = await prisma.user.findUnique({
          where: { email }
        });

        if (emailTaken) {
          return NextResponse.json({
            success: false,
            error: 'Email is already taken'
          }, { status: 409 });
        }
      }

      // Prepare update data
      const updateData: any = {};
      
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (isAdmin !== undefined) updateData.isAdmin = Boolean(isAdmin);
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      
      // Hash new password if provided
      if (password && password.trim() !== '') {
        updateData.passwordHash = await bcrypt.hash(password, 12);
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          isAdmin: true,
          isActive: true,
          updatedAt: true
        }
      });

      return NextResponse.json({
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      });

    } catch (error) {
      console.error('Error updating user:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update user'
      }, { status: 500 });
    }
  });
}

// DELETE - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(request, async (adminUserId, adminUser) => {
    try {
      const { id } = await context.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid user ID'
        }, { status: 400 });
      }

      // Prevent admin from deleting themselves
      if (userId === adminUserId) {
        return NextResponse.json({
          success: false,
          error: 'Cannot delete your own account'
        }, { status: 400 });
      }

      // Prevent deleting user ID 1 (first user)
      if (userId === 1) {
        return NextResponse.json({
          success: false,
          error: 'Cannot delete the first user (admin)'
        }, { status: 400 });
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: {
              transactions: true,
              customCurrencies: true
            }
          }
        }
      });

      if (!user) {
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }

      // Delete user (cascade will handle related data)
      await prisma.user.delete({
        where: { id: userId }
      });

      return NextResponse.json({
        success: true,
        message: `User deleted successfully. Removed ${user._count.transactions} transactions and ${user._count.customCurrencies} custom currencies.`
      });

    } catch (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete user'
      }, { status: 500 });
    }
  });
}
