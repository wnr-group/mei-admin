'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTemplates, useCreateTemplate } from '@/lib/hooks/useMeasurementTemplates'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import MeasurementTemplateEditor from './MeasurementTemplateEditor'

export default function MeasurementTemplateSelector({ productId }: { productId: string }) {
  const { data: templates, isLoading, error, refetch } = useTemplates({ productId })
  const create = useCreateTemplate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const selected = templates?.find(t => t.id === selectedId) ?? templates?.[0] ?? null

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const t = await create.mutateAsync({ name: newName.trim(), productId })
    setSelectedId(t.id); setShowCreate(false); setNewName('')
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (error) return <ErrorState message="Could not load measurement templates." onRetry={refetch} />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={selectedId ?? selected?.id ?? ''}
          onChange={e => setSelectedId(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
        >
          <option value="">Select a template…</option>
          {templates?.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
        </select>
        <button onClick={() => setShowCreate(v => !v)} className="flex items-center gap-1.5 px-3 py-2 border border-[#c9a465] text-[#c9a465] text-sm rounded hover:bg-[#faf8f5]">
          <Plus size={14} /> New
        </button>
      </div>
      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]" />
          <button type="submit" disabled={create.isPending} className="px-3 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">Create</button>
          <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
        </form>
      )}
      {!selected && templates?.length === 0 && <EmptyState message="No templates yet. Create one to define measurement fields." />}
      {selected && <MeasurementTemplateEditor template={selected} />}
    </div>
  )
}
