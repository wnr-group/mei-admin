'use client'

import React, { useState } from 'react'
import { useOrders, useUpdateOrderStatus } from '@/hooks/use-orders'
import { useRealtimeOrders } from '@/hooks/use-realtime-orders'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import type { OrderStatus } from '@/types'

const STATUS_TABS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null)
  const { data, isLoading, error, refetch } = useOrders({ page, limit: 6, status: selectedStatus ?? undefined })
  const updateOrderStatusMutation = useUpdateOrderStatus()

  // Enable real-time updates
  useRealtimeOrders()

  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 6)
  const itemsPerPage = 6

  if (isLoading) return <TableSkeleton rows={6} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatusMutation.mutateAsync({ id: orderId, status: newStatus })
    } catch {
      alert('Failed to update order status')
    }
  }

  if (orders.length === 0) return <EmptyState message="No orders yet." />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">

      {/* Loading overlay for mutations */}
      {updateOrderStatusMutation.isPending && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Updating order...</div>
        </div>
      )}

      {/* 1. Header Page Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Orders
        </h3>
      </div>

      {/* 2. Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setSelectedStatus(null)
            setPage(1)
          }}
          className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
            selectedStatus === null
              ? 'bg-[#B38B5D] text-white'
              : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
          }`}
        >
          ALL
        </button>
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            onClick={() => {
              setSelectedStatus(status)
              setPage(1)
            }}
            className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-colors ${
              selectedStatus === status
                ? 'bg-[#B38B5D] text-white'
                : 'border border-[#E8E0D5] bg-white text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* 3. Order Listing Table Container */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                  ORDER NUMBER
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[20%]">
                  CUSTOMER
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                  TOTAL
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[20%]">
                  STATUS
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%]">
                  DATE
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[15%] text-right">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {orders.map((order) => {
                const formattedTotal = new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0
                }).format(order.total)

                const createdDate = new Date(order.created_at).toLocaleDateString('en-IN')

                return (
                  <tr key={order.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                      {order.customer_id ?? '-'}
                    </td>
                    <td className="px-6 py-3 text-[12px] font-medium text-zinc-900 font-sans">
                      {formattedTotal.replace('INR', '₹')}
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        className="border border-[#E8E0D5] bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                      >
                        {STATUS_TABS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-700 font-medium">
                      {createdDate}
                    </td>
                    <td className="px-6 py-4.5 text-right space-x-3 text-[10px] font-bold tracking-widest">
                      <button className="text-[#B38B5D] hover:text-[#A37B4D] uppercase transition-colors">
                        VIEW
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Table Footer Pagination */}
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
                  page === 1
                    ? 'text-zinc-300 border-zinc-100 cursor-not-allowed'
                    : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                PREV
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
                  page === totalPages
                    ? 'text-zinc-300 border-zinc-100 cursor-not-allowed'
                    : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                NEXT
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
