'use client'

import React, { useState } from 'react'
import { useOrders, useDeleteOrder } from '@/hooks/use-orders'
import { useRealtimeOrders } from '@/hooks/use-realtime-orders'
import { ErrorState } from '@/components/ui/error-state'
import type { OrderStatus } from '@/types'
import Link from 'next/link'

type TabType = 'ALL' | 'PENDING' | 'SHIPPED';

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<TabType>('ALL')

  const selectedStatus = activeTab === 'ALL' ? null : activeTab

  const { data, isLoading, error, refetch } = useOrders({
    page,
    limit: 6,
    status: selectedStatus ?? undefined
  })

  // Enable real-time updates
  useRealtimeOrders()

  const deleteOrderMutation = useDeleteOrder()

  // Tab counts queries using limit: 1 to get total efficiently
  const { data: allCountData } = useOrders({ limit: 1 })
  const { data: pendingCountData } = useOrders({ limit: 1, status: 'PENDING' })
  const { data: shippedCountData } = useOrders({ limit: 1, status: 'SHIPPED' })

  const orders = data?.orders ?? []
  const total = data?.total ?? 0
  const itemsPerPage = 6
  const totalPages = Math.ceil(total / itemsPerPage)

  const allCount = allCountData?.total ?? 0
  const pendingCount = pendingCountData?.total ?? 0
  const shippedCount = shippedCountData?.total ?? 0

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setPage(1)
  }

  const handleDelete = async (id: string, orderNumber: string) => {
    if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return
    try {
      await deleteOrderMutation.mutateAsync(id)
    } catch {
      alert('Failed to delete order')
    }
  }

  // Custom styling mappings for status pills to match Stitch mockups exactly
  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-[#FFF9E6] text-[#B5893D]'
      case 'CONFIRMED':
        return 'bg-[#E1FAF7] text-[#00A896]'
      case 'PROCESSING':
        return 'bg-[#F9EFFF] text-[#8E2DE2]'
      case 'SHIPPED':
        return 'bg-[#FFF5EB] text-[#E07A5F]'
      case 'DELIVERED':
        return 'bg-[#EEFBEF] text-[#4CAF50]'
      case 'CANCELLED':
        return 'bg-[#FFEBEE] text-[#D32F2F]'
      default:
        return 'bg-zinc-100 text-zinc-600'
    }
  }

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING': return 'Pending'
      case 'CONFIRMED': return 'Confirmed'
      case 'PROCESSING': return 'Processing'
      case 'SHIPPED': return 'Shipped'
      case 'DELIVERED': return 'Delivered'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  const getPaymentBadgeStyle = (paymentStatus: 'PAID' | 'FAILED') => {
    switch (paymentStatus) {
      case 'PAID':
        return 'bg-[#EEFBEF] text-[#4CAF50]'
      case 'FAILED':
        return 'bg-[#FFEBEE] text-[#D32F2F]'
      default:
        return 'bg-zinc-100 text-zinc-600'
    }
  }

  const getPaymentText = (paymentStatus: 'PAID' | 'FAILED') => {
    switch (paymentStatus) {
      case 'PAID': return 'Paid'
      case 'FAILED': return 'Failed'
      default: return paymentStatus
    }
  }

  // Indian Rupee currency format (e.g. ₹3,45,000)
  const formatTotal = (total: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    })
      .format(total)
      .replace('INR', '₹')
  }

  // Splits date to match mockup's stacked text layout (e.g., "12 Oct" / "2024")
  const renderDate = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr)
      if (isNaN(dateObj.getTime())) {
        return <div className="text-[12px] text-zinc-500 font-medium font-sans text-right">{dateStr}</div>
      }
      const day = dateObj.getDate()
      const month = dateObj.toLocaleString('en-IN', { month: 'short' })
      const year = dateObj.getFullYear()
      return (
        <div className="text-[12px] text-zinc-500 font-medium leading-relaxed font-sans text-right">
          <div>{day} {month}</div>
          <div>{year}</div>
        </div>
      )
    } catch {
      return <div className="text-[12px] text-zinc-500 font-medium font-sans text-right">{dateStr}</div>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Orders...</span>
        </div>
      </div>
    )
  }

  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <div className="space-y-6 px-8 pt-10 font-inter animate-fade-in">
      {/* 1. Page Header */}
      <h1 className="font-serif text-[32px] text-zinc-950 font-normal tracking-wide">
        Orders
      </h1>

      {/* 2. Filter Tabs (All, Pending, Shipped) */}
      <div className="flex gap-8 border-b border-[#E8E0D5]">
        <button
          onClick={() => handleTabChange('ALL')}
          className={`pb-3 text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'ALL'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-400 border-transparent hover:text-zinc-600'
          }`}
        >
          All ({allCount})
        </button>
        <button
          onClick={() => handleTabChange('PENDING')}
          className={`pb-3 text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'PENDING'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-400 border-transparent hover:text-zinc-600'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => handleTabChange('SHIPPED')}
          className={`pb-3 text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all duration-200 border-b-2 -mb-[1px] ${
            activeTab === 'SHIPPED'
              ? 'text-zinc-900 border-[#B38B5D]'
              : 'text-zinc-400 border-transparent hover:text-zinc-600'
          }`}
        >
          Shipped ({shippedCount})
        </button>
      </div>

      {/* 3. Table Box */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[22%]">
                  ORDER #
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[25%]">
                  CUSTOMER
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[12%]">
                  ITEMS
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[15%]">
                  TOTAL
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[13%]">
                  ORDER STATUS
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[13%]">
                  PAYMENT
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[10%] text-right">
                  DATE
                </th>
                <th className="px-8 py-3.5 text-[9px] font-bold tracking-widest text-zinc-800 uppercase w-[8%] text-right">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {orders.length > 0 ? (
                orders.map((order) => {
                  const customerName = order.customers?.name ?? 'Guest Customer'
                  const customerEmail = order.customers?.email ?? 'No email provided'
                  const itemsCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
                  const paymentStatus = order.status === 'CANCELLED' ? 'FAILED' : 'PAID'

                  return (
                    <tr key={order.id} className="hover:bg-[#FAF8F5]/40 transition-colors">
                      {/* Order # */}
                      <td className="px-8 py-5 text-[12px] font-semibold text-[#B38B5D] font-sans tracking-wide">
                        <Link href={`/orders/${order.id}`} className="hover:text-[#a37b4d] transition-colors cursor-pointer">
                          {order.order_number}
                        </Link>
                      </td>

                      {/* Customer */}
                      <td className="px-8 py-5">
                        <div className="text-[12px] font-bold text-zinc-800">
                          {customerName}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium font-sans">
                          {customerEmail}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-8 py-5 text-[12px] text-zinc-800 font-sans">
                        <span className="font-medium">{itemsCount}</span>{' '}
                        <span className="text-zinc-400">
                          {itemsCount === 1 ? 'item' : 'items'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-8 py-5 text-[12px] font-medium text-zinc-900 font-sans">
                        {formatTotal(order.total)}
                      </td>

                      {/* Order Status */}
                      <td className="px-8 py-5">
                        <span
                          className={`inline-block px-3 py-1 text-[10px] font-semibold tracking-wide rounded-full text-center min-w-[85px] ${getStatusBadgeStyle(
                            order.status
                          )}`}
                        >
                          {getStatusText(order.status)}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="px-8 py-5">
                        <span
                          className={`inline-block px-3 py-1 text-[10px] font-medium tracking-wide rounded-full text-center min-w-[70px] ${getPaymentBadgeStyle(
                            paymentStatus
                          )}`}
                        >
                          {getPaymentText(paymentStatus)}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-8 py-5 text-right">
                        {renderDate(order.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => handleDelete(order.id, order.order_number)}
                          disabled={deleteOrderMutation.isPending}
                          className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${
                            deleteOrderMutation.isPending
                              ? 'text-zinc-300 cursor-not-allowed'
                              : 'text-red-400 hover:text-red-600'
                          }`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-8 py-12 text-center text-[12px] text-zinc-400 font-medium"
                  >
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Table Footer Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 border-t border-[#E8E0D5] gap-4 bg-[#FAF8F5]/30">
            <span className="text-[10px] font-medium text-zinc-400 tracking-wide">
              Showing {total === 0 ? 0 : (page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, total)} of {total} entries
            </span>

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
          </div>
        )}
      </div>
    </div>
  )
}
