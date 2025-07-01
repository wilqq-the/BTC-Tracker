'use client'

import { useState, useEffect, useRef } from 'react'
import { ThemedText } from './ui/ThemeProvider'

interface PinKeypadProps {
  onPinComplete: (pin: string) => void
  loading?: boolean
  error?: string
  maxLength?: number
}

export default function PinKeypad({ 
  onPinComplete, 
  loading = false, 
  error = '', 
  maxLength = 6 
}: PinKeypadProps) {
  const [pin, setPin] = useState('')
  const [animatingButton, setAnimatingButton] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (loading) return

      const key = event.key
      
      if (key >= '0' && key <= '9') {
        event.preventDefault()
        handleNumberPress(key)
      } else if (key === 'Backspace') {
        event.preventDefault()
        handleBackspace()
      } else if (key === 'Enter' && pin.length >= 4) {
        event.preventDefault()
        onPinComplete(pin)
      }
    }

    // Focus the container to capture keyboard events
    if (containerRef.current) {
      containerRef.current.focus()
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [pin, loading, onPinComplete])

  // Auto-submit when PIN reaches max length
  useEffect(() => {
    if (pin.length === maxLength) {
      setTimeout(() => {
        onPinComplete(pin)
      }, 200) // Small delay for visual feedback
    }
  }, [pin, maxLength, onPinComplete])

  // Clear PIN when error changes (for retry)
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setPin('')
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleNumberPress = (number: string) => {
    if (pin.length < maxLength) {
      setPin(prev => prev + number)
      
      // Button animation
      setAnimatingButton(number)
      setTimeout(() => setAnimatingButton(null), 150)
    }
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
    
    // Button animation
    setAnimatingButton('backspace')
    setTimeout(() => setAnimatingButton(null), 150)
  }

  const handleClear = () => {
    setPin('')
    
    // Button animation
    setAnimatingButton('clear')
    setTimeout(() => setAnimatingButton(null), 150)
  }

  const keypadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'backspace']
  ]

  return (
    <div 
      ref={containerRef}
      className="flex flex-col items-center space-y-8 outline-none"
      tabIndex={0}
    >
      {/* PIN Display */}
      <div className="flex flex-col items-center space-y-4">
        <ThemedText variant="secondary" className="text-lg">
          Enter your PIN
        </ThemedText>
        
        {/* PIN Dots */}
        <div className="flex space-x-4">
          {Array.from({ length: maxLength }, (_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? 'bg-btc-500 border-btc-500 scale-110'
                  : error
                  ? 'border-red-500 bg-red-100 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-red-500 text-sm text-center animate-shake">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center space-x-2 text-btc-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-btc-500"></div>
            <ThemedText variant="secondary" size="sm">
              Signing in...
            </ThemedText>
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4 max-w-xs">
        {keypadButtons.map((row, rowIndex) =>
          row.map((button, colIndex) => {
            const isAnimating = animatingButton === button
            const isNumber = !isNaN(parseInt(button))
            const isBackspace = button === 'backspace'
            const isClear = button === 'clear'
            
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => {
                  if (loading) return
                  
                  if (isNumber) {
                    handleNumberPress(button)
                  } else if (isBackspace) {
                    handleBackspace()
                  } else if (isClear) {
                    handleClear()
                  }
                }}
                disabled={loading}
                className={`
                  w-16 h-16 rounded-full font-semibold text-xl transition-all duration-150 
                  ${isNumber
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-600 hover:border-btc-500 hover:bg-btc-50 dark:hover:bg-btc-900/20'
                    : isClear
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                  }
                  ${isAnimating ? 'scale-95 bg-btc-500 text-white' : ''}
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                  shadow-lg hover:shadow-xl
                `}
              >
                {isBackspace ? (
                  <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                ) : isClear ? (
                  <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : (
                  button
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2">
        <ThemedText variant="muted" size="sm">
          Use keyboard or tap numbers above
        </ThemedText>
        {pin.length >= 4 && pin.length < maxLength && (
          <ThemedText variant="muted" size="xs">
            Press Enter to sign in or continue typing
          </ThemedText>
        )}
      </div>
    </div>
  )
} 