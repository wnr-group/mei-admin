'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import {
  useLibraryTemplates,
  useCreateLibraryTemplate,
  useSoftDeleteTemplate,
  useCategoriesUsingTemplate,
} from '@/lib/hooks/useMeasurementTemplates'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'

export default function MeasurementTemplatesPage() {
  const { data, isLoading, error, refetch } = useLibraryTemplates()
  const create = useCreateLibraryTemplate()
  const del = useSoftDeleteTemplate()

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const templates = data ?? []

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    await create.mutateAsync(name)
    setNewName('')
    setCreating(false)
  }

  if (isLoading) return <TableSkeleton rows={5} />
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Measurement Templates
        </h3>
        <button
          type="button"
          onClick={() => setCreating(v => !v)}
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-white text-[10px] font-bold tracking-widest px-6 py-3.5 transition-colors uppercase flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          NEW TEMPLATE
        </button>
      </div>

      {creating && (
        <div className="bg-white border border-[#E8E0D5] p-6 flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-[9px] font-bold tracking-widest text-zinc-900 uppercase mb-1">
              Template Name
            </label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="e.g. Bridal Lehenga"
              className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:border-[#B38B5D]"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || create.isPending}
            className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] font-bold tracking-widest px-5 py-3 uppercase disabled:opacity-40 flex items-center gap-2"
          >
            {create.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Create
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setNewName('') }}
            className="text-[10px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 px-3 py-3 uppercase"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
              <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[70%]">NAME</th>
              <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[30%] text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E0D5]">
            {templates.length > 0 ? (
              templates.map(t => (
                <tr key={t.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                  <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">{t.name}</td>
                  <td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
                    <Link href={`/measurement-templates/${t.id}`} className="text-[#B38B5D] hover:text-[#A37B4D] uppercase">
                      EDIT
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(t.id)}
                      className="text-red-600 hover:text-red-700 uppercase"
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="px-6 py-12 text-center text-[12px] text-zinc-400 font-medium">
                  No templates yet. Create your first measurement template.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pendingDelete && (
        <DeleteDialog
          templateId={pendingDelete}
          templateName={templates.find(t => t.id === pendingDelete)?.name ?? ''}
          pending={del.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await del.mutateAsync(pendingDelete)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

function DeleteDialog({
  templateId,
  templateName,
  pending,
  onCancel,
  onConfirm,
}: {
  templateId: string
  templateName: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { data: usedBy, isLoading } = useCategoriesUsingTemplate(templateId)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E0D5] max-w-md w-full p-8 space-y-4">
        <h4 className="text-[14px] font-bold tracking-wide text-zinc-800 uppercase">Delete template</h4>
        <p className="text-[13px] text-zinc-600">
          Delete <span className="font-semibold text-zinc-900">{templateName}</span>?
        </p>
        {isLoading ? (
          <p className="text-[12px] text-zinc-400">Checking usage…</p>
        ) : usedBy && usedBy.length > 0 ? (
          <div className="bg-[#FAF8F5] border border-[#E8E0D5] px-4 py-3 text-[12px] text-zinc-600">
            Assigned to {usedBy.length} categor{usedBy.length === 1 ? 'y' : 'ies'}:{' '}
            <span className="font-semibold text-zinc-800">{usedBy.map(c => c.name).join(', ')}</span>.
            Those categories will fall back to no template. Products that already overrode their measurements keep their own copies.
          </div>
        ) : (
          <p className="text-[12px] text-zinc-400">Not assigned to any category.</p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="text-[10px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 uppercase px-3 py-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold tracking-widest px-5 py-2.5 uppercase disabled:opacity-50 flex items-center gap-2"
          >
            {pending && <Loader2 className="w-3 h-3 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
