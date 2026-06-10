'use client'

import React, { useState } from 'react'
import { Upload, X, GripVertical } from 'lucide-react'
import type { ColorVariant } from '@/types/color-variant'

interface ColorVariantCardProps {
  variant: ColorVariant
  onChange: (updated: ColorVariant) => void
  onRemove: () => void
  onSetDefault: () => void
}

export default function ColorVariantCard({ variant, onChange, onRemove, onSetDefault }: ColorVariantCardProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files)
      addFiles(filesArray)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const addFiles = (files: File[]) => {
    const remainingSlots = 6 - variant.images.length
    const filesToProcess = files.slice(0, remainingSlots)

    filesToProcess.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onChange({ ...variant, images: [...variant.images, reader.result as string] })
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (idx: number) => {
    onChange({ ...variant, images: variant.images.filter((_, i) => i !== idx) })
  }

  const inputId = `cv-file-${variant.id}`

  return (
    <div className={`border p-4 space-y-3 ${variant.isDefault ? 'border-[#C9A465] bg-[#FAF8F5]/50' : 'border-[#E8E0D5]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-zinc-300 cursor-grab" />
          <div
            className="w-5 h-5 border border-[#E8E0D5]"
            style={{ backgroundColor: variant.colorHex || '#ffffff' }}
          />
          <span className="text-[12px] font-medium text-zinc-800">{variant.colorName || 'Unnamed'}</span>
          {variant.isDefault && (
            <span className="text-[8px] font-bold tracking-widest uppercase text-[#B38B5D]">DEFAULT</span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Color fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
            COLOR NAME
          </label>
          <input
            type="text"
            value={variant.colorName}
            onChange={(e) => onChange({ ...variant, colorName: e.target.value })}
            placeholder="e.g. Royal Red"
            className="w-full border-b border-[#E8E0D5] py-1.5 text-[12px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
            HEX CODE
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={variant.colorHex || '#C41E3A'}
              onChange={(e) => onChange({ ...variant, colorHex: e.target.value })}
              className="w-6 h-6 border border-[#E8E0D5] cursor-pointer p-0"
            />
            <input
              type="text"
              value={variant.colorHex}
              onChange={(e) => onChange({ ...variant, colorHex: e.target.value })}
              placeholder="#C41E3A"
              className="w-full border-b border-[#E8E0D5] py-1.5 text-[12px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden focus:border-[#B38B5D] transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
            IMAGES
          </label>
          <span className="text-[9px] text-zinc-400 font-medium">{variant.images.length}/6</span>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById(inputId)?.click()}
          className={`border border-dashed p-4 text-center cursor-pointer transition-colors flex items-center justify-center min-h-[60px] bg-[#FAF8F5]/30 ${
            isDragging
              ? 'border-[#B38B5D] bg-[#FAF8F5]/50'
              : 'border-[#E8E0D5] hover:border-[#B38B5D]'
          }`}
        >
          <input
            type="file"
            id={inputId}
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-zinc-400" />
            <span className="text-[11px] text-zinc-500">Drop images or click</span>
          </div>
        </div>

        {variant.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {variant.images.map((img, idx) => (
              <div
                key={idx}
                className="relative border border-[#E8E0D5] w-[48px] h-[64px] overflow-hidden group"
              >
                <img src={img} alt={`${variant.colorName} ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(idx) }}
                  className="absolute right-0.5 top-0.5 bg-black/60 hover:bg-black text-white rounded-full p-0.5 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Set as default */}
      {!variant.isDefault && (
        <button
          type="button"
          onClick={onSetDefault}
          className="text-[10px] font-medium text-[#B38B5D] hover:text-[#9A7B4A] transition-colors cursor-pointer tracking-wide uppercase"
        >
          Set as Default
        </button>
      )}
    </div>
  )
}
