import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params
  const keyId = parseInt(id)

  if (isNaN(keyId)) {
    return NextResponse.json({ success: false, error: 'Invalid key ID' }, { status: 400 })
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId }
  })

  if (!apiKey || apiKey.userId !== userId) {
    return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 })
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false }
  })

  return NextResponse.json({ success: true })
}
