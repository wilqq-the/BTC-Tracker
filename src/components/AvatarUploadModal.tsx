'use client'

import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Profile Picture</DialogTitle>
        </DialogHeader>

        {/* Current Avatar */}
        <div className="flex flex-col items-center">
          <p className="mb-3 text-sm text-muted-foreground">Current Avatar</p>
          <UserAvatar
            src={currentAvatar}
            name={userName}
            email={userEmail}
            size="xl"
          />
        </div>

        {/* Upload Area */}
        <div
          className={cn(
            'relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors',
            dragOver
              ? 'border-primary/50 bg-primary/5'
              : 'border-border',
            selectedFile && 'border-profit/50 bg-profit/5'
          )}
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
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl">📸</div>
              <div>
                <p className="font-medium text-foreground">Drag and drop your image here</p>
                <p className="text-sm text-muted-foreground">or click to browse files</p>
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
        <p className="text-xs text-muted-foreground text-center">
          Supported: JPG, PNG, WebP • Maximum size: 5MB
        </p>

        {/* Actions */}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1" disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} className="flex-1" disabled={!selectedFile || uploading}>
            {uploading ? 'Uploading...' : 'Upload Picture'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
