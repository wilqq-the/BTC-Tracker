import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data using Prisma
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        profilePicture: true,
        pinHash: true,
        createdAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      profilePicture: user.profilePicture,
      hasPin: user.pinHash !== null,
      createdAt: user.createdAt
    })

  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, currentPassword, newPassword, newPin, name, displayName } = body

    // Get current user data using Prisma
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    switch (action) {
      case 'change_password':
        if (!currentPassword || !newPassword) {
          return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
        }

        if (newPassword.length < 6) {
          return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 })
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!isCurrentPasswordValid) {
          return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 12)

        // Update password using Prisma
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            passwordHash: newPasswordHash,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({ message: 'Password updated successfully' })

      case 'set_pin':
        if (!newPin) {
          return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
        }

        if (!/^\d{4,6}$/.test(newPin)) {
          return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 })
        }

        // Hash PIN
        const pinHash = await bcrypt.hash(newPin, 12)

        // Update PIN using Prisma
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            pinHash: pinHash,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({ message: 'PIN set successfully' })

      case 'remove_pin':
        // Remove PIN using Prisma
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            pinHash: null,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({ message: 'PIN removed successfully' })

      case 'update_name':
        if (!name) {
          return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        // Update name using Prisma
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            name: name,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({ message: 'Name updated successfully' })

      case 'update_display_name':
        if (displayName !== undefined) {
          // Update display name using Prisma (allow empty string to clear it)
          await prisma.user.update({
            where: { id: user.id },
            data: { 
              displayName: displayName.trim() || null,
              updatedAt: new Date()
            }
          })

          return NextResponse.json({ message: 'Display name updated successfully' })
        } else {
          return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error updating user data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 