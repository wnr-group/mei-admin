'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { useUploadMedia } from '@/lib/hooks/useProductMedia'

interface Props {
  productId: string
  colorId?: string
}

export default function MediaUploader({ productId, colorId }: Props) {
  const [url, setUrl] = useState('')
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE')
  const [altText, setAltText] = useState('')
  const upload = useUploadMedia(productId, colorId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    await upload.mutateAsync({ product_id: productId, url: url.trim(), alt_text: altText || undefined, media_type: mediaType, color_id: colorId })
    setUrl(''); setAltText('')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <Upload size={16} className="text-gray-400 mt-2.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Image or video URL"
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
          />
          <div className="flex gap-2">
            <input
              value={altText}
              onChange={e => setAltText(e.target.value)}
              placeholder="Alt text (optional)"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
            <select value={mediaType} onChange={e => setMediaType(e.target.value as 'IMAGE' | 'VIDEO')} className="border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none">
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
            </select>
            <button type="submit" disabled={upload.isPending || !url.trim()} className="px-3 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50 whitespace-nowrap">
              {upload.isPending ? '…' : 'Add'}
            </button>
          </div>
          {upload.error && <p className="text-xs text-red-600">Failed to add media.</p>}
        </div>
      </div>
    </form>
  )
}
