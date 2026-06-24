'use client'

import { useTemplates } from '@/lib/hooks/useMeasurementTemplates'

interface Props {
  value: string | undefined
  onChange: (templateId: string | undefined) => void
}

export default function TemplateMappingSelector({ value, onChange }: Props) {
  const { data: templates, isLoading } = useTemplates()

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || undefined)}
      disabled={isLoading}
      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465] disabled:bg-gray-50"
    >
      <option value="">No measurement template</option>
      {templates?.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
    </select>
  )
}
