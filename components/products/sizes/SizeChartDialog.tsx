// components/products/sizes/SizeChartDialog.tsx
'use client'

import { X } from 'lucide-react'
import SizeEntryTable from './SizeEntryTable'
import type { SizeSystem } from '@/lib/services/size-systems'

interface Props {
  system: SizeSystem | null
  onClose: () => void
}

export default function SizeChartDialog({ system, onClose }: Props) {
  if (!system) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{system.name}</h2>
            {system.description && <p className="text-sm text-gray-500">{system.description}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          <SizeEntryTable systemId={system.id} />
        </div>
      </div>
    </div>
  )
}
