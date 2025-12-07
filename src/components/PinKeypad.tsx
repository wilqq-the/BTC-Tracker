'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { DeleteIcon, CheckIcon, TrashIcon } from 'lucide-react'

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
  const [submittedPins, setSubmittedPins] = useState<Set<string>>(new Set())
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
      } else if (key === 'Enter' && pin.length >= 4 && !submittedPins.has(pin)) {
        event.preventDefault()
        setSubmittedPins(prev => new Set(prev).add(pin))
        onPinComplete(pin)
      }
    }

    if (containerRef.current) {
      containerRef.current.focus()
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [pin, loading, onPinComplete, submittedPins])

  // Auto-submit when PIN reaches max length
  useEffect(() => {
    if (pin.length === maxLength && !submittedPins.has(pin)) {
      setSubmittedPins(prev => new Set(prev).add(pin))
      setTimeout(() => {
        onPinComplete(pin)
      }, 200)
    }
  }, [pin, maxLength, onPinComplete, submittedPins])

  // Clear PIN when error changes
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setPin('')
        setSubmittedPins(new Set())
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleNumberPress = (number: string) => {
    if (pin.length < maxLength) {
      setPin(prev => prev + number)
      setAnimatingButton(number)
      setTimeout(() => setAnimatingButton(null), 150)
    }
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
    setAnimatingButton('backspace')
    setTimeout(() => setAnimatingButton(null), 150)
  }

  const handleClear = () => {
    setPin('')
    setSubmittedPins(new Set())
    setAnimatingButton('clear')
    setTimeout(() => setAnimatingButton(null), 150)
  }

  const handleSubmit = () => {
    if (pin.length >= 4 && !submittedPins.has(pin)) {
      setSubmittedPins(prev => new Set(prev).add(pin))
      onPinComplete(pin)
      setAnimatingButton('submit')
      setTimeout(() => setAnimatingButton(null), 150)
    }
  }

  const keypadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [pin.length >= 4 ? 'submit' : 'clear', '0', 'backspace']
  ]

  return (
    <div 
      ref={containerRef}
      className="flex flex-col items-center space-y-6 outline-none"
      tabIndex={0}
    >
      {/* PIN Display */}
      <div className="flex flex-col items-center space-y-3">
        <p className="text-sm text-muted-foreground">Enter your PIN</p>
        
        {/* PIN Dots */}
        <div className="flex gap-3">
          {Array.from({ length: maxLength }, (_, i) => (
            <div
              key={i}
              className={cn(
                "size-4 rounded-full border-2 transition-all duration-200",
                i < pin.length
                  ? 'bg-primary border-primary scale-110'
                  : error
                  ? 'border-destructive bg-destructive/10'
                  : 'border-muted-foreground/30'
              )}
            />
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center gap-2 text-primary">
            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Signing in...</span>
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {keypadButtons.map((row, rowIndex) =>
          row.map((button, colIndex) => {
            const isAnimating = animatingButton === button
            const isNumber = !isNaN(parseInt(button))
            const isBackspace = button === 'backspace'
            const isClear = button === 'clear'
            const isSubmit = button === 'submit'
            
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => {
                  if (loading) return
                  if (isNumber) handleNumberPress(button)
                  else if (isBackspace) handleBackspace()
                  else if (isClear) handleClear()
                  else if (isSubmit) handleSubmit()
                }}
                disabled={loading || (isSubmit && (pin.length < 4 || submittedPins.has(pin)))}
                className={cn(
                  "size-16 rounded-xl font-semibold text-xl transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
                  isNumber && "bg-card border border-border text-foreground hover:bg-muted hover:border-primary/50",
                  isClear && "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
                  isSubmit && "bg-profit/10 text-profit border border-profit/20 hover:bg-profit/20 disabled:opacity-40 disabled:cursor-not-allowed",
                  isBackspace && "bg-muted text-muted-foreground border border-border hover:bg-muted/80",
                  isAnimating && "scale-95 bg-primary text-primary-foreground border-primary",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                {isBackspace ? (
                  <DeleteIcon className="size-5 mx-auto" />
                ) : isClear ? (
                  <TrashIcon className="size-5 mx-auto" />
                ) : isSubmit ? (
                  <CheckIcon className="size-5 mx-auto" />
                ) : (
                  button
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Instructions */}
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground">
          Use keyboard or tap numbers
        </p>
        {pin.length >= 4 && pin.length < maxLength && (
          <p className="text-xs text-muted-foreground">
            Press Enter or tap <CheckIcon className="inline size-3" /> to sign in
          </p>
        )}
        {pin.length < 4 && (
          <p className="text-xs text-muted-foreground">
            Enter at least 4 digits
          </p>
        )}
      </div>
    </div>
  )
}
