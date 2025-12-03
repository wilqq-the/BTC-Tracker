'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PinKeypad from '@/components/PinKeypad'
import { cn } from '@/lib/utils'

// shadcn/ui
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Icons
import { LockIcon, KeyIcon, MailIcon, AlertCircleIcon } from 'lucide-react'

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

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/check-user')
        const data = await response.json()
        
        if (!response.ok) {
          if (data.temporary) {
            setTimeout(() => loadUserInfo(), 2000)
            return
          }
          setError('Database connection issue. Please refresh the page.')
          setInitialLoading(false)
          return
        }
        
        if (!data.error && data.hasOwnProperty('noUsers') && data.noUsers === true) {
          router.push('/auth/signup')
          return
        }
        
        setUserInfo(data)
        
        if (data.singleUser && data.email) {
          setEmail(data.email)
        }
        
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="size-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 size-96 bg-btc-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 size-96 bg-btc-500/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="mx-auto mb-4 size-16 bg-gradient-to-br from-btc-500 to-btc-600 rounded-2xl flex items-center justify-center shadow-lg shadow-btc-500/20">
            <span className="text-white font-bold text-3xl">₿</span>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            {userInfo?.singleUser && userInfo.email 
              ? `Sign in as ${userInfo.email}`
              : 'Sign in to your Bitcoin tracker'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Login Mode Toggle */}
          {(!userInfo?.singleUser || (userInfo?.singleUser && userInfo?.hasPin)) && (
            <div className="flex bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => { setLoginMode('password'); setError(''); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                  loginMode === 'password'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LockIcon className="size-4" />
                Password
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('pin'); setError(''); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                  loginMode === 'pin'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <KeyIcon className="size-4" />
                PIN
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircleIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {loginMode === 'pin' ? (
            /* PIN Login */
            <div className="space-y-6">
              {!userInfo?.singleUser && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <PinKeypad
                onPinComplete={handlePinComplete}
                loading={loading}
                error={error}
                maxLength={6}
              />
            </div>
          ) : (
            /* Password Login */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={userInfo?.singleUser}
                    placeholder="your@email.com"
                    className={cn("pl-9", userInfo?.singleUser && "opacity-60")}
                  />
                </div>
                {userInfo?.singleUser && (
                  <p className="text-xs text-muted-foreground">Auto-detected account</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          )}

          {/* Sign Up Link */}
          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="font-medium text-primary hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
