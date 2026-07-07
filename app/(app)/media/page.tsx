'use client'

import { useState, useCallback } from 'react'
import { Upload, Copy, Check, X, Loader2, AlertCircle, ImageIcon } from 'lucide-react'
import { uploadImportImage } from '@/services/media'
import { getErrorMessage } from '@/lib/errors'

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error'

interface MediaItem {
  id: string
  file: File
  previewUrl: string
  status: UploadStatus
  publicUrl?: string
  errorMessage?: string
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const addFiles = useCallback((files: File[]) => {
    const newItems: MediaItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
    }))

    setItems((prev) => [...prev, ...newItems])

    // Kick off each upload independently — one failing must not block the rest.
    newItems.forEach((item) => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading' } : i))
      )

      uploadImportImage(item.file)
        .then((result) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'done', publicUrl: result.publicUrl } : i
            )
          )
        })
        .catch((err) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: 'error', errorMessage: getErrorMessage(err) }
                : i
            )
          )
        })
    })
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const triggerFileInput = () => {
    document.getElementById('media-file-input')?.click()
  }

  const handleCopy = async (item: MediaItem) => {
    if (!item.publicUrl) return
    await navigator.clipboard.writeText(item.publicUrl)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Media Library
        </h3>
      </div>

      {/* Workflow callout */}
      <div className="bg-[#FAF6F0] border-l-4 border-[#B38B5D] px-6 py-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#B38B5D] mt-0.5 shrink-0" />
        <p className="text-[12px] text-zinc-700 leading-relaxed">
          Upload your product images here first, copy the URLs, then paste them into your import CSV.
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`border border-dashed p-10 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[160px] bg-[#FAF8F5]/30 ${
          isDragging
            ? 'border-[#B38B5D] bg-[#FAF8F5]/50'
            : 'border-[#E8E0D5] hover:border-[#B38B5D] hover:bg-[#FAF8F5]/10'
        }`}
      >
        <input
          type="file"
          id="media-file-input"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Upload className="w-6 h-6 stroke-[1.5] text-zinc-400 mb-2" />
        <p className="text-[12px] text-zinc-500 font-medium">
          Click or drag images here to upload
        </p>
      </div>

      {/* Uploaded Images Grid */}
      {items.length > 0 && (
        <div className="bg-white border border-[#E8E0D5] shadow-xs p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative border border-[#E8E0D5] bg-[#F5F5F5] aspect-square flex flex-col overflow-hidden group"
              >
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="absolute right-1 top-1 z-10 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Status overlay */}
                {item.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}

                {item.status === 'error' && (
                  <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center p-2 text-center">
                    <AlertCircle className="w-4 h-4 text-white mb-1" />
                    <span className="text-[8px] text-white leading-tight">
                      {item.errorMessage ?? 'Upload failed'}
                    </span>
                  </div>
                )}

                {/* Copy URL button — only when done */}
                {item.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => handleCopy(item)}
                    className="absolute bottom-0 inset-x-0 bg-black/70 hover:bg-black text-white text-[9px] font-bold tracking-wider uppercase py-1.5 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3 h-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy URL
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
          <ImageIcon className="w-8 h-8 stroke-[1.5]" />
          <p className="text-[12px] font-medium">No images uploaded yet.</p>
        </div>
      )}

    </div>
  )
}