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
import { ImageUpIcon } from 'lucide-react'
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
          <DialogTitle>Change profile picture</DialogTitle>
        </DialogHeader>

        {/* Current Avatar */}
        <div className="flex flex-col items-center">
          <p className="mb-3 text-[13px] font-semibold text-muted-foreground">Current picture</p>
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
            'card-solid relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
            dragOver && 'border-primary bg-tint-orange',
            selectedFile && !dragOver && 'border-tint-green-fg/50'
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
              <ImageUpIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Drop an image here</p>
                <p className="text-sm text-muted-foreground">or click to choose a file</p>
              </div>
            </div>
          )}

          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            aria-label="Choose a profile picture"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* File Requirements */}
        <p className="text-xs text-muted-foreground text-center">
          JPG, PNG or WebP, up to 5 MB
        </p>

        {/* Actions */}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1 rounded-full font-semibold" disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} className="flex-1 rounded-full font-semibold" disabled={!selectedFile || uploading}>
            {uploading ? 'Uploading...' : 'Use this picture'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
