'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemedButton, ThemedText } from '@/components/ui/ThemeProvider'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFirstUser, setIsFirstUser] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const router = useRouter()

  // Check if this is the first user setup
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const response = await fetch('/api/auth/check-user')
        if (response.ok) {
          const data = await response.json()
          // If no users exist, this is first user setup
          setIsFirstUser(!data.singleUser && data.email === null)
        }
      } catch (error) {
        console.error('Error checking user info:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    checkFirstUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Register user
      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      })

      const registerData = await registerResponse.json()

      if (!registerResponse.ok) {
        setError(registerData.error || 'Registration failed')
        return
      }

      // Auto sign in after successful registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('Account created but sign in failed. Please try signing in manually.')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-btc-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-btc-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">₿</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {isFirstUser ? 'Welcome to Bitcoin Tracker!' : 'Create Account'}
          </h2>
          <ThemedText variant="secondary" className="mt-2">
            {isFirstUser 
              ? 'Set up your admin account to get started' 
              : 'Start tracking your Bitcoin portfolio'
            }
          </ThemedText>
        </div>

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <ThemedText variant="primary" className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </ThemedText>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name (Optional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-btc-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-btc-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-btc-500 focus:border-transparent"
              placeholder="••••••••"
            />
            <ThemedText variant="muted" size="sm" className="mt-1">
              Minimum 6 characters
            </ThemedText>
          </div>

          <ThemedButton
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </ThemedButton>
        </form>

        {/* Sign In Link - Only show if not first user */}
        {!isFirstUser && (
          <div className="text-center">
            <ThemedText variant="secondary" size="sm">
              Already have an account?{' '}
              <Link 
                href="/auth/signin" 
                className="font-medium text-btc-500 hover:text-btc-600 transition-colors"
              >
                Sign in here
              </Link>
            </ThemedText>
          </div>
        )}
      </div>
    </div>
  )
} 