'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, Copy, Check, X, Loader2, AlertCircle, Search, ExternalLink } from 'lucide-react'
import { uploadImportImage, listImportImages, deleteImportImage } from '@/services/media'
import { getErrorMessage } from '@/lib/errors'
import type { StoredImportImage } from '@/services/media'

type UploadStatus = 'existing' | 'uploading' | 'done' | 'error'

interface MediaItem {
  id: string
  name: string
  path?: string
  previewUrl: string
  status: UploadStatus
  publicUrl?: string
  size?: number
  mimetype?: string
  createdAt: Date
  errorMessage?: string
  file?: File
  inUse?: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function groupByDate(items: MediaItem[]): [string, MediaItem[]][] {
  const map = new Map<string, MediaItem[]>()
  for (const item of items) {
    const key = item.createdAt.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries())
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const objectUrls = useRef<string[]>([])

  useEffect(() => {
    listImportImages()
      .then((stored: StoredImportImage[]) => {
        setItems(stored.map((s) => ({
          id: s.id,
          name: s.name,
          path: s.path,
          previewUrl: s.publicUrl,
          status: 'existing' as const,
          publicUrl: s.publicUrl,
          size: s.size,
          mimetype: s.mimetype,
          createdAt: s.createdAt,
          inUse: s.inUse,
        })))
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    return () => {
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  const addFiles = useCallback((files: File[]) => {
    const newItems: MediaItem[] = files.map((file) => {
      const previewUrl = URL.createObjectURL(file)
      objectUrls.current.push(previewUrl)
      return {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        previewUrl,
        status: 'uploading' as const,
        size: file.size,
        mimetype: file.type,
        createdAt: new Date(),
        file,
      }
    })

    setItems((prev) => [...newItems, ...prev])

    newItems.forEach((item) => {
      uploadImportImage(item.file!)
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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files))
  }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const handleCopy = async (item: MediaItem) => {
    if (!item.publicUrl) return
    await navigator.clipboard.writeText(item.publicUrl)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleRemove = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (item.inUse) return
    if (item.status === 'existing' && item.path) {
      try {
        await deleteImportImage(item.path)
      } catch (err) {
        console.error('[MediaLibrary] delete failed', err)
        return
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  const groups = groupByDate(filtered)

  return (
    <div className="space-y-6 px-8 pt-10 pb-16 font-inter">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase">
          Media Library
        </h3>
        <span className="text-[11px] text-zinc-400">{items.length} / 1000 images</span>
      </div>

      {/* Usage bar */}
      {!loading && (() => {
        const pct = Math.min((items.length / 1000) * 100, 100)
        const isWarn = items.length >= 800
        const isCrit = items.length >= 950
        return (
          <div className="space-y-1.5">
            <div className="w-full h-1.5 bg-[#F0EBE3] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${isCrit ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-[#B38B5D]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {isCrit && (
              <p className="text-[11px] text-red-500 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Storage almost full — delete unused images to free up space.
              </p>
            )}
            {isWarn && !isCrit && (
              <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Approaching storage limit — consider deleting images no longer needed.
              </p>
            )}
          </div>
        )
      })()}

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
        onClick={() => document.getElementById('media-file-input')?.click()}
        className={`border border-dashed p-10 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[140px] ${isDragging
            ? 'border-[#B38B5D] bg-[#FAF8F5]/50'
            : 'border-[#E8E0D5] hover:border-[#B38B5D] bg-[#FAF8F5]/30 hover:bg-[#FAF8F5]/50'
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
        <p className="text-[12px] text-zinc-500 font-medium">Click or drag images here to upload</p>
        <p className="text-[10px] text-zinc-400 mt-1">JPG/JPEG, PNG, WEBP, or GIF — max 5MB per image</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by filename…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-[12px] border border-[#E8E0D5] bg-white placeholder:text-zinc-400 focus:outline-none focus:border-[#B38B5D] transition-colors"
        />
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[12px]">Loading images…</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
          <p className="text-[12px] font-medium">
            {search ? 'No images match your search.' : 'No images uploaded yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([date, groupItems]) => (
            <div key={date}>
              {/* Date marker */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  {date}
                </span>
                <div className="flex-1 h-px bg-[#E8E0D5]" />
                <span className="text-[11px] text-zinc-400">{groupItems.length}</span>
              </div>

              {/* Rows */}
              <div className="border border-[#E8E0D5] bg-white divide-y divide-[#F0EBE3]">
                {groupItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-4 py-3 group hover:bg-[#FAF8F5]/60 transition-colors">

                    {/* Thumbnail */}
                    <div className="w-10 h-10 shrink-0 border border-[#E8E0D5] overflow-hidden bg-[#F5F5F5] relative">
                      {item.status === 'uploading' ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                        </div>
                      ) : item.status === 'error' ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-100">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        </div>
                      ) : (
                        <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-medium text-zinc-800 truncate">{item.name}</p>
                        {item.inUse && (
                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[#F0F7EE] text-[#4A7C59] border border-[#C3DDB8]">
                            In Use
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {item.size ? formatBytes(item.size) : '—'}
                        {item.mimetype ? ` · ${item.mimetype.split('/')[1].toUpperCase()}` : ''}
                        {' · '}
                        {formatTime(item.createdAt)}
                      </p>
                      {item.status === 'error' && (
                        <p className="text-[11px] text-red-500 mt-0.5">{item.errorMessage}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(item.status === 'done' || item.status === 'existing') && item.publicUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopy(item)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 border border-[#E8E0D5] hover:border-[#B38B5D] hover:text-[#B38B5D] transition-colors cursor-pointer"
                          >
                            {copiedId === item.id ? (
                              <><Check className="w-3 h-3" /> Copied</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copy URL</>
                            )}
                          </button>
                          <a
                            href={item.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center p-1.5 border border-[#E8E0D5] hover:border-[#B38B5D] hover:text-[#B38B5D] transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        disabled={item.inUse}
                        title={item.inUse ? 'Cannot delete — image is in use by a product' : 'Delete'}
                        className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${item.inUse ? 'text-zinc-300 cursor-not-allowed' : 'text-zinc-400 hover:text-red-500 cursor-pointer'}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
