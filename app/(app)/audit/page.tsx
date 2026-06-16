'use client'

import { useState } from 'react'
import { useAuditLogs } from '@/hooks/use-audit-logs'
import { RESOURCE_TYPES } from '@/lib/audit'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'

type ActionFilter = 'CREATE' | 'UPDATE' | 'DELETE'
const ACTION_TABS: ActionFilter[] = ['CREATE', 'UPDATE', 'DELETE']

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [selectedAction, setSelectedAction] = useState<ActionFilter | null>(null)
  const [selectedResourceType, setSelectedResourceType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading, error, refetch } = useAuditLogs({
    page,
    limit: 20,
    action: selectedAction ?? undefined,
    resourceType: selectedResourceType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const itemsPerPage = 20
  const totalPages = Math.ceil(total / itemsPerPage)

  const resetFilters = () => {
    setSelectedAction(null)
    setSelectedResourceType('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  if (isLoading) return <TableSkeleton rows={8} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Audit Log
        </h3>
        <button
          onClick={resetFilters}
          className="text-[10px] font-bold tracking-widest text-zinc-400 hover:text-zinc-600 uppercase transition-colors"
        >
          RESET FILTERS
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">

        {/* Row 1: Action tabs + Resource type select */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedAction(null); setPage(1) }}
              className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
                selectedAction === null
                  ? 'bg-[#B38B5D] text-white'
                  : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              ALL ACTIONS
            </button>
            {ACTION_TABS.map((action) => (
              <button
                key={action}
                onClick={() => { setSelectedAction(action); setPage(1) }}
                className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
                  selectedAction === action
                    ? 'bg-[#B38B5D] text-white'
                    : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {action}
              </button>
            ))}
          </div>

          <select
            value={selectedResourceType}
            onChange={(e) => { setSelectedResourceType(e.target.value); setPage(1) }}
            className="border border-[#E8E0D5] bg-white px-3 py-2 text-[11px] font-bold text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
          >
            <option value="">ALL RESOURCES</option>
            {RESOURCE_TYPES.map((rt) => (
              <option key={rt} value={rt}>{rt.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Row 2: Date range */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">FROM</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="border border-[#E8E0D5] bg-white px-3 py-2 text-[11px] text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">TO</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="border border-[#E8E0D5] bg-white px-3 py-2 text-[11px] text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
            />
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState message="No audit log entries found." />
      ) : (
        <div className="bg-white border border-[#E8E0D5] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[22%]">
                    TIMESTAMP
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[13%]">
                    ACTION
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                    RESOURCE TYPE
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                    RESOURCE ID
                  </th>
                  <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                    ACTOR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-[7.5px] font-bold tracking-widest rounded-none uppercase ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-800'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium uppercase">
                      {log.resource_type}
                    </td>
                    <td className="px-6 py-3 text-[11px] text-zinc-500 font-mono">
                      {log.resource_id ? `${log.resource_id.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                      {log.actor_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 border-t border-[#E8E0D5] gap-4 bg-[#FAF8F5]/30">
            <span className="text-[10px] font-medium text-zinc-400 tracking-wide">
              Showing {total === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, total)} of {total} entries
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                    page === 1 ? 'text-zinc-300 border-zinc-100 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  PREV
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-[9px] font-bold transition-all duration-150 ${
                      page === p
                        ? 'bg-[#B38B5D] text-white'
                        : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className={`border border-[#E8E0D5] bg-white px-3.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 ${
                    page === totalPages ? 'text-zinc-300 border-zinc-100 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  NEXT
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
