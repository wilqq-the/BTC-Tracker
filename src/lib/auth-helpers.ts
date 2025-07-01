import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { jwtVerify } from 'jose'

export interface AuthUser {
  id: string
  email: string
  name?: string
}

/**
 * Get NextAuth JWT token from request (works with both cookies and Authorization header)
 */
export async function getAuthToken(request: NextRequest) {
  // First try standard NextAuth cookie-based token
  let token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  })
  
  // If no cookie token, try Authorization header with Bearer token
  if (!token) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const bearerToken = authHeader.substring(7)
      
      try {
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
        const { payload } = await jwtVerify(bearerToken, secret)
        
        // Convert jose payload to NextAuth token format
        if (payload.sub && payload.email) {
          token = {
            sub: payload.sub as string,
            id: payload.id as string,
            email: payload.email as string,
            name: payload.name as string,
            iat: payload.iat as number,
            exp: payload.exp as number,
            jti: payload.jti as string
          }
        }
      } catch (error) {
        console.error('Bearer token verification failed:', error)
        return null
      }
    }
  }
  
  return token
}

/**
 * Extract user from NextAuth JWT token or Bearer token
 */
export async function verifyApiToken(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = await getAuthToken(request)
    
    if (!token?.sub || !token?.email) {
      return null
    }
    
    // Check token expiration
    if (token.exp && typeof token.exp === 'number' && Date.now() >= token.exp * 1000) {
      console.log('Token expired')
      return null
    }
    
    return {
      id: token.sub,
      email: token.email,
      name: token.name || undefined
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

/**
 * Get authenticated user from API token only
 * For web requests, use NextAuth session directly in your components
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthUser | null> {
  return await verifyApiToken(request)
}

/**
 * Require API token authentication for API routes
 * This works with both NextAuth session cookies and Bearer tokens
 */
export async function requireApiAuth(request: NextRequest): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await verifyApiToken(request)
  
  if (!user) {
    return { error: 'Unauthorized - Valid authentication required', status: 401 }
  }
  
  return { user }
}

/**
 * Legacy function for backward compatibility
 */
export async function requireAuth(request: NextRequest): Promise<{ user: AuthUser } | { error: string; status: number }> {
  return requireApiAuth(request)
}

/**
 * Utility function to extract Bearer token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

/**
 * Check if request is using API token (Bearer) vs session cookie
 */
export function isApiTokenRequest(request: NextRequest): boolean {
  return !!extractBearerToken(request)
} 