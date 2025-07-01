import { withAuth } from 'next-auth/middleware'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

const middleware = withAuth(
      function middleware(req) {
    // Middleware logic handled in authorized callback
      },
      {
        callbacks: {
      authorized: async ({ token, req }) => {
        // For API routes with Bearer tokens, verify manually
        const isApiRoute = req.nextUrl.pathname.startsWith('/api/')
        const authHeader = req.headers.get('authorization')
        
        if (isApiRoute && authHeader?.startsWith('Bearer ')) {
          const bearerToken = authHeader.substring(7)
          
          try {
            // Verify JWT token using NextAuth's secret
            const { payload } = await jwtVerify(bearerToken, secret)
            
            // Check if token has required claims
            if (payload.sub && payload.email) {
              return true
            }
          } catch (error) {
            console.error('Bearer token verification failed:', error)
            return false
          }
        }
        
        // For web routes, require NextAuth session token
        return !!token
      }
        },
        pages: {
          signIn: '/auth/signin'
        }
      }
    )

export default middleware

export const config = {
  matcher: [
    '/',
    '/transactions',
    '/settings',
    '/api/transactions/:path*',
    '/api/settings/:path*',
    '/api/historical-data/:path*'
  ]
} 