'use client'

import { Trash2 } from 'lucide-react'
import { useTemplateFields, useUpsertTemplateField, useDeleteTemplateField, type TemplateField } from '@/hooks/use-template-fields'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

const ALL_FIELD_KEYS = [
  'bust','waist','hip','shoulder','blouse_length','sleeve_length',
  'lehenga_length','height','custom',
] as const

interface Props {
  templateId: string
}

export default function MeasurementFieldsTable({ templateId }: Props) {
  const { data: fields, isLoading } = useTemplateFields(templateId)
  const upsert = useUpsertTemplateField(templateId)
  const remove = useDeleteTemplateField(templateId)

  const fieldMap = Object.fromEntries((fields ?? []).map((f: TemplateField) => [f.field_key, f]))

  function toggleRequired(field: TemplateField) {
    upsert.mutate({ template_id: templateId, field_key: field.field_key, is_required: !field.is_required, sort_order: field.sort_order })
  }

  function toggleField(key: string) {
    const existing = fieldMap[key]
    if (existing) {
      remove.mutate(existing.id)
    } else {
      const maxOrder = Math.max(0, ...(fields ?? []).map((f: TemplateField) => f.sort_order))
      upsert.mutate({ template_id: templateId, field_key: key as TemplateField['field_key'], is_required: false, sort_order: maxOrder + 1 })
    }
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Fields</h4>
      {(!fields || fields.length === 0) && <EmptyState message="No fields added yet." />}
      {fields && fields.length > 0 && (
        <table className="w-full text-sm mb-3 border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Field</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Required</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f: TemplateField) => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-xs">{f.field_key}</td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={f.is_required} onChange={() => toggleRequired(f)} className="accent-[#c9a465]" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => remove.mutate(f.id)} className="p-1 rounded hover:bg-gray-100 text-red-500"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Add Fields</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_FIELD_KEYS.map(key => {
            const active = !!fieldMap[key]
            return (
              <button
                key={key}
                onClick={() => toggleField(key)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${active ? 'bg-[#c9a465] text-white border-[#c9a465]' : 'border-gray-300 text-gray-600 hover:border-[#c9a465] hover:text-[#c9a465]'}`}
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
