'use client'

import React from 'react'
import Image from 'next/image'

interface UserAvatarProps {
  src?: string | null
  name?: string | null
  email?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-2xl'
}

export default function UserAvatar({ 
  src, 
  name, 
  email, 
  size = 'md', 
  className = '' 
}: UserAvatarProps) {
  // Generate initials from name or email
  const getInitials = () => {
    if (name) {
      return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    
    if (email) {
      return email[0].toUpperCase()
    }
    
    return '?'
  }

  // Generate a consistent background color based on name/email
  const getBackgroundColor = () => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-orange-500'
    ]
    
    const identifier = name || email || 'default'
    const hash = identifier.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return colors[Math.abs(hash) % colors.length]
  }

  const baseClasses = `
    inline-flex items-center justify-center rounded-full 
    font-medium text-white overflow-hidden
    ${sizeClasses[size]} ${className}
  `.trim()

  if (src) {
    return (
      <div className={`${baseClasses} bg-gray-200 dark:bg-gray-800`}>
        <Image
          src={src}
          alt={name || email || 'User avatar'}
          width={size === 'xl' ? 96 : size === 'lg' ? 64 : size === 'md' ? 40 : 32}
          height={size === 'xl' ? 96 : size === 'lg' ? 64 : size === 'md' ? 40 : 32}
          className="w-full h-full object-cover"
          unoptimized // For uploaded files
        />
      </div>
    )
  }

  return (
    <div className={`${baseClasses} ${getBackgroundColor()}`}>
      {getInitials()}
    </div>
  )
} 