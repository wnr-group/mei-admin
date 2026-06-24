'use client'

import { useState } from 'react'
import { useCreateTemplate } from '@/lib/hooks/useMeasurementTemplates'
import MeasurementFieldsTable from './MeasurementFieldsTable'
import type { MeasurementTemplate } from '@/lib/services/measurement-templates'

interface Props {
  template: MeasurementTemplate
}

export default function MeasurementTemplateEditor({ template }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const create = useCreateTemplate()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await create.mutateAsync({ name: newName.trim() })
    setNewName(''); setCreating(false)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-gray-900">{template.name}</p>
          <p className="text-xs text-gray-500">v{template.version} · {template.is_active ? 'Active' : 'Inactive'}</p>
        </div>
        <button
          onClick={() => setCreating(v => !v)}
          className="text-xs text-[#c9a465] border border-[#c9a465] px-2 py-1 rounded hover:bg-[#faf8f5]"
        >
          New version
        </button>
      </div>
      {creating && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New template name"
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
          />
          <button type="submit" disabled={create.isPending} className="px-3 py-1 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">Create</button>
          <button type="button" onClick={() => setCreating(false)} className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
        </form>
      )}
      <MeasurementFieldsTable templateId={template.id} />
    </div>
  )
}
