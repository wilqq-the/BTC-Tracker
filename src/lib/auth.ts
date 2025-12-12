import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        twoFactorVerified: { label: '2FA Verified', type: 'text' } // Flag to indicate 2FA was completed
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Get user using Prisma
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })

          if (!user) {
            console.log('User not found:', credentials.email)
            return null
          }

          const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash)
          
          if (!isValidPassword) {
            console.log('Invalid password for user:', credentials.email)
            return null
          }

          if (!user.isActive) {
            console.log('User is not active:', credentials.email)
            return null
          }

          // Check if 2FA is enabled
          if (user.twoFactorEnabled) {
            // If 2FA is enabled but not verified in this request, reject
            if (credentials.twoFactorVerified !== 'true') {
              // Throw specific error to indicate 2FA is required
              throw new Error('2FA_REQUIRED')
            }
          }
          
          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name || user.email.split('@')[0],
            isAdmin: user.isAdmin,
            isActive: user.isActive
          }
        } catch (error: any) {
          // Re-throw 2FA_REQUIRED error to be handled by client
          if (error.message === '2FA_REQUIRED') {
            throw error
          }
          console.error('Error during login:', error)
          return null
        }
      }
    }),
    CredentialsProvider({
      id: 'pin',
      name: 'PIN',
      credentials: {
        email: { label: 'Email', type: 'email' },
        pin: { label: 'PIN', type: 'password' },
        twoFactorVerified: { label: '2FA Verified', type: 'text' } // Flag to indicate 2FA was completed
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.pin) {
          return null
        }

        try {
          // Get user using Prisma
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })

          if (!user) {
            console.log('User not found for PIN login:', credentials.email)
            return null
          }

          if (!user.pinHash) {
            console.log('No PIN set for user:', credentials.email)
            return null
          }

          const isValidPin = await bcrypt.compare(credentials.pin, user.pinHash)
          
          if (!isValidPin) {
            console.log('Invalid PIN for user:', credentials.email)
            return null
          }

          if (!user.isActive) {
            console.log('User is not active:', credentials.email)
            return null
          }

          // Check if 2FA is enabled
          if (user.twoFactorEnabled) {
            // If 2FA is enabled but not verified in this request, reject
            if (credentials.twoFactorVerified !== 'true') {
              // Throw specific error to indicate 2FA is required
              throw new Error('2FA_REQUIRED')
            }
          }
          
          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name || user.email.split('@')[0],
            isAdmin: user.isAdmin,
            isActive: user.isActive
          }
        } catch (error: any) {
          // Re-throw 2FA_REQUIRED error to be handled by client
          if (error.message === '2FA_REQUIRED') {
            throw error
          }
          console.error('Error during PIN login:', error)
          return null
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin'
  },
  session: {
    strategy: 'jwt',
    // Production: 24 hours, Development/Other: 7 days (effectively infinite for dev)
    maxAge: process.env.NODE_ENV === 'production' ? 24 * 60 * 60 : 7 * 24 * 60 * 60,
  },
  jwt: {
    // Production: 24 hours, Development/Other: 7 days (effectively infinite for dev)
    maxAge: process.env.NODE_ENV === 'production' ? 24 * 60 * 60 : 7 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        // Add additional claims for API token compatibility
        token.sub = user.id
        token.email = user.email
        token.name = user.name
        token.isAdmin = user.isAdmin
        token.isActive = user.isActive
        // Add issued at time for better token validation
        token.iat = Math.floor(Date.now() / 1000)
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        // Ensure session has all necessary fields
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.isActive = token.isActive as boolean
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET
} 