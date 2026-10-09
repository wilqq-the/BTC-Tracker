/**
 * Edge-safe helpers used by `src/middleware.ts`.
 *
 * The middleware runs in the edge runtime, so it cannot reach the database.
 * It therefore only does cheap, stateless checks:
 *   - JWT bearer tokens are fully verified (signature + expiry + claims).
 *   - API keys (`btct_...`) are checked for the exact format we issue; the
 *     database lookup (existence, revocation, expiry, owner active) happens in
 *     the route via `@/lib/auth-helpers`.
 * Every non-public API route must still authenticate itself — this is only
 * the outer layer.
 */
import { jwtVerify } from 'jose'

/** API keys are `btct_` + 32 random bytes as lowercase hex (see api/user/api-keys). */
const API_KEY_PATTERN = /^btct_[0-9a-f]{64}$/

/**
 * API paths reachable without authentication.
 * - /api/auth/*  NextAuth itself, first-user registration, the sign-in page's
 *                pre-auth checks (check-user, 2fa/login). The remaining
 *                /api/auth routes (token, 2fa setup/verify/disable) check the
 *                session themselves.
 * - /api/health  liveness / DB checks for Docker and monitoring.
 */
const PUBLIC_API_PREFIXES = ['/api/auth/']
const PUBLIC_API_PATHS = ['/api/health', '/api/health/db']

export function isPublicApiPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (PUBLIC_API_PATHS.includes(path)) return true
  return PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function isWellFormedApiKey(token: string): boolean {
  return API_KEY_PATTERN.test(token)
}

/**
 * Returns true if the bearer token may proceed to the route handler.
 * JWTs are verified completely; API keys only by format (see above).
 */
export async function isBearerTokenAcceptable(token: string, secret: string | undefined): Promise<boolean> {
  if (!token) return false

  if (token.startsWith('btct_')) {
    return isWellFormedApiKey(token)
  }

  if (!secret) return false

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return Boolean(payload.sub && payload.email)
  } catch {
    return false
  }
}
