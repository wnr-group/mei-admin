// components/products/sizes/SizeEntryTable.tsx
'use client'

import { useSizeSystemEntries } from '@/lib/hooks/useSizeSystems'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export default function SizeEntryTable({ systemId }: { systemId: string }) {
  const { data: entries, isLoading } = useSizeSystemEntries(systemId)

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (!entries?.length) return <EmptyState message="No size entries in this system." />

  return (
    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
      <thead className="bg-gray-50">
        <tr>
          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Size</th>
          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Bust (cm)</th>
          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Waist (cm)</th>
          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Hip (cm)</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(entry => (
          <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{entry.label}</td>
            <td className="px-3 py-2 text-right text-gray-600">{entry.bust_cm ?? '—'}</td>
            <td className="px-3 py-2 text-right text-gray-600">{entry.waist_cm ?? '—'}</td>
            <td className="px-3 py-2 text-right text-gray-600">{entry.hip_cm ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
