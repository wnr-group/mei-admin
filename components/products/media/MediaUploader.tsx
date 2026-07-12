'use client'

import { useRef, useState } from 'react'
import { Upload, Link as LinkIcon } from 'lucide-react'
import { useUploadMedia } from '@/lib/hooks/useProductMedia'
import { uploadProductImage } from '@/services/storage'
import { getErrorMessage } from '@/lib/errors'

interface Props {
  productId: string
  colorId?: string
}

type Mode = 'upload' | 'url'

// NOT a <form> — this renders inside ProductForm's <form>, and a nested form is
// invalid HTML (the browser drops it, so a submit button would submit the outer
// product form instead of adding media). Buttons are type="button" and the
// handlers run directly.
export default function MediaUploader({ productId, colorId }: Props) {
  const [mode, setMode] = useState<Mode>('upload')
  const [url, setUrl] = useState('')
  const [altText, setAltText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadMedia(productId, colorId)

  async function addMedia(mediaUrl: string) {
    await upload.mutateAsync({
      product_id: productId,
      url: mediaUrl,
      alt_text: altText || undefined,
      media_type: 'IMAGE',
      color_id: colorId,
    })
    setUrl('')
    setAltText('')
  }

  async function handleAddUrl() {
    if (!url.trim()) return
    setLocalError(null)
    try {
      await addMedia(url.trim())
    } catch (err) {
      setLocalError(getErrorMessage(err))
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalError(null)
    setIsUploading(true)
    try {
      const publicUrl = await uploadProductImage(file, productId)
      await addMedia(publicUrl)
    } catch (err) {
      setLocalError(getErrorMessage(err))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const busy = isUploading || upload.isPending
  const errorMessage = localError ?? (upload.error ? 'Failed to add media.' : null)

  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('upload'); setLocalError(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide rounded border ${mode === 'upload' ? 'bg-[#c9a465] text-white border-[#c9a465]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#c9a465]'}`}
        >
          <Upload size={14} /> Upload
        </button>
        <button
          type="button"
          onClick={() => { setMode('url'); setLocalError(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide rounded border ${mode === 'url' ? 'bg-[#c9a465] text-white border-[#c9a465]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#c9a465]'}`}
        >
          <LinkIcon size={14} /> URL
        </button>
      </div>

      <input
        value={altText}
        onChange={e => setAltText(e.target.value)}
        placeholder="Alt text (optional)"
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
      />

      {mode === 'upload' ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={busy}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:border-0 file:text-sm file:bg-[#c9a465] file:text-white hover:file:bg-[#b8934f] file:cursor-pointer disabled:opacity-50"
          />
          {busy && <p className="mt-2 text-xs text-gray-500">Uploading…</p>}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl() } }}
            placeholder="Image URL"
            className="flex-1 min-w-0 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            disabled={busy || !url.trim()}
            className="px-3 py-2 bg-[#c9a465] text-white text-sm hover:bg-[#b8934f] disabled:opacity-50 whitespace-nowrap"
          >
            {upload.isPending ? '…' : 'Add'}
          </button>
        </div>
      )}

      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
    </div>
  )
}
