import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating upload directory:', error)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const token = await getToken({ req: request })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' 
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 5MB.' 
      }, { status: 400 })
    }

    // Get user ID
    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name)
    const filename = `avatar-${user.id}-${Date.now()}${fileExtension}`
    const filepath = path.join(UPLOAD_DIR, filename)

    // Ensure upload directory exists
    await ensureUploadDir()

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)

    // Update user profile picture in database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { profilePicture: `/uploads/avatars/${filename}` },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        profilePicture: true
      }
    })

    return NextResponse.json({
      message: 'Profile picture updated successfully',
      profilePicture: updatedUser.profilePicture,
      user: updatedUser
    })

  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const token = await getToken({ req: request })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Remove profile picture from database
    const updatedUser = await prisma.user.update({
      where: { email: token.email },
      data: { profilePicture: null },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        profilePicture: true
      }
    })

    return NextResponse.json({
      message: 'Profile picture removed successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Error removing avatar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 