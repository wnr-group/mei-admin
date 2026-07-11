'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTemplateFields, useUpsertTemplateField, useDeleteTemplateField, type TemplateField } from '@/hooks/use-template-fields'
import { Skeleton } from '@/components/ui/skeleton'

const ALL_FIELD_KEYS = [
  'bust','upper_bust','under_bust','waist','hip','shoulder',
  'blouse_length','sleeve_length','lehenga_length','bottom_length',
  'dupatta_length','torso_length','back_length','front_length',
  'height','armhole','neck_depth_front','neck_depth_back',
  'neck_circumference','bicep','wrist','elbow',
  'inseam','thigh','knee','calf','ankle',
] as const

function labelFor(f: TemplateField) {
  return f.field_key === 'custom' ? (f.label ?? 'Custom') : f.field_key
}

interface Props {
  templateId: string
  readOnly?: boolean
}

export default function MeasurementFieldsTable({ templateId, readOnly = false }: Props) {
  const { data: fields, isLoading } = useTemplateFields(templateId)
  const upsert = useUpsertTemplateField(templateId)
  const remove = useDeleteTemplateField(templateId)

  const [customName, setCustomName] = useState('')

  const fixedKeys = new Set((fields ?? []).filter(f => f.field_key !== 'custom').map(f => f.field_key))
  const customLabels = new Set((fields ?? []).filter(f => f.field_key === 'custom').map(f => (f.label ?? '').toLowerCase()))

  function toggleRequired(field: TemplateField) {
    upsert.mutate({ id: field.id, template_id: templateId, field_key: field.field_key, label: field.label, is_required: !field.is_required, sort_order: field.sort_order })
  }

  function toggleFixed(key: string) {
    const existing = (fields ?? []).find(f => f.field_key === key)
    if (existing) {
      remove.mutate(existing.id)
    } else {
      const maxOrder = Math.max(0, ...(fields ?? []).map(f => f.sort_order))
      upsert.mutate({ template_id: templateId, field_key: key as TemplateField['field_key'], is_required: false, sort_order: maxOrder + 1 })
    }
  }

  function addCustom() {
    const name = customName.trim()
    if (!name || customLabels.has(name.toLowerCase())) return
    const maxOrder = Math.max(0, ...(fields ?? []).map(f => f.sort_order))
    upsert.mutate(
      { template_id: templateId, field_key: 'custom', label: name, is_required: false, sort_order: maxOrder + 1 },
      { onSuccess: () => setCustomName('') }
    )
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div>
      <p className="text-[9px] font-bold tracking-widest text-zinc-900 uppercase mb-2">Fields</p>
      {(!fields || fields.length === 0) && (
        <p className="text-[12px] text-zinc-400 font-medium mb-3">No fields added yet.</p>
      )}
      {fields && fields.length > 0 && (
        <table className="w-full text-sm mb-4 border border-[#E8E0D5]">
          <thead className="bg-[#FAF8F5]">
            <tr>
              <th className="text-left px-3 py-2 text-[9px] font-bold text-zinc-900 uppercase tracking-widest">Field</th>
              <th className="text-center px-3 py-2 text-[9px] font-bold text-zinc-900 uppercase tracking-widest">Required</th>
              {!readOnly && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.id} className="border-t border-[#E8E0D5]">
                <td className="px-3 py-2 text-[12px] text-zinc-800">
                  {labelFor(f)}
                  {f.field_key === 'custom' && <span className="ml-1.5 text-[9px] text-[#B38B5D] uppercase tracking-wider">custom</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={f.is_required} disabled={readOnly} onChange={() => toggleRequired(f)} className="accent-[#B38B5D] disabled:opacity-50" />
                </td>
                {!readOnly && (
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => remove.mutate(f.id)} className="p-1 hover:bg-zinc-100 text-red-500"><Trash2 size={12} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly && (
        <>
          <p className="text-[9px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Add Standard Fields</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {ALL_FIELD_KEYS.map(key => {
              const active = fixedKeys.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFixed(key)}
                  className={`text-[11px] px-2 py-1 border transition-colors ${active ? 'bg-[#B38B5D] text-white border-[#B38B5D]' : 'border-[#E8E0D5] text-zinc-600 hover:border-[#B38B5D] hover:text-[#B38B5D]'}`}
                >
                  {key}
                </button>
              )
            })}
          </div>

          <p className="text-[9px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Add Custom Field</p>
          <div className="flex gap-2">
            <input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              placeholder="e.g. Trail length"
              className="flex-1 border border-[#E8E0D5] px-3 py-2 text-[12px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:border-[#B38B5D]"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!customName.trim() || customLabels.has(customName.trim().toLowerCase())}
              className="px-4 py-2 bg-[#B38B5D] text-white text-[11px] font-bold tracking-widest uppercase hover:bg-[#A37B4D] disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  )
}
