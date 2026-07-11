'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useTemplate, useRenameTemplate } from '@/lib/hooks/useMeasurementTemplates'
import MeasurementFieldsTable from '@/components/products/measurements/MeasurementFieldsTable'

export default function MeasurementTemplateEditPage() {
  const params = useParams()
  const id = params.id as string
  const { data: template, isLoading } = useTemplate(id)
  const rename = useRenameTemplate()

  const [name, setName] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Seed the editable name from the loaded template; `name` stays null until
  // the user (or this fallback) sets it, so edits aren't clobbered on refetch.
  const displayName = name ?? template?.name ?? ''

  async function handleRename() {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed === template?.name) return
    await rename.mutateAsync({ id, name: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <span className="text-xs text-zinc-400 font-inter">Loading template…</span>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="px-8 pt-10 font-inter">
        <p className="text-[13px] text-zinc-600">Template not found.</p>
        <Link href="/measurement-templates" className="text-[11px] font-bold tracking-widest text-[#B38B5D] uppercase">
          ← Back
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[560px] mx-auto pt-6 pb-16 font-inter animate-fade-in">
      <div className="flex items-center text-[10px] tracking-widest uppercase text-zinc-400 font-bold mb-1.5">
        <Link href="/measurement-templates" className="hover:text-zinc-600">Measurement Templates</Link>
        <span className="mx-2 text-[#B38B5D]">/</span>
        <span className="text-zinc-400">Edit</span>
      </div>

      <h1 className="font-serif text-[22px] text-zinc-950 font-medium tracking-wide mb-6">
        {template.name}
      </h1>

      <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs space-y-6">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase">Name</label>
          <div className="flex gap-2 items-end">
            <input
              value={displayName}
              onChange={e => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
              className="flex-1 border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-none focus:border-[#B38B5D]"
            />
            {rename.isPending && <Loader2 className="w-4 h-4 animate-spin text-zinc-400 mb-2" />}
            {saved && <span className="text-[10px] text-green-600 font-bold uppercase tracking-widest mb-2">Saved</span>}
          </div>
        </div>

        <div className="border-t border-[#E8E0D5] pt-6">
          <MeasurementFieldsTable templateId={id} />
        </div>
      </div>
    </div>
  )
}
