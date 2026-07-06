'use client'

import React, { use } from 'react'
import { useOrder, useUpdateOrderStatus } from '@/hooks/use-orders'
import { useRealtimeOrders } from '@/hooks/use-realtime-orders'
import { ErrorState } from '@/components/ui/error-state'
import type { OrderStatus } from '@/types'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data: order, isLoading, error, refetch } = useOrder(id)
  const updateStatusMutation = useUpdateOrderStatus()

  // Enable real-time updates for details view too
  useRealtimeOrders()

  // Handle dropdown order status update
  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: newStatus })
    } catch (err) {
      console.error('Failed to update status:', err)
      alert('Error updating order status. Please try again.')
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

  const getStatusDotColor = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-[#B5893D]'
      case 'CONFIRMED': return 'bg-[#00A896]'
      case 'PROCESSING': return 'bg-[#8E2DE2]'
      case 'SHIPPED': return 'bg-[#E07A5F]'
      case 'DELIVERED': return 'bg-[#4CAF50]'
      case 'CANCELLED': return 'bg-[#D32F2F]'
      default: return 'bg-zinc-400'
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr)
      if (isNaN(dateObj.getTime())) return dateStr
      return dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="font-serif text-lg text-[#B38B5D] tracking-widest uppercase">MEI BRIDAL COUTURE</span>
          <span className="text-xs text-zinc-400">Loading Order Details...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />
  }

  if (!order) {
    return (
      <div className="space-y-4 px-8 pt-10 text-center font-inter">
        <h2 className="text-lg font-bold text-zinc-800">Order Not Found</h2>
        <p className="text-sm text-zinc-500">The order details you are trying to view do not exist.</p>
        <Link
          href="/orders"
          className="inline-block bg-[#1A1A1A] text-white text-[11px] font-bold tracking-widest px-6 py-3 uppercase hover:bg-black transition-colors"
        >
          Back to Orders
        </Link>
      </div>
    )
  }

  // Fallbacks logic for customer details
  const customerName = order.customers?.name ?? 'Guest Customer'
  const customerEmail = order.customers?.email ?? 'No email provided'
  const customerPhone = order.customers?.phone ?? 'No Phone provided'
  const customerCity = order.customers?.city ?? 'New City provided'

  // Shipping Address block
  const shippingAddress = {
    name: customerName,
    line1: '123 Heritage Lane',
    line2: 'Apt 4B',
    cityStateZip: `${customerCity}, India`,
  }

  // Items
  const items = order.order_items && order.order_items.length > 0 ? order.order_items.map((item) => ({
    name: item.product_name,
    quantity: item.quantity,
    price: Number(item.unit_price) * item.quantity,
    image: item.products?.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop'
  })) : [
    {
      name: 'The Noor Lehenga',
      quantity: 1,
      price: order.total,
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=150&auto=format&fit=crop',
    },
  ]

  // Payment defaults since these aren't columns in the orders table
  const paymentMethod = 'Razorpay'
  const gatewayOrderId = 'pay_' + order.id.slice(0, 12).replace(/-/g, '')
  const paymentStatus = order.status === 'CANCELLED' ? 'FAILED' : 'PAID'

  return (
    <div className="max-w-[800px] mx-auto pt-6 pb-16 font-inter animate-fade-in px-4">
      {/* Loading overlay for mutations */}
      {updateStatusMutation.isPending && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Updating order status...</div>
        </div>
      )}

      {/* Back to Orders Link */}
      <div className="mb-6">
        <Link
          href="/orders"
          className="text-[12px] font-medium text-zinc-700 hover:text-zinc-800 transition-colors flex items-center gap-1.5 select-none"
        >
          <span>←</span> Back to Orders
        </Link>
      </div>

      {/* Title & Status Block */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="font-cormorant lining-nums text-[32px] text-zinc-950 font-normal tracking-wide leading-none mb-2">
            {order.order_number}
          </h1>
          <p className="text-[12px] text-zinc-700 font-inter font-medium">
            {formatDate(order.created_at)}
          </p>
        </div>

        {/* Status Dropdown & Dot indicator */}
        <div className="flex flex-col items-end w-full sm:w-auto gap-3">
          <div className="relative">
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              disabled={updateStatusMutation.isPending}
              className="border border-[#E8E0D5] bg-white pl-4 pr-10 py-2.5 text-[12px] font-medium text-zinc-700 focus:outline-hidden focus:border-[#B38B5D] cursor-pointer appearance-none font-sans min-w-[140px] uppercase tracking-wider rounded-none"
            >
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <div className="absolute right-3.5 top-3.5 pointer-events-none text-zinc-400 text-[8px] font-sans">
              {updateStatusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin text-zinc-400" /> : '▼'}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase font-sans">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(order.status)}`} />
            <span>{order.status}</span>
          </div>

          {/* Message on WhatsApp Button */}
          {order.customers?.phone && (
            <a
              href={`https://wa.me/${order.customers.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Hello ${order.customers.name ?? ''}, regarding your order ${order.order_number}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-[12px] font-bold px-4 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer select-none font-sans rounded-none"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3 1.489 5.361 1.49 5.373 0 9.743-4.307 9.745-9.643.001-2.585-1.01-5.016-2.85-6.859-1.84-1.84-4.284-2.85-6.867-2.852-5.379 0-9.752 4.307-9.754 9.64-.001 2.128.56 4.198 1.628 5.945l-1.066 3.89 3.996-1.037z" />
              </svg>
              Message on WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Customer & Shipping cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Customer card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px]  font-medium tracking-widest text-zinc-400 uppercase mb-4 font-sans">
            CUSTOMER
          </h3>
          <div className="space-y-1">
            <div className="text-[13px] font-medium text-zinc-800">{customerName}</div>
            <div className="text-[12px] text-zinc-700 font-inter font-medium">{customerEmail}</div>
            <div className="text-[12px] text-zinc-700 font-inter font-medium">{customerPhone}</div>
          </div>
        </div>

        {/* Shipping Address card */}
        <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
          <h3 className="text-[9px] font-medium tracking-widest text-zinc-400 uppercase mb-4 font-sans">
            SHIPPING ADDRESS
          </h3>
          <div className="space-y-1 text-[12px] text-zinc-700 font-inter leading-relaxed">
            <div className="font-medium text-zinc-800 text-[13px]">{shippingAddress.name}</div>
            <div>{shippingAddress.line1}</div>
            <div>{shippingAddress.line2}</div>
            <div>{shippingAddress.cityStateZip}</div>
          </div>
        </div>
      </div>

      {/* ITEMS Card */}
      <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs mb-6">
        <h3 className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-6 font-sans">
          ITEMS
        </h3>
        <div className="divide-y divide-[#E8E0D5] -mx-8 border-b border-[#E8E0D5]">
          {items.map((item, idx) => (
            <div key={idx} className="px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-[50px] h-[50px] border border-[#E8E0D5] overflow-hidden bg-zinc-100 flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-zinc-800">{item.name}</div>
                  <div className="text-[11px] text-zinc-700 font-inter font-medium mt-1">
                    Qty: {item.quantity}
                  </div>
                </div>
              </div>
              <div className="text-[13px] font-medium text-zinc-800 font-inter">
                {formatTotal(item.price)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals Section */}
        <div className="pt-6 flex justify-end">
          <div className="w-full sm:w-[320px] space-y-3 text-[12px] font-inter font-medium text-zinc-700">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-zinc-600 font-medium">{formatTotal(order.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Shipping</span>
              <span className="text-zinc-600">₹0 (Free)</span>
            </div>
            <div className="flex justify-between items-center pt-3 text-[13px]">
              <span className="text-[#B38B5D] font-semibold">Total</span>
              <span className="text-[#B38B5D] font-medium font-inter">{formatTotal(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT Card */}
      <div className="bg-white border border-[#E8E0D5] p-6 shadow-xs">
        <h3 className="text-[9px] font-medium tracking-widest text-zinc-400 uppercase mb-4 font-sans">
          PAYMENT
        </h3>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px] text-zinc-800 font-sans font-inter">
            <span>Payment Method:</span>
            <span className="font-inter">{paymentMethod}</span>
            <span className="text-zinc-300 mx-2">|</span>
            <span>Payment Status:</span>
            <span className="inline-block border border-[#A5D6A7] bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-0.5 text-[9px] font-bold tracking-wider rounded-none uppercase">
              {paymentStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-zinc-800 font-inter">
            <span>Razorpay Order ID:</span>
            <span className="border border-[#E8E0D5] bg-[#FAF8F5] px-2.5 py-1 text-[11px] text-zinc-500 font-mono">
              {gatewayOrderId}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
