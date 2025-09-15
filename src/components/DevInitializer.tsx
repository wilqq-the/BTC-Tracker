'use client'

import { useEffect, useState } from 'react'

export default function DevInitializer() {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only run in development mode
    if (process.env.NODE_ENV !== 'development') {
      return
    }

    let timeoutId: NodeJS.Timeout

    const initializeApp = async () => {
      try {
        console.log('[START] Development mode: Triggering app initialization...')
        
        const response = await fetch('/api/startup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const result = await response.json()

        if (result.success) {
          console.log('[OK] App initialization completed successfully')
          setInitialized(true)
        } else {
          console.error('[ERROR] App initialization failed:', result.error)
          setError(result.error)
        }
      } catch (error) {
        console.error('[ERROR] Failed to trigger app initialization:', error)
        setError(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    // Delay initialization to ensure Next.js is fully loaded
    timeoutId = setTimeout(initializeApp, 1000)

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  // Don't render anything in production or if already initialized
  if (process.env.NODE_ENV !== 'development' || initialized) {
    return null
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
        <div className="flex">
          <div className="py-1">
            <svg className="fill-current h-4 w-4 text-red-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/>
            </svg>
          </div>
          <div>
            <p className="font-bold">Development Initialization Failed</p>
            <p className="text-sm">{error}</p>
            <p className="text-sm mt-1">
              Try: <code className="bg-red-200 px-1 rounded">npm run dev:setup</code>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state
  return (
    <div className="fixed top-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded z-50">
      <div className="flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
        <div>
          <p className="font-bold">Initializing Development Environment...</p>
          <p className="text-sm">Setting up Bitcoin price scheduler and exchange rates</p>
        </div>
      </div>
    </div>
  )
} 