// components/products/sizes/SizeSystemSelector.tsx
'use client'

import { useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { useSizeSystems } from '@/lib/hooks/useSizeSystems'
import { Skeleton } from '@/components/ui/skeleton'
import SizeChartDialog from './SizeChartDialog'
import type { SizeSystem } from '@/lib/services/size-systems'

interface Props {
  value: string | undefined
  onChange: (systemId: string | undefined) => void
}

export default function SizeSystemSelector({ value, onChange }: Props) {
  const { data: systems, isLoading } = useSizeSystems()
  const [chartOpen, setChartOpen] = useState(false)

  const selectedSystem: SizeSystem | null = systems?.find(s => s.id === value) ?? null

  if (isLoading) return <Skeleton className="h-10 w-full" />

  return (
    <div className="flex gap-2">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || undefined)}
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
      >
        <option value="">No size system</option>
        {systems?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {selectedSystem && (
        <button
          onClick={() => setChartOpen(true)}
          title="View size chart"
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          <BarChart2 size={14} /> Chart
        </button>
      )}
      <SizeChartDialog system={chartOpen ? selectedSystem : null} onClose={() => setChartOpen(false)} />
    </div>
  )
}
