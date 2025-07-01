'use client'

import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import { ThemedButton, ThemedText } from './ui/ThemeProvider'
import UserAvatar from './UserAvatar'

interface AvatarUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  currentAvatar?: string | null
  userName?: string | null
  userEmail?: string
}

export default function AvatarUploadModal({
  isOpen,
  onClose,
  onUpload,
  currentAvatar,
  userName,
  userEmail
}: AvatarUploadModalProps) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const file = files[0]

    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      await onUpload(selectedFile)
      handleClose()
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setPreview(null)
    setDragOver(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Update Profile Picture
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Avatar */}
        <div className="flex flex-col items-center mb-6">
          <ThemedText variant="secondary" className="mb-3">Current Avatar</ThemedText>
          <UserAvatar 
            src={currentAvatar}
            name={userName}
            email={userEmail}
            size="xl"
          />
        </div>

        {/* Upload Area */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragOver 
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600'
            }
            ${selectedFile ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="space-y-4">
              {preview && (
                <div className="flex justify-center">
                  <Image 
                    src={preview} 
                    alt="Preview" 
                    width={96}
                    height={96}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                </div>
              )}
              <div>
                <ThemedText variant="primary" className="font-medium">
                  {selectedFile.name}
                </ThemedText>
                <ThemedText variant="muted" size="sm">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </ThemedText>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl">📸</div>
              <div>
                <ThemedText variant="primary" className="font-medium">
                  Drag and drop your image here
                </ThemedText>
                <ThemedText variant="muted" size="sm">
                  or click to browse files
                </ThemedText>
              </div>
            </div>
          )}

          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* File Requirements */}
        <ThemedText variant="muted" size="xs" className="mt-2 text-center">
          Supported: JPG, PNG, WebP • Maximum size: 5MB
        </ThemedText>

        {/* Actions */}
        <div className="flex space-x-3 mt-6">
          <ThemedButton
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
            disabled={uploading}
          >
            Cancel
          </ThemedButton>
          <ThemedButton
            variant="primary"
            onClick={handleUpload}
            className="flex-1"
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Picture'}
          </ThemedButton>
        </div>
      </div>
    </div>
  )
} 