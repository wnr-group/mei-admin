'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput({ tags, onChange, placeholder = 'Type and press Enter...' }: TagInputProps) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = input.trim()
      if (val && !tags.includes(val)) {
        onChange([...tags, val])
      }
      setInput('')
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const handleRemove = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#E8E0D5] py-2 focus-within:border-[#B38B5D] transition-colors">
      {tags.map((tag, idx) => (
        <span
          key={idx}
          className="flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E0D5] px-2.5 py-1 text-[11px] font-medium text-zinc-700"
        >
          {tag}
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-hidden bg-transparent"
      />
    </div>
  )
}
