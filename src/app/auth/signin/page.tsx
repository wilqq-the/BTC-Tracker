'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemedButton, ThemedText } from '@/components/ui/ThemeProvider'
import PinKeypad from '@/components/PinKeypad'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password')
  const [userInfo, setUserInfo] = useState<{
    singleUser: boolean
    email: string | null
    hasPin: boolean
  } | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const router = useRouter()

  // Load user info on component mount
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/check-user')
        const data = await response.json()
        
        // Handle error responses
        if (!response.ok) {
          if (data.temporary) {
            // Temporary error - retry after a moment
            console.log('Temporary database issue, retrying...')
            setTimeout(() => {
              loadUserInfo() // Retry
            }, 2000)
            return
          }
          console.error('Error from check-user API:', data.error)
          setError('Database connection issue. Please refresh the page.')
          setInitialLoading(false)
          return
        }
        
        // Only redirect to signup if we're certain no users exist
        if (!data.error && data.hasOwnProperty('noUsers') && data.noUsers === true) {
          console.log('No users found, redirecting to registration...')
          router.push('/auth/signup')
          return
        }
        
        setUserInfo(data)
        
        // Auto-fill email if single user
        if (data.singleUser && data.email) {
          setEmail(data.email)
        }
        
        // Set default login mode based on PIN availability
        if (data.singleUser && data.hasPin) {
          setLoginMode('pin')
        }
      } catch (error) {
        console.error('Error loading user info:', error)
        setError('Failed to load. Please refresh the page.')
      } finally {
        setInitialLoading(false)
      }
    }

    loadUserInfo()
  }, [router])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        await getSession()
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePinComplete = async (pin: string) => {
    if (!email) {
      setError('Email is required')
      return
    }

    setError('')
    setLoading(true)

    try {
      const result = await signIn('pin', {
        email,
        pin,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid PIN')
      } else {
        await getSession()
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
            Welcome Back
          </h2>
          <ThemedText variant="secondary" className="mt-2">
            {userInfo?.singleUser && userInfo.email ? (
              <>Sign in as {userInfo.email}</>
            ) : (
              <>Sign in to your Bitcoin tracker</>
            )}
          </ThemedText>
        </div>

        {/* Login Mode Toggle - Only show if user has both password and PIN, or multiple users */}
        {(!userInfo?.singleUser || (userInfo?.singleUser && userInfo?.hasPin)) && (
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMode('password')
                setError('')
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                loginMode === 'password'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('pin')
                setError('')
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                loginMode === 'pin'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              PIN
            </button>
          </div>
        )}

        {loginMode === 'pin' ? (
          /* PIN Login */
          <div className="space-y-6">
            {/* Email field for PIN login (only show if not single user) */}
            {!userInfo?.singleUser && (
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
            )}

            {/* PIN Keypad */}
            <div className="flex justify-center">
              <PinKeypad
                onPinComplete={handlePinComplete}
                loading={loading}
                error={error}
                maxLength={6}
              />
            </div>
          </div>
        ) : (
          /* Password Login */
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <ThemedText variant="primary" className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </ThemedText>
              </div>
            )}

            {/* Email field - auto-filled for single user */}
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
                disabled={userInfo?.singleUser}
                className={`w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-btc-500 focus:border-transparent ${
                  userInfo?.singleUser 
                    ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' 
                    : 'bg-white dark:bg-gray-800'
                }`}
                placeholder="your@email.com"
              />
              {userInfo?.singleUser && (
                <ThemedText variant="muted" size="xs" className="mt-1">
                  Auto-detected user account
                </ThemedText>
              )}
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
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-btc-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <ThemedButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In with Password'}
            </ThemedButton>
          </form>
        )}

        {/* Sign Up Link */}
        <div className="text-center">
          <ThemedText variant="secondary" size="sm">
            Don&apos;t have an account?{' '}
            <Link 
              href="/auth/signup" 
              className="font-medium text-btc-500 hover:text-btc-600 transition-colors"
            >
              Create one here
            </Link>
          </ThemedText>
        </div>
      </div>
    </div>
  )
} 