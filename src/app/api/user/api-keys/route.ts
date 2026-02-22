import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireApiAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const authResult = await requireApiAuth(request)
  if ('error' in authResult) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
  }

  // Only allow session-based auth (not API keys) for key management
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer btct_')) {
    return NextResponse.json(
      { success: false, error: 'API key management requires session authentication' },
      { status: 403 }
    )
  }

  const userId = parseInt(authResult.user.id)

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      keyPrefix: true,
      label: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ success: true, data: keys })
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiAuth(request)
  if ('error' in authResult) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
  }

  // Only allow session-based auth (not API keys) for key management
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer btct_')) {
    return NextResponse.json(
      { success: false, error: 'API key management requires session authentication' },
      { status: 403 }
    )
  }

  const userId = parseInt(authResult.user.id)

  let body: { label?: string; expiresIn?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { label, expiresIn } = body

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Label is required' }, { status: 400 })
  }

  if (label.trim().length > 100) {
    return NextResponse.json({ success: false, error: 'Label must be 100 characters or less' }, { status: 400 })
  }

  // Calculate expiry
  let expiresAt: Date | null = null
  if (expiresIn && expiresIn !== 'never') {
    const now = new Date()
    switch (expiresIn) {
      case '30d':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        break
      default:
        return NextResponse.json({ success: false, error: 'Invalid expiresIn value' }, { status: 400 })
    }
  }

  // Generate key
  const raw = crypto.randomBytes(32).toString('hex')
  const key = `btct_${raw}`
  const keyHash = crypto.createHash('sha256').update(key).digest('hex')
  const keyPrefix = raw.slice(0, 8)

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      keyHash,
      keyPrefix,
      label: label.trim(),
      isActive: true,
      expiresAt
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      id: apiKey.id,
      key,
      keyPrefix,
      label: apiKey.label,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt
    }
  }, { status: 201 })
}
