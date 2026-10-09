import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'
import { getToken } from 'next-auth/jwt'
import { isBearerTokenAcceptable, isPublicApiPath } from '@/lib/middleware-auth'

// Pages: redirect to the sign-in page when there is no NextAuth session.
const pageMiddleware = withAuth({
  pages: {
    signIn: '/auth/signin'
  }
})

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized - Valid authentication required' },
    { status: 401 }
  )
}

/**
 * Outer authentication layer. API routes still authenticate themselves via
 * `@/lib/auth-helpers` (API keys can only be checked against the database
 * there); this rejects requests that are obviously unauthenticated early.
 */
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/')) {
    if (isPublicApiPath(pathname)) {
      return NextResponse.next()
    }

    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const ok = await isBearerTokenAcceptable(authHeader.substring(7), process.env.NEXTAUTH_SECRET)
      return ok ? NextResponse.next() : unauthorized()
    }

    const sessionToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    return sessionToken ? NextResponse.next() : unauthorized()
  }

  return pageMiddleware(req as NextRequestWithAuth, event)
}

export const config = {
  matcher: [
    // Every app page except the sign-in/sign-up pages (and static assets)
    '/',
    '/transactions/:path*',
    '/analytics/:path*',
    '/goals/:path*',
    '/settings/:path*',
    '/api/:path*'
  ]
}
